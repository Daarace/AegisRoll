import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { aegisStore, isLiveSupabaseConfigured } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { LecturerDashboard } from './pages/LecturerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ShieldCheck, Database, Info } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(aegisStore.currentUser);
  const [currentView, setCurrentView] = useState<string>('landing');

  // Sync state on load
  useEffect(() => {
    if (aegisStore.currentUser) {
      setCurrentUser(aegisStore.currentUser);
    }

    // Auto-route if opened from a smartphone normal camera QR scan
    const search = window.location.search;
    const hash = window.location.hash;
    if (search.includes('session_id') || search.includes('pin') || hash.includes('checkin') || hash.includes('session_id')) {
      const user = aegisStore.currentUser;
      if (user && user.role === 'student') {
        setCurrentView('student');
      } else if (!user) {
        setCurrentView('auth');
      }
    }
  }, []);

  const handleNavigate = (view: string) => {
    // Role guard checks: if accessing protected views without an active user, redirect to auth
    if ((view === 'student' || view === 'lecturer' || view === 'admin') && !currentUser) {
      setCurrentView('auth');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUserChange = (user: UserProfile | null) => {
    setCurrentUser(user);
    if (!user) {
      setCurrentView('landing');
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-surface text-oxford-800 font-sans selection:bg-teal-brand/20">
        {/* PWA Install Notification */}
        <PwaInstallPrompt />

        {/* Global Navigation Header */}
        <Navbar
          currentUser={currentUser}
          onNavigate={handleNavigate}
          currentView={currentView}
          onUserChange={handleUserChange}
        />

        {/* Main Content Router */}
        <main className="flex-1">
          {currentView === 'landing' && (
            <LandingPage onNavigate={handleNavigate} />
          )}

          {currentView === 'auth' && (
            <AuthPage
              onSuccess={(u) => {
                setCurrentUser(u);
                setCurrentView(u.role);
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'student' && currentUser && (
            <StudentDashboard currentUser={currentUser} />
          )}

          {currentView === 'lecturer' && currentUser && (
            <LecturerDashboard currentUser={currentUser} />
          )}

          {currentView === 'admin' && currentUser && (
            <AdminDashboard currentUser={currentUser} />
          )}
        </main>

        {/* Authoritative Academic Footer */}
        <footer className="bg-oxford-900 text-white border-t border-oxford-700 py-10 px-4 sm:px-6 lg:px-8 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-oxford-800 border border-teal-brand/30 flex items-center justify-center p-1.5 shadow-inner">
                <img src="/logo.svg" alt="AegisRoll" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-white">
                  AegisRoll
                </span>
                <p className="text-[11px] text-slate-400 font-serif italic">
                  Verified Presence. Academic Integrity.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="hover:text-teal-brand transition-colors cursor-pointer" onClick={() => handleNavigate('landing')}>
                Overview
              </span>
              <span className="hover:text-teal-brand transition-colors cursor-pointer" onClick={() => handleNavigate('student')}>
                Student Check-In
              </span>
              <span className="hover:text-teal-brand transition-colors cursor-pointer" onClick={() => handleNavigate('lecturer')}>
                Lecturer Live Hub
              </span>
              <span className="hover:text-teal-brand transition-colors cursor-pointer" onClick={() => handleNavigate('admin')}>
                Registrar Audit & Reports
              </span>
            </div>

            <div className="text-right text-[11px] text-slate-400">
              <p>© {new Date().getFullYear()} AegisRoll Academic Systems.</p>
              <p className="text-slate-400 mt-0.5">Ready for Netlify & Supabase Deployment</p>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};
