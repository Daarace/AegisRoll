import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  GraduationCap,
  Presentation,
  ShieldAlert,
  Fingerprint,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { getDeviceFingerprint } from '../lib/deviceFingerprint';
import { aegisStore } from '../lib/supabase';

interface AuthPageProps {
  onSuccess: (user: UserProfile) => void;
  onNavigate: (view: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onNavigate }) => {
  const isFirstTimeSetup = aegisStore.users.length === 0;
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>(
    isFirstTimeSetup ? 'register' : 'login'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(isFirstTimeSetup ? 'admin' : 'student');
  const [matricNumber, setMatricNumber] = useState('');
  const [departmentId, setDepartmentId] = useState(aegisStore.departments[0]?.id || '');
  const [customDepartment, setCustomDepartment] = useState('');

  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('Initializing...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeviceFingerprint().then((fp) => {
      setDeviceFingerprint(fp);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authMode === 'reset') {
        // Password Reset flow
        if (password.length < 4) {
          setErrorMsg('New password must be at least 4 characters.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('New password and confirmation do not match.');
          setLoading(false);
          return;
        }

        const res = aegisStore.resetPasswordByEmail(email, password);
        if (!res.success) {
          setErrorMsg(res.message);
          setLoading(false);
          return;
        }

        setSuccessMsg('Your credentials have been successfully reset. You can now sign in.');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
        setLoading(false);
        return;
      }

      if (authMode === 'register') {
        // Registration flow
        const existing = aegisStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          setErrorMsg('An account with this email address already exists.');
          setLoading(false);
          return;
        }

        if (password.length < 4) {
          setErrorMsg('Password must be at least 4 characters.');
          setLoading(false);
          return;
        }

        let assignedDeptId = departmentId;
        if (role === 'student' && !assignedDeptId) {
          const deptName = customDepartment.trim() || 'General Studies';
          const newDept = aegisStore.addDepartment(deptName, deptName.substring(0, 3).toUpperCase());
          assignedDeptId = newDept.id;
        }

        const newUser: UserProfile = {
          id: 'usr-' + Math.random().toString(36).substring(2, 9),
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          password: password.trim(),
          device_fingerprint: deviceFingerprint,
          fingerprint_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        aegisStore.users.push(newUser);
        aegisStore.save();

        // If student, create student detail record
        if (role === 'student') {
          let cleanMatric = matricNumber.trim().toUpperCase();
          if (!cleanMatric) {
            cleanMatric = `U24MTH${Math.floor(1000 + Math.random() * 9000)}`;
          } else if (/^\d{4}$/.test(cleanMatric)) {
            cleanMatric = `U24MTH${cleanMatric}`;
          }
          aegisStore.students.push({
            id: 'std-' + Math.random().toString(36).substring(2, 9),
            user_id: newUser.id,
            matric_number: cleanMatric,
            department_id: assignedDeptId,
            qr_code_id: `AR-QR-${cleanMatric.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`
          });
          aegisStore.save();
        }

        aegisStore.setCurrentUser(newUser);
        onSuccess(newUser);
        onNavigate(role);
      } else {
        // Login flow
        const user = aegisStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          setErrorMsg('Invalid institutional email or password.');
          setLoading(false);
          return;
        }

        const isMatch = aegisStore.verifyUserPassword(user.id, password);
        if (!isMatch) {
          setErrorMsg('Incorrect password. Click "Reset Credentials" if you have forgotten your password.');
          setLoading(false);
          return;
        }

        // Student Device Binding check
        if (user.role === 'student') {
          const check = await aegisStore.validateAndBindDevice(user.id, deviceFingerprint);
          if (!check.allowed) {
            setErrorMsg(check.message);
            setLoading(false);
            return;
          }
        }

        aegisStore.setCurrentUser(user);
        onSuccess(user);
        onNavigate(user.role);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4 sm:px-6">
      <div className="bg-surface-card rounded-2xl p-6 sm:p-8 shadow-academic-lg border border-surface-border">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center mx-auto mb-3 shadow-md">
            {authMode === 'reset' ? (
              <KeyRound className="w-6 h-6" />
            ) : authMode === 'register' ? (
              <User className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <h2 className="font-serif text-2xl font-bold text-oxford-800">
            {isFirstTimeSetup
              ? 'First-Time Setup: Create Admin'
              : authMode === 'reset'
              ? 'Reset Credentials'
              : authMode === 'register'
              ? 'Create Academic Profile'
              : 'Institutional Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isFirstTimeSetup
              ? 'Set up the Course Representative account to configure courses and attendance'
              : authMode === 'reset'
              ? 'Enter your institutional email and set your new password'
              : authMode === 'register'
              ? 'Register your account to access university attendance'
              : 'Sign in to access your attendance records and sessions'}
          </p>
        </div>

        {/* Feedback Notifications */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Johnathan Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {authMode === 'reset' ? 'New Password' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
              />
            </div>
          </div>

          {authMode === 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
                />
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1 transition-all ${
                      role === 'student'
                        ? 'bg-teal-brand/10 border-teal-brand text-teal-dark shadow-sm'
                        : 'border-surface-border text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('lecturer')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1 transition-all ${
                      role === 'lecturer'
                        ? 'bg-gold-brand/20 border-gold-brand text-gold-dark shadow-sm'
                        : 'border-surface-border text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Presentation className="w-4 h-4" />
                    <span>Lecturer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border flex flex-col items-center gap-1 transition-all ${
                      role === 'admin'
                        ? 'bg-red-50 border-red-400 text-red-600 shadow-sm'
                        : 'border-surface-border text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Course Rep</span>
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Matriculation Number</span>
                      <span className="text-[10px] text-teal-dark font-mono font-normal">Format: U24MTH####</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. U24MTH1019"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Department
                    </label>
                    {aegisStore.departments.length > 0 ? (
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white"
                      >
                        {aegisStore.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} - {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. Computer Science & Engineering"
                        value={customDepartment}
                        onChange={(e) => setCustomDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
                      />
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors shadow-academic flex items-center justify-center gap-2 mt-2"
          >
            <span>
              {authMode === 'reset'
                ? 'Save New Password & Sign In'
                : authMode === 'register'
                ? 'Create Account'
                : 'Sign In'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Footer Mode Switchers */}
        <div className="mt-5 pt-4 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          {authMode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('reset');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="hover:text-teal-brand transition-colors text-slate-600"
              >
                Reset / Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="hover:text-teal-brand font-medium text-oxford-800"
              >
                Create New Account
              </button>
            </>
          ) : authMode === 'register' ? (
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="hover:text-teal-brand transition-colors w-full text-center"
            >
              Already registered? Return to Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="hover:text-teal-brand transition-colors w-full text-center"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
