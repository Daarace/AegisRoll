import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  GraduationCap,
  Presentation,
  ShieldAlert,
  LogOut,
  Database,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Menu,
  X,
  Download,
  Upload,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { aegisStore, isLiveSupabaseConfigured } from '../lib/supabase';
import { RepSecurityModal } from './RepSecurityModal';

interface NavbarProps {
  currentUser: UserProfile | null;
  onNavigate: (view: string) => void;
  currentView: string;
  onUserChange: (user: UserProfile | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onNavigate,
  currentView,
  onUserChange
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [showRepSecurityModal, setShowRepSecurityModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [customUrl, setCustomUrl] = useState(
    localStorage.getItem('aegis_supabase_url') || ''
  );
  const [customKey, setCustomKey] = useState(
    localStorage.getItem('aegis_supabase_key') || ''
  );

  const handleSaveDbSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl) localStorage.setItem('aegis_supabase_url', customUrl);
    else localStorage.removeItem('aegis_supabase_url');

    if (customKey) localStorage.setItem('aegis_supabase_key', customKey);
    else localStorage.removeItem('aegis_supabase_key');

    window.location.reload();
  };

  const handleExportVault = () => {
    const data = aegisStore.exportVaultData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `AegisRoll_LocalVault_Backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = aegisStore.importVaultData(content);
      alert(res.message);
      if (res.success) {
        window.location.reload();
      }
    };
    reader.readAsText(file);
  };

  const handleSwitchUser = (user: UserProfile) => {
    aegisStore.setCurrentUser(user);
    onUserChange(user);
    setShowRoleDropdown(false);
    setMobileMenuOpen(false);

    if (user.role === 'student') onNavigate('student');
    else if (user.role === 'lecturer') onNavigate('lecturer');
    else if (user.role === 'admin') onNavigate('admin');
  };

  const handleLogout = () => {
    aegisStore.setCurrentUser(null);
    onUserChange(null);
    setShowRoleDropdown(false);
    setMobileMenuOpen(false);
    onNavigate('landing');
  };

  const handleResetData = () => {
    if (confirm('Clear all stored courses, departments, students, and attendance records from this browser vault?')) {
      aegisStore.clearAllData();
      onUserChange(null);
      window.location.reload();
    }
  };

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'student':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-brand/10 text-teal-brand border border-teal-brand/30">
            <GraduationCap className="w-3.5 h-3.5" /> Student
          </span>
        );
      case 'lecturer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-brand/15 text-gold-dark border border-gold-brand/40">
            <Presentation className="w-3.5 h-3.5" /> Lecturer
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" /> Class Rep (Admin)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <header className="bg-oxford-800 text-white shadow-academic sticky top-0 z-40 border-b border-oxford-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Title */}
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onNavigate(currentUser ? currentUser.role : 'landing')}
            >
              <div className="w-10 h-10 rounded-xl bg-oxford-900 border border-teal-brand/30 flex items-center justify-center p-1.5 shadow-inner transition-transform group-hover:scale-105">
                <img src="/logo.svg" alt="AegisRoll Seal" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-xl font-bold tracking-tight text-white group-hover:text-teal-brand transition-colors">
                    AegisRoll
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-oxford-700 text-gold-brand border border-gold-brand/30">
                    PWA
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-serif italic hidden md:block leading-none">
                  Verified Presence. Academic Integrity.
                </p>
              </div>
            </div>

              {/* Center Navigation Links (Role Views) */}
              <nav className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => onNavigate('landing')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    currentView === 'landing'
                      ? 'bg-oxford-700 text-teal-brand'
                      : 'text-slate-300 hover:text-white hover:bg-oxford-700/60'
                  }`}
                >
                  Home
                </button>
                {currentUser && (
                  <>
                    {currentUser.role === 'student' && (
                      <button
                        onClick={() => onNavigate('student')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          currentView === 'student'
                            ? 'bg-oxford-700 text-teal-brand'
                            : 'text-slate-300 hover:text-white hover:bg-oxford-700/60'
                        }`}
                      >
                        Student Portal
                      </button>
                    )}
                    {currentUser.role === 'lecturer' && (
                      <button
                        onClick={() => onNavigate('lecturer')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          currentView === 'lecturer'
                            ? 'bg-oxford-700 text-teal-brand'
                            : 'text-slate-300 hover:text-white hover:bg-oxford-700/60'
                        }`}
                      >
                        Lecturer Hub
                      </button>
                    )}
                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => onNavigate('admin')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          currentView === 'admin'
                            ? 'bg-oxford-700 text-teal-brand'
                            : 'text-slate-300 hover:text-white hover:bg-oxford-700/60'
                        }`}
                      >
                        Course Rep Hub
                      </button>
                    )}
                  </>
                )}
              </nav>

            {/* Right Controls: Database Pill, Fast Switcher & User Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Database Connection Status Pill */}
              <button
                onClick={() => setShowDbModal(true)}
                title="AegisRoll Storage & Database Vault"
                className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                  isLiveSupabaseConfigured
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50 hover:bg-emerald-900/60'
                    : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/40'
                }`}
              >
                {isLiveSupabaseConfigured ? (
                  <Database className="w-3 h-3 text-teal-brand" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
                <span className="font-medium text-[11px]">
                  {isLiveSupabaseConfigured ? 'Supabase Live' : 'Local Vault (Zero DB)'}
                </span>
              </button>

              {currentUser ? (
                /* Authenticated User Menu */
                <div className="relative">
                  <button
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-oxford-700/80 hover:bg-oxford-700 border border-oxford-600 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand font-bold text-xs">
                      {currentUser.full_name.charAt(0)}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-white leading-tight">
                        {currentUser.full_name}
                      </div>
                      <div className="text-[10px] text-slate-300 leading-tight">
                        {getRoleBadge(currentUser.role)}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {showRoleDropdown && (
                    <div className="absolute right-0 mt-2 w-72 rounded-xl bg-surface-card text-oxford-800 shadow-academic-lg border border-surface-border py-2 z-50">
                      <div className="px-4 py-2 border-b border-surface-border">
                        <p className="text-xs text-slate-500 font-medium">Signed in as</p>
                        <p className="text-sm font-bold text-oxford-800 truncate">
                          {currentUser.full_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                        <div className="mt-1.5">{getRoleBadge(currentUser.role)}</div>
                      </div>

                      {/* Security & Password Modal Trigger */}
                      <button
                        onClick={() => {
                          setShowRoleDropdown(false);
                          setShowRepSecurityModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-teal-brand" /> Password & Security Settings
                      </button>

                      {/* Storage / Database Settings */}
                      <button
                        onClick={() => {
                          setShowRoleDropdown(false);
                          setShowDbModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium"
                      >
                        <Database className="w-3.5 h-3.5 text-slate-400" /> Database & Vault Backup
                      </button>

                      {/* Clear Local Vault Data */}
                      <button
                        onClick={handleResetData}
                        className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Clear All Local Data
                      </button>

                      {/* Sign Out */}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-surface-border font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('auth')}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors shadow-sm"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 space-y-1 bg-oxford-900 border-t border-oxford-700">
            <button
              onClick={() => {
                onNavigate('landing');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-oxford-800 rounded-lg"
            >
              Public Overview
            </button>
            {currentUser && (
              <>
                <button
                  onClick={() => {
                    onNavigate('student');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-oxford-800 rounded-lg flex items-center justify-between"
                >
                  <span>Student Portal</span>
                  <GraduationCap className="w-4 h-4 text-teal-brand" />
                </button>
                <button
                  onClick={() => {
                    onNavigate('lecturer');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-oxford-800 rounded-lg flex items-center justify-between"
                >
                  <span>Lecturer Hub</span>
                  <Presentation className="w-4 h-4 text-gold-brand" />
                </button>
                <button
                  onClick={() => {
                    onNavigate('admin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-slate-200 hover:bg-oxford-800 rounded-lg flex items-center justify-between"
                >
                  <span>Class Rep Portal & Courses</span>
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
            <div className="pt-2 border-t border-oxford-800">
              <button
                onClick={() => {
                  setShowDbModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-teal-brand hover:bg-oxford-800 rounded-lg flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                <span>
                  Storage: {isLiveSupabaseConfigured ? 'Supabase Connected' : 'Local Vault (Offline)'}
                </span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Database Settings & Vault Modal */}
      {showDbModal && (
        <div className="fixed inset-0 bg-oxford-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 shadow-academic-lg border border-surface-border max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-brand/10 flex items-center justify-center text-teal-brand">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-oxford-800">
                    Storage & Database Management
                  </h3>
                  <p className="text-xs text-slate-500">
                    Workaround 1: Offline Local Vault vs Optional Cloud DB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Workaround 1: Active Local Vault Section */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Workaround 1 Active: Zero-Cloud Local Vault
                  </span>
                  <span className="text-[10px] uppercase font-bold bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                    No DB Needed
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  AegisRoll is running entirely on this device. All courses, students, 32-character physical ID card bindings, class schedules, and attendance logs are securely persisted in your browser's local memory. You can run unlimited attendance sessions without any cloud database or server subscription.
                </p>

                {/* Vault Backup & Restore Buttons */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportVault}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Vault Backup (JSON)</span>
                  </button>

                  <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-oxford-800 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-teal-brand" />
                    <span>Restore from Backup</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportVault}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Optional Cloud Supabase Section */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Optional: Connect External Supabase Database
                  </h4>
                  {isLiveSupabaseConfigured && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      Live Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Only fill this out if you decide to connect an external PostgreSQL cloud database. Otherwise, leave empty to keep using Workaround 1 (Zero-Cloud).
                </p>

                <form onSubmit={handleSaveDbSettings} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://your-project.supabase.co"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Supabase Anon Public API Key
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('aegis_supabase_url');
                        localStorage.removeItem('aegis_supabase_key');
                        setCustomUrl('');
                        setCustomKey('');
                        window.location.reload();
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Clear Credentials (Use Offline Vault)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDbModal(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg transition-colors"
                      >
                        Save Cloud DB
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <RepSecurityModal
        isOpen={showRepSecurityModal}
        onClose={() => setShowRepSecurityModal(false)}
        currentUser={currentUser}
      />
    </>
  );
};
