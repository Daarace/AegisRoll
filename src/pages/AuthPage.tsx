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
  RotateCcw,
  Camera,
  CreditCard,
  Check,
  Trash2
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { getDeviceFingerprint } from '../lib/deviceFingerprint';
import { aegisStore } from '../lib/supabase';
import { matchStudentByMatricOrShorthand } from '../lib/matricHelper';
import { DirectCardScannerModal, ScannedIdCardResult } from '../components/DirectCardScannerModal';

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
  const [cardToken, setCardToken] = useState<string>('');

  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('Initializing...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDirectScanner, setShowDirectScanner] = useState(false);

  const handleDirectScan = (result: ScannedIdCardResult) => {
    setShowDirectScanner(false);
    const raw = (result.rawCode || '').trim();
    if (!raw) return;

    if (authMode === 'login') {
      const cleanRaw = raw.toUpperCase();
      let matchedStudent = aegisStore.students.find(
        (s) =>
          s.qr_code_id === raw ||
          (s.qr_code_id && s.qr_code_id.toUpperCase() === cleanRaw) ||
          s.matric_number.toUpperCase() === cleanRaw
      );

      if (!matchedStudent) {
        matchedStudent = matchStudentByMatricOrShorthand(raw, aegisStore.students) || undefined;
      }

      if (matchedStudent) {
        const user = aegisStore.users.find((u) => u.id === matchedStudent!.user_id);
        if (user) {
          setEmail(user.email);
          setPassword(matchedStudent.matric_number);
          setSuccessMsg(`Physical ID Card Recognized! Welcome, ${user.full_name} (${matchedStudent.matric_number}). Click Sign In to access your account.`);
          return;
        }
      }

      setEmail(raw);
      setSuccessMsg(`Card read: "${raw.substring(0, 12)}...". If this card is not yet linked, sign in with your matric number or email first to bind it.`);
    } else {
      // Onboarding / Register: Always bind the exact raw token embedded in the physical card
      setCardToken(raw);

      if (result.matricNumber) {
        setMatricNumber(result.matricNumber);
        if (!email) {
          setEmail(`${result.matricNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.edu`);
        }
      }
      if (result.studentName && !fullName) {
        setFullName(result.studentName);
      }
      if (result.deptCode) {
        const matched = aegisStore.departments.find(
          (d) => d.code.toUpperCase() === result.deptCode?.toUpperCase()
        );
        if (matched) setDepartmentId(matched.id);
      }
      setSuccessMsg(
        `Physical Student ID Card Linked! Scanned: "${raw.substring(0, 14)}..." (${raw.length} chars). ${
          result.matricNumber ? 'Matriculation number detected.' : 'Please enter your official Matriculation Number below.'
        }`
      );
    }
  };

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
          const dept = aegisStore.departments.find((d) => d.id === assignedDeptId);
          const deptCode = dept ? dept.code.toUpperCase() : 'GEN';
          const year = new Date().getFullYear().toString().slice(-2);
          if (!cleanMatric) {
            cleanMatric = `U${year}${deptCode}1${Math.floor(100 + Math.random() * 900)}`;
          } else if (/^\d{4}$/.test(cleanMatric)) {
            cleanMatric = `U${year}${deptCode}${cleanMatric}`;
          }

          // Exact physical card token read from ID card or default fallback
          const assignedQrId = cardToken.trim() || `AR-QR-${cleanMatric.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;

          aegisStore.students.push({
            id: 'std-' + Math.random().toString(36).substring(2, 9),
            user_id: newUser.id,
            matric_number: cleanMatric,
            department_id: assignedDeptId,
            qr_code_id: assignedQrId
          });
          aegisStore.save();
        }

        aegisStore.setCurrentUser(newUser);
        onSuccess(newUser);
        onNavigate(role);
      } else {
        // Login flow - supports both Institutional Email and Matriculation Number
        const identifier = email.trim();
        let user = aegisStore.users.find((u) => u.email.toLowerCase() === identifier.toLowerCase());

        let matchedStudent = null;
        if (!user) {
          // Check if identifier matches a student's matriculation number
          matchedStudent = matchStudentByMatricOrShorthand(identifier, aegisStore.students);
          if (matchedStudent) {
            user = aegisStore.users.find((u) => u.id === matchedStudent!.user_id);
          }
        } else if (user.role === 'student') {
          matchedStudent = aegisStore.students.find((s) => s.user_id === user!.id);
        }

        if (!user) {
          setErrorMsg('Invalid matriculation number or institutional email address.');
          setLoading(false);
          return;
        }

        let isMatch = aegisStore.verifyUserPassword(user.id, password);

        // For students, also accept their matriculation number, card token, or default 'password123' if they haven't set a custom password
        if (!isMatch && user.role === 'student' && matchedStudent) {
          const rawPass = password.trim().toLowerCase();
          const studentMatricClean = matchedStudent.matric_number.toLowerCase().replace(/[^a-z0-9]/g, '');
          const passClean = rawPass.replace(/[^a-z0-9]/g, '');
          const cardTokenClean = (matchedStudent.qr_code_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            rawPass === 'password123' ||
            passClean === studentMatricClean ||
            rawPass === matchedStudent.matric_number.toLowerCase() ||
            (cardTokenClean && passClean === cardTokenClean)
          ) {
            isMatch = true;
          }
        }

        if (!isMatch) {
          setErrorMsg(
            user.role === 'student'
              ? 'Incorrect password. (Tip: For new students, default password is your Matric Number or "password123").'
              : 'Incorrect password. Click "Reset Credentials" if you have forgotten your password.'
          );
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                {authMode === 'register' ? 'Institutional Email Address' : 'Matriculation Number or Email'}
              </label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => setShowDirectScanner(true)}
                  className="text-[11px] text-teal-dark hover:text-teal-brand font-semibold flex items-center gap-1 bg-teal-brand/10 hover:bg-teal-brand/20 px-2 py-0.5 rounded border border-teal-brand/30 transition shadow-2xs"
                  title="Scan physical student ID card or digital QR pass"
                >
                  <Camera className="w-3 h-3 text-teal-brand" />
                  <span>Scan ID / QR Pass</span>
                </button>
              )}
            </div>
            <div className="relative">
              {authMode === 'register' ? (
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              ) : (
                <GraduationCap className="w-4 h-4 text-teal-brand absolute left-3 top-3" />
              )}
              <input
                type={authMode === 'register' ? 'email' : 'text'}
                required
                placeholder={
                  authMode === 'register'
                    ? 'name@university.edu'
                    : 'Enter Matric Number (e.g. U24MTH1019) or Email'
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-medium"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                {authMode === 'reset' ? 'New Password' : 'Password'}
              </label>
              {authMode === 'login' && (
                <span className="text-[10px] text-slate-500">
                  Default: Matric No. or <code className="text-teal-dark font-mono">password123</code>
                </span>
              )}
            </div>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Matriculation Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. U24MTH1019 or 20/55EC012"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono uppercase"
                    />
                  </div>

                  {/* Physical ID Card Binding */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-teal-brand" />
                        <span className="text-xs font-bold text-oxford-800">
                          Physical Student ID Card (Optional)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDirectScanner(true)}
                        className="text-[11px] text-teal-dark hover:text-teal-brand font-semibold flex items-center gap-1 bg-teal-brand/10 hover:bg-teal-brand/20 px-2.5 py-1 rounded-lg border border-teal-brand/30 transition shadow-2xs"
                        title="Scan plastic student ID card barcode or QR code"
                      >
                        <Camera className="w-3.5 h-3.5 text-teal-brand" />
                        <span>{cardToken ? 'Rescan Card' : 'Scan Card QR'}</span>
                      </button>
                    </div>

                    {cardToken ? (
                      <div className="bg-white border border-emerald-300 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-emerald-900 truncate">
                              Card Linked: <span className="font-mono">{cardToken.substring(0, 16)}...</span>
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {cardToken.length} characters embedded • Ready for in-class scanning
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCardToken('')}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                          title="Unlink card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Have a school plastic ID card with a QR code or barcode? Click <span className="font-semibold text-oxford-800">Scan Card QR</span> to bind it. Whatever code is embedded will be linked directly to you so your Course Rep can mark your attendance in class!
                      </p>
                    )}
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

      <DirectCardScannerModal
        isOpen={showDirectScanner}
        onClose={() => setShowDirectScanner(false)}
        onScan={handleDirectScan}
        title={authMode === 'login' ? 'Scan Student ID to Sign In' : 'Scan Student ID Card to Auto-Fill'}
        subtitle="Point camera at student ID card barcode or digital QR pass"
      />
    </div>
  );
};
