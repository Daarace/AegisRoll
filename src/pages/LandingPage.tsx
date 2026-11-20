import React from 'react';
import {
  ShieldCheck,
  MapPin,
  Smartphone,
  FileSpreadsheet,
  FileText,
  FileCode,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  GraduationCap,
  Presentation,
  ShieldAlert,
  Clock,
  Radio,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { aegisStore } from '../lib/supabase';
import { UserProfile } from '../types';

interface LandingPageProps {
  onNavigate: (view: string) => void;
  onSelectUser?: (user: UserProfile) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate
}) => {
  return (
    <div className="space-y-16 pb-16">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-oxford-800 via-oxford-800 to-oxford-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Subtle Background Geofence Grid Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#26B9A8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-oxford-700/80 border border-teal-brand/30 text-teal-brand text-xs font-semibold shadow-inner">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Progressive Web App • Geofenced Classroom Attendance & Roll Call</span>
          </div>

          {/* Headline & Brand Title */}
          <h1 className="text-4xl sm:text-6xl font-serif font-extrabold tracking-tight text-white leading-tight">
            Verified Presence.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-brand to-emerald-300">
              Academic Integrity.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-300 font-sans leading-relaxed">
            AegisRoll enables hardware-free, zero-cloud offline attendance tracking. 
            Lecturers and Course Representatives anchor classroom sessions with dynamic PIN verification, 
            rapid ID card scanning, and instant manual roll calls by matriculation number.
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('auth')}
              className="px-6 py-3.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-sm transition-all shadow-academic flex items-center gap-2 group"
            >
              <GraduationCap className="w-5 h-5 text-oxford-900" />
              <span>Student Check-In / Sign In</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <a
              href="#how-it-works"
              className="px-6 py-3.5 rounded-xl bg-oxford-700/80 hover:bg-oxford-700 text-white font-semibold text-sm transition-all border border-oxford-600 flex items-center gap-2"
            >
              <span>System Overview</span>
            </a>
          </div>

          {/* Professional 3-Pillar Capability Grid */}
          <div className="pt-10 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-oxford-700/40 border border-oxford-600/80 backdrop-blur-sm shadow-md">
              <div className="w-8 h-8 rounded-lg bg-teal-brand/20 text-teal-brand flex items-center justify-center mb-2.5">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-white">Geofenced Check-In</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Mobile GPS telemetry calculates exact perimeter distance from the classroom anchor device.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-oxford-700/40 border border-oxford-600/80 backdrop-blur-sm shadow-md">
              <div className="w-8 h-8 rounded-lg bg-teal-brand/20 text-teal-brand flex items-center justify-center mb-2.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-white">Direct Matric Roll Call</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Course Representatives can instantly verify and mark students present by typing or scanning their matric number.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-oxford-700/40 border border-oxford-600/80 backdrop-blur-sm shadow-md">
              <div className="w-8 h-8 rounded-lg bg-teal-brand/20 text-teal-brand flex items-center justify-center mb-2.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-white">Official Exports</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Export accredited attendance matrices and rosters to CSV, Excel, and Word (.docx) with one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Core Feature Pillars (3-Column Cards) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="font-serif text-3xl font-bold text-oxford-800">
            Engineered for Modern Academic Governance
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            No expensive hardware beacons. No app store installation barriers. Complete cryptographic attendance verifiability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Dynamic Classroom Geofencing */}
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border hover:shadow-academic-lg transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-brand/10 border border-teal-brand/30 text-teal-brand flex items-center justify-center mb-5">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-oxford-800 mb-2">
                Dynamic Classroom Geofencing
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                The lecturer sets a 50m, 75m, or 100m perimeter from the lecture podium. 
                Supabase PostgreSQL computes the precise Haversine distance in meters and 
                applies a fair indoor GPS grace buffer <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono">(r + min(acc*0.5, 25))</code> to prevent false negatives.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-teal-brand">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> High-accuracy browser GPS API
            </div>
          </div>

          {/* Card 2: Zero-Cloud & 32-Char Card Scanning (Workaround 1) */}
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border hover:shadow-academic-lg transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-oxford-800/10 border border-oxford-800/20 text-oxford-800 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-oxford-800 mb-2">
                Zero-Cloud & Physical Card Scanning
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                No external database or server needed (Workaround 1). Course Representatives can rapidly scan students' 
                pre-printed <strong className="text-oxford-800">32-character physical plastic ID cards</strong> or digital passes 
                directly from their mobile camera with instant offline local vault persistence and 12h hardware proxy prevention.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-oxford-800">
              <Lock className="w-4 h-4 mr-1.5 text-teal-brand" /> 100% Offline Vault & 32-char card support
            </div>
          </div>

          {/* Card 3: Audit-Ready CSV, PDF & Word Exports */}
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border hover:shadow-academic-lg transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gold-brand/20 border border-gold-brand/40 text-gold-dark flex items-center justify-center mb-5">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-oxford-800 mb-2">
                Multi-Format Audit Exports
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Export comprehensive class attendance records instantly. Download clean CSV files 
                powered by <strong className="text-oxford-800">PapaParse</strong>, publication-grade academic 
                audit sheets via <strong className="text-oxford-800">jsPDF</strong> with Dean signature blocks, 
                or editable <strong className="text-oxford-800">Word (.docx)</strong> records.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV</span>
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-red-600" /> PDF</span>
              <span className="flex items-center gap-1"><FileCode className="w-3.5 h-3.5 text-blue-600" /> Word</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three-Step "How It Works" Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-oxford-800 to-oxford-900 rounded-3xl p-8 sm:p-12 text-white shadow-academic-lg">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-brand">
              Workflow Overview
            </span>
            <h2 className="font-serif text-3xl font-bold text-white mt-1">
              How AegisRoll Verifies Classroom Presence
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-oxford-700/60 rounded-2xl p-6 border border-oxford-600/80 relative">
              <div className="w-9 h-9 rounded-full bg-teal-brand text-oxford-900 font-bold text-sm flex items-center justify-center mb-4">
                1
              </div>
              <h4 className="font-serif text-lg font-bold text-white mb-2">
                Lecturer Initiates Session
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                The lecturer selects the course and geofence radius. The app registers the lecturer’s 
                current GPS coordinates as <code className="text-teal-brand font-mono">admin_lat</code>/<code className="text-teal-brand font-mono">admin_lon</code> and projects a random 4-digit PIN on the auditorium screen.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-oxford-700/60 rounded-2xl p-6 border border-oxford-600/80 relative">
              <div className="w-9 h-9 rounded-full bg-gold-brand text-oxford-900 font-bold text-sm flex items-center justify-center mb-4">
                2
              </div>
              <h4 className="font-serif text-lg font-bold text-white mb-2">
                Student Enters PIN & GPS
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                The student opens AegisRoll on their smartphone, types the 4-digit PIN, and clicks Check-In. 
                The browser requests high-accuracy GPS coordinates with accuracy validation (<span className="text-gold-brand font-semibold">&lt;100m threshold</span>).
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-oxford-700/60 rounded-2xl p-6 border border-oxford-600/80 relative">
              <div className="w-9 h-9 rounded-full bg-teal-brand text-oxford-900 font-bold text-sm flex items-center justify-center mb-4">
                3
              </div>
              <h4 className="font-serif text-lg font-bold text-white mb-2">
                Realtime Verification & Audit
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                The PostgreSQL RPC calculates Haversine distance, marks student as 
                <strong className="text-emerald-400"> Present</strong> or 
                <strong className="text-amber-400"> Flagged</strong>, and streams live check-ins 
                to the lecturer’s dashboard with manual override authority.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => onNavigate('auth')}
              className="px-8 py-3.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-sm transition-all shadow-lg"
            >
              Get Started with AegisRoll
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
