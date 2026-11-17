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
  ArrowRight
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { getDeviceFingerprint } from '../lib/deviceFingerprint';
import { aegisStore } from '../lib/supabase';

interface AuthPageProps {
  onSuccess: (user: UserProfile) => void;
  onNavigate: (view: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onNavigate }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [matricNumber, setMatricNumber] = useState('');
  const [departmentId, setDepartmentId] = useState(aegisStore.departments[0]?.id || '');

  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('Initializing...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeviceFingerprint().then((fp) => {
      setDeviceFingerprint(fp);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        // Registration flow
        const existing = aegisStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          setErrorMsg('An account with this email address already exists.');
          setLoading(false);
          return;
        }

        const newUser: UserProfile = {
          id: 'usr-' + Math.random().toString(36).substring(2, 9),
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          device_fingerprint: deviceFingerprint,
          fingerprint_updated_at: new Date().toISOString()
        };

        aegisStore.users.push(newUser);

        // If student, create student detail record
        if (role === 'student') {
          const matric = matricNumber.trim() || `UG/2026/${Math.floor(1000 + Math.random() * 9000)}`;
          aegisStore.students.push({
            id: 'std-' + Math.random().toString(36).substring(2, 9),
            user_id: newUser.id,
            matric_number: matric,
            department_id: departmentId
          });
        }

        aegisStore.setCurrentUser(newUser);
        onSuccess(newUser);
        onNavigate(role);
      } else {
        // Login flow
        const user = aegisStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          setErrorMsg('Invalid email or password. (For evaluation, click a Demo Account below)');
          setLoading(false);
          return;
        }

        // Student Device Binding & 12h Proxy Lockout Check
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

  const fillDemoAccount = (demoUser: UserProfile) => {
    setEmail(demoUser.email);
    setPassword('demopassword123');
    setRole(demoUser.role);
    setFullName(demoUser.full_name);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4 sm:px-6">
      <div className="bg-surface-card rounded-2xl p-6 sm:p-8 shadow-academic-lg border border-surface-border">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center mx-auto mb-3 shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-oxford-800">
            {isRegister ? 'Create Academic Profile' : 'Institutional Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isRegister
              ? 'Register with your university credentials and bind your personal device'
              : 'Sign in to access geofenced attendance tracking'}
          </p>
        </div>

        {/* Device Fingerprint Security Strip */}
        <div className="mb-6 p-3 rounded-xl bg-oxford-800/5 border border-oxford-800/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Fingerprint className="w-4 h-4 text-teal-brand" />
            <span className="font-medium">Device Token:</span>
            <span className="font-mono text-[11px] text-slate-500 truncate max-w-[150px]">
              {deviceFingerprint}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-teal-dark bg-teal-brand/20 px-2 py-0.5 rounded-full">
            Anti-Proxy Active
          </span>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Chen"
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
              Password
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

          {isRegister && (
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
                    <span>Class Rep</span>
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Matriculation / Student ID Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UG/2023/CS/1042"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Department
                    </label>
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
            <span>{isRegister ? 'Register & Bind Device' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
            }}
            className="text-xs text-slate-500 hover:text-teal-brand transition-colors"
          >
            {isRegister
              ? 'Already registered? Return to Sign In'
              : "Don't have an account yet? Register here"}
          </button>
        </div>

        {/* Quick Demo Credentials for Fast Review */}
        <div className="mt-6 pt-5 border-t border-surface-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
            Quick Fill Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => fillDemoAccount(aegisStore.users[0])}
              className="p-2 text-left bg-slate-50 hover:bg-teal-brand/10 border border-slate-200 rounded-lg transition-colors"
            >
              <div className="text-[11px] font-bold text-oxford-800">Student</div>
              <div className="text-[10px] text-slate-500 truncate">Alex Chen</div>
            </button>

            <button
              onClick={() => fillDemoAccount(aegisStore.users[5])}
              className="p-2 text-left bg-slate-50 hover:bg-gold-brand/20 border border-slate-200 rounded-lg transition-colors"
            >
              <div className="text-[11px] font-bold text-oxford-800">Lecturer</div>
              <div className="text-[10px] text-slate-500 truncate">Dr. Adams</div>
            </button>

            <button
              onClick={() => fillDemoAccount(aegisStore.users[6])}
              className="p-2 text-left bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors"
            >
              <div className="text-[11px] font-bold text-oxford-800">Class Rep</div>
              <div className="text-[10px] text-slate-500 truncate">Course & Roster Admin</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
