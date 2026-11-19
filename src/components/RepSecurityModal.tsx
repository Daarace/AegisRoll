import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Smartphone,
  Save,
  ShieldCheck
} from 'lucide-react';
import { aegisStore } from '../lib/supabase';
import { UserProfile } from '../types';

interface RepSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onPasswordChanged?: () => void;
}

export const RepSecurityModal: React.FC<RepSecurityModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPasswordChanged
}) => {
  const adminUser = currentUser?.role === 'admin' 
    ? currentUser 
    : aegisStore.users.find((u) => u.role === 'admin') || currentUser || null;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [lockEnabled, setLockEnabled] = useState(aegisStore.isAdminLockEnabled());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!adminUser) {
      setErrorMsg('No Course Representative account found.');
      return;
    }

    // Verify current password
    const verified = aegisStore.verifyUserPassword(adminUser.id, currentPassword);
    if (!verified) {
      setErrorMsg('The current password entered is incorrect.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('New password or security PIN must be at least 4 characters/digits.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('The new password and confirmation password do not match.');
      return;
    }

    const updated = aegisStore.updateUserPassword(adminUser.id, newPassword);
    if (updated) {
      setSuccessMsg('Course Representative password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onPasswordChanged) onPasswordChanged();
    } else {
      setErrorMsg('Failed to update password.');
    }
  };

  const handleToggleLock = (enabled: boolean) => {
    aegisStore.setAdminLockEnabled(enabled);
    setLockEnabled(enabled);
    setSuccessMsg(
      enabled
        ? 'Admin Portal Passcode Lock enabled! Rep password is required to access admin screens.'
        : 'Admin Portal Passcode Lock disabled.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-academic-lg border border-surface-border relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center shadow-inner">
            <KeyRound className="w-6 h-6 text-teal-brand" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-oxford-800">
              Course Representative Security & Passcode
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Protect administrative privileges, roster editing, and live sessions
            </p>
          </div>
        </div>

        {/* Account Info Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-oxford-800 text-white flex items-center justify-center font-bold text-xs">
              CR
            </div>
            <div>
              <div className="text-xs font-bold text-oxford-800">
                {adminUser?.full_name || 'Class Representative'}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {adminUser?.email || 'class.rep@university.edu'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Vault Protected</span>
          </div>
        </div>

        {/* Feedback messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form: Change Password */}
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-oxford-800 uppercase tracking-wider">
              Change Master Password / PIN
            </span>
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-xs text-slate-500 hover:text-teal-brand flex items-center gap-1"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Hide' : 'Reveal'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Rep Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                placeholder="Enter current password or PIN"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password / PIN
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                placeholder="Min 4 characters or digits"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors shadow-academic flex items-center justify-center gap-2 mt-2"
          >
            <Save className="w-3.5 h-3.5 text-teal-brand" />
            <span>Update Course Rep Password</span>
          </button>
        </form>

        {/* Anti-Tamper Device Lock Option */}
        <div className="mt-6 pt-5 border-t border-surface-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-brand/10 text-teal-dark flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-5 h-5 text-teal-dark" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-oxford-800">
                  Student Anti-Tamper Screen Lock
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Require password verification before opening the Admin Hub. Useful when students are passing your phone around in the auditorium to scan QR passes.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={lockEnabled}
                onChange={(e) => handleToggleLock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-brand"></div>
            </label>
          </div>
        </div>

        {/* Zero-Cloud Persistence Info */}
        <div className="mt-5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Offline Local Vault Security:</span> Your password is saved directly into your device's browser vault (<code className="font-mono text-amber-800 bg-amber-100/70 px-1 py-0.5 rounded">localStorage</code>) and backed up when you click <strong>Backup Vault (JSON)</strong>. If you deploy with Supabase Auth in the future, passwords sync to PostgreSQL <code className="font-mono text-amber-800 bg-amber-100/70 px-1 py-0.5 rounded">auth.users</code>.
          </div>
        </div>
      </div>
    </div>
  );
};
