import React, { useState, useEffect } from 'react';
import {
  Presentation,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Play,
  Square,
  Maximize2,
  RefreshCw,
  Clock,
  Compass,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  ShieldCheck,
  Sparkles,
  Layers,
  Camera,
  QrCode
} from 'lucide-react';
import { UserProfile, Course, ClassSession, AttendanceLog, Student } from '../types';
import { aegisStore, subscribeToSessionAttendance } from '../lib/supabase';
import { getHighAccuracyLocation, GeoErrorResult } from '../lib/geolocation';
import { exportAttendanceToCSV, exportAttendanceToPDF, exportAttendanceToWord } from '../lib/exporters';
import { GpsPermissionModal } from '../components/GpsPermissionModal';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';

interface LecturerDashboardProps {
  currentUser: UserProfile;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ currentUser }) => {
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [sessionLogs, setSessionLogs] = useState<AttendanceLog[]>([]);

  // Start Session Form States
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(75);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [geoError, setGeoError] = useState<GeoErrorResult | null>(null);

  // Large Projection Display Modal State
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [showSessionQrModal, setShowSessionQrModal] = useState(false);

  const refreshData = () => {
    // Find courses assigned to this lecturer
    let courses = aegisStore.courses.filter(
      (c) => c.lecturer_id === currentUser.id
    );
    if (courses.length === 0) {
      courses = aegisStore.courses; // Fallback to all courses for demo
    }
    setAssignedCourses(courses);

    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }

    // Check if lecturer currently has an active session
    const active = aegisStore.sessions.find(
      (s) => s.is_active && (s.lecturer_id === currentUser.id || s.lecturer_id === 'usr-lecturer-1')
    );
    setActiveSession(active || null);

    if (active) {
      const logs = aegisStore.logs.filter((l) => l.session_id === active.id);
      setSessionLogs(logs);
    } else {
      setSessionLogs([]);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser]);

  // Realtime subscription to attendance events
  useEffect(() => {
    if (!activeSession) return;

    const unsubscribe = subscribeToSessionAttendance(activeSession.id, (payload) => {
      // Reload logs on insert or update
      const updatedLogs = aegisStore.logs.filter((l) => l.session_id === activeSession.id);
      setSessionLogs([...updatedLogs]);
    });

    return () => unsubscribe();
  }, [activeSession?.id]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    setIsStartingSession(true);
    setGeoError(null);

    let lat = 40.712776;
    let lon = -74.005974;

    // Try real GPS if available, else default to university lecture hall coordinates
    try {
      const pos = await getHighAccuracyLocation();
      lat = pos.latitude;
      lon = pos.longitude;
    } catch (err: any) {
      console.warn('GPS not acquired for podium, using default classroom anchor:', err);
      // We permit starting session using default coordinates if testing on desktop
    }

    const newSession = aegisStore.createSession({
      course_id: selectedCourseId,
      lecturer_id: currentUser.id,
      admin_lat: lat,
      admin_lon: lon,
      geofence_radius_meters: geofenceRadius
    });

    setActiveSession(newSession);
    setSessionLogs([]);
    setIsStartingSession(false);
    setShowProjectionModal(true);
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    if (confirm('Are you sure you want to conclude this attendance session? Students will no longer be able to check in.')) {
      aegisStore.endSession(activeSession.id);
      setActiveSession(null);
      refreshData();
    }
  };

  const handleOverrideStatus = (logId: string, newStatus: 'Present' | 'Flagged') => {
    aegisStore.overrideAttendanceStatus(logId, newStatus);
    const updated = aegisStore.logs.filter((l) => l.session_id === activeSession?.id);
    setSessionLogs([...updated]);
  };

  // Helper metrics
  const activeCourse = activeSession
    ? aegisStore.courses.find((c) => c.id === activeSession.course_id)
    : null;

  const enrolledCount = activeSession
    ? aegisStore.enrollments.filter((e) => e.course_id === activeSession.course_id).length
    : 0;

  const presentCount = sessionLogs.filter((l) => l.status === 'Present').length;
  const flaggedCount = sessionLogs.filter((l) => l.status === 'Flagged').length;

  const handleQuickExport = (type: 'csv' | 'pdf' | 'word') => {
    if (!activeSession || !activeCourse) return;
    const summaries = aegisStore.getAttendanceReport({ courseId: activeCourse.id });
    const meta = {
      courseCode: activeCourse.course_code,
      courseTitle: activeCourse.title,
      departmentName: aegisStore.departments.find((d) => d.id === activeCourse.department_id)?.name
    };

    if (type === 'csv') exportAttendanceToCSV(summaries, `${activeCourse.course_code}_Live_Attendance.csv`);
    else if (type === 'pdf') exportAttendanceToPDF(summaries, meta, `${activeCourse.course_code}_Live_Attendance.pdf`);
    else exportAttendanceToWord(summaries, meta, `${activeCourse.course_code}_Live_Attendance.docx`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-oxford-800 text-gold-brand border border-gold-brand/40 flex items-center justify-center text-xl font-bold font-serif shadow-inner">
            {currentUser.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-oxford-800">
                {currentUser.full_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-brand/15 text-gold-dark border border-gold-brand/40">
                Lecturer Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Course Coordinator & Attendance Session Proctor
            </p>
          </div>
        </div>

        {/* Quick status indicator */}
        <div className="flex items-center gap-3">
          {activeSession ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Session In Progress (PIN: {activeSession.session_pin})</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> No session active
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Interface */}
      {!activeSession ? (
        /* Start Session Form */
        <div className="max-w-2xl mx-auto bg-surface-card rounded-2xl p-6 sm:p-8 shadow-academic border border-surface-border space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center mx-auto mb-2 shadow-md">
              <Presentation className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-oxford-800">
              Start Dynamic Class Session
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Lock your classroom GPS coordinates, set the dynamic geofence radius, and project the 4-digit PIN for students.
            </p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white font-medium"
              >
                {assignedCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.title} ({c.credit_load} Credits)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Geofence Radius Perimeter
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[50, 75, 100].map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    onClick={() => setGeofenceRadius(radius)}
                    className={`py-3 px-2 text-center rounded-xl border transition-all ${
                      geofenceRadius === radius
                        ? 'bg-teal-brand/10 border-teal-brand text-teal-dark font-bold shadow-sm'
                        : 'border-surface-border text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-base font-bold">{radius} Meters</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {radius === 50
                        ? 'Small Seminar'
                        : radius === 75
                        ? 'Standard Lecture'
                        : 'Large Auditorium'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-oxford-800 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-brand" /> GPS Anchor Coordinates
              </div>
              <p className="text-[11px] leading-relaxed">
                When you click Start Session, your current device location is locked as the classroom center point. 
                Students must be physically located within the selected radius to be marked Present.
              </p>
            </div>

            <button
              type="submit"
              disabled={isStartingSession}
              className="w-full py-3.5 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-sm transition-all shadow-academic flex items-center justify-center gap-2"
            >
              {isStartingSession ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-brand" />
                  <span>Locking GPS & Initializing Geofence...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-teal-brand fill-teal-brand" />
                  <span>Launch Geofenced Session & Generate PIN</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Live Session Proctoring & Monitor Dashboard */
        <div className="space-y-6">
          {/* Top Session Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Session PIN</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-3xl font-extrabold text-oxford-800 tracking-wider">
                  {activeSession.session_pin}
                </span>
                <button
                  onClick={() => setShowProjectionModal(true)}
                  className="p-2 rounded-lg bg-teal-brand/10 text-teal-brand hover:bg-teal-brand/20 transition-colors"
                  title="Expand to Projection Mode"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Verified Present</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-3xl font-bold text-emerald-700">
                  {presentCount}
                </span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Location Flagged</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-3xl font-bold text-amber-600">
                  {flaggedCount}
                </span>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Total Enrolled</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-3xl font-bold text-oxford-800">
                  {enrolledCount}
                </span>
                <Users className="w-5 h-5 text-oxford-600" />
              </div>
            </div>
          </div>

          {/* Active Session Info & Controls */}
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-oxford-800">
                  {activeCourse?.course_code} - {activeCourse?.title}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-brand/10 text-teal-brand">
                  Radius: {activeSession.geofence_radius_meters}m
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Podium Coordinates: {activeSession.admin_lat.toFixed(5)}, {activeSession.admin_lon.toFixed(5)} • Started: {new Date(activeSession.start_time).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowQrScannerModal(true)}
                className="px-3.5 py-2 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                title="Scan student digital QR passes directly with camera"
              >
                <Camera className="w-3.5 h-3.5" /> Scan Student ID Pass
              </button>

              <button
                onClick={() => setShowProjectionModal(true)}
                className="px-3.5 py-2 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Maximize2 className="w-3.5 h-3.5 text-teal-brand" /> Project PIN Large
              </button>

              <button
                onClick={handleEndSession}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Square className="w-3.5 h-3.5" /> End Session
              </button>
            </div>
          </div>

          {/* Live Check-in Feed Table */}
          <div className="bg-surface-card rounded-2xl shadow-academic border border-surface-border overflow-hidden">
            <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-teal-brand animate-pulse" />
                  Live Attendance Check-In Monitor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subscribed via Supabase Realtime • Automatically updates as students check in
                </p>
              </div>

              {/* Quick Export Dropdown */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickExport('csv')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
                </button>
                <button
                  onClick={() => handleQuickExport('pdf')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" /> PDF
                </button>
                <button
                  onClick={() => handleQuickExport('word')}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-600" /> Word
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Matric No.</th>
                    <th className="py-3 px-4">Check-in Time</th>
                    <th className="py-3 px-4">Calculated Distance</th>
                    <th className="py-3 px-4">GPS Accuracy</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4 text-right">Lecturer Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {sessionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No students have checked in yet. Display the 4-digit PIN for students to enter.
                      </td>
                    </tr>
                  ) : (
                    sessionLogs.map((log) => {
                      const student = aegisStore.students.find((s) => s.id === log.student_id);
                      const user = student ? aegisStore.users.find((u) => u.id === student.user_id) : null;
                      const isPresent = log.status === 'Present';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-oxford-800">
                            {user?.full_name || 'Unknown Student'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {student?.matric_number || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(log.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium">
                            <span className={log.distance_calculated > activeSession.geofence_radius_meters ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                              {log.distance_calculated}m
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            ±{log.gps_accuracy_meters}m
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              isPresent
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isPresent ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {log.status === 'Flagged' ? (
                              <button
                                onClick={() => handleOverrideStatus(log.id, 'Present')}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                              >
                                Approve Present
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOverrideStatus(log.id, 'Flagged')}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors"
                              >
                                Flag
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Projection Mode Modal (Extra Large PIN Display) */}
      {showProjectionModal && activeSession && (
        <div className="fixed inset-0 bg-oxford-900/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="max-w-2xl w-full text-center text-white space-y-8 relative">
            <button
              onClick={() => setShowProjectionModal(false)}
              className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white"
            >
              <X className="w-8 h-8" />
            </button>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-brand px-3 py-1 rounded-full bg-oxford-800 border border-teal-brand/30">
                Auditorium Projection Display
              </span>
              <h2 className="font-serif text-3xl font-extrabold mt-3">
                {activeCourse?.course_code}: {activeCourse?.title}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Open <span className="text-teal-brand font-bold underline">AegisRoll</span> on your mobile browser and enter this PIN
              </p>
            </div>

            {/* Huge PIN Card */}
            <div className="p-10 rounded-3xl bg-oxford-800 border-2 border-teal-brand/40 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#26B9A8_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
              <div className="font-mono text-7xl sm:text-9xl font-black tracking-[0.25em] text-gold-brand select-all">
                {activeSession.session_pin}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-300">
                <span>Podium Geofence: <strong>{activeSession.geofence_radius_meters}m</strong></span>
                <span>•</span>
                <span>Live Check-Ins: <strong>{presentCount} Present</strong></span>
              </div>
            </div>

            <button
              onClick={() => setShowProjectionModal(false)}
              className="px-6 py-3 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-sm transition-colors shadow-lg"
            >
              Return to Live Monitor
            </button>
          </div>
        </div>
      )}

      {/* GPS Troubleshooting Modal */}
      <GpsPermissionModal
        error={geoError}
        onRetry={() => setGeoError(null)}
        onClose={() => setGeoError(null)}
      />

      {/* QR Modals */}
      {activeSession && (
        <QrCameraScannerModal
          isOpen={showQrScannerModal}
          onClose={() => setShowQrScannerModal(false)}
          sessionId={activeSession.id}
          sessionTitle={activeCourse ? `${activeCourse.course_code}: ${activeCourse.title}` : 'Active Class Session'}
          onScanCompleted={() => refreshData()}
        />
      )}
    </div>
  );
};
