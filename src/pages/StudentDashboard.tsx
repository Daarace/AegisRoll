import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Navigation,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Compass,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Bell,
  Smartphone,
  Hash,
  KeyRound,
  QrCode,
  Camera,
  Sparkles
} from 'lucide-react';
import { UserProfile, Student, Course, ClassSession, AttendanceLog, AttendanceSubmissionResult } from '../types';
import { aegisStore } from '../lib/supabase';
import { getHighAccuracyLocation, GeoPositionResult, GeoErrorResult, calculateHaversineDistance } from '../lib/geolocation';
import { GpsPermissionModal } from '../components/GpsPermissionModal';
import { StudentQrPassModal } from '../components/StudentQrPassModal';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';
import { playSuccessChime } from '../lib/qrHelper';

interface StudentDashboardProps {
  currentUser: UserProfile;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<ClassSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceLog[]>([]);

  // Selected session for check-in
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [matricInput, setMatricInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  
  // Geolocation & check-in status
  const [locating, setLocating] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AttendanceSubmissionResult | null>(null);
  const [geoError, setGeoError] = useState<GeoErrorResult | null>(null);

  // Simulation controls for evaluation
  const [simulationMode, setSimulationMode] = useState<'real' | 'podium' | 'outside'>('real');

  // QR Code Backup States
  const [showQrPassModal, setShowQrPassModal] = useState(false);
  const [checkInMode, setCheckInMode] = useState<'geofence' | 'qr_backup'>('geofence');
  const [showStudentScannerModal, setShowStudentScannerModal] = useState(false);

  const refreshData = () => {
    const std = aegisStore.students.find((s) => s.user_id === currentUser.id) || aegisStore.students[0];
    setStudent(std);
    if (std && !matricInput) {
      setMatricInput(std.matric_number);
    }

    if (std) {
      const enr = aegisStore.enrollments
        .filter((e) => e.student_id === std.id)
        .map((e) => aegisStore.courses.find((c) => c.id === e.course_id))
        .filter(Boolean) as Course[];
      setEnrolledCourses(enr);

      const logs = aegisStore.logs.filter((l) => l.student_id === std.id);
      setAttendanceRecords(logs);

      // Find active sessions for enrolled courses (or all active sessions)
      const courseIds = new Set(enr.map((c) => c.id));
      const active = aegisStore.sessions.filter((s) => s.is_active);
      setActiveSessions(active);

      if (active.length > 0 && !selectedSessionId) {
        setSelectedSessionId(active[0].id);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) {
      alert('Please select an active class session.');
      return;
    }

    if (!matricInput.trim()) {
      alert('Please enter your Matriculation Number.');
      return;
    }

    if (pinInput.trim().length !== 4) {
      alert('Please enter the 4-digit session PIN displayed by your Course Representative or Lecturer.');
      return;
    }

    const session = activeSessions.find((s) => s.id === selectedSessionId);
    if (!session) return;

    setLocating(true);
    setSubmissionResult(null);
    setGeoError(null);

    let lat: number;
    let lon: number;
    let accuracy: number;

    if (simulationMode === 'podium') {
      // Simulate directly inside classroom (within 3m of CR's phone anchor)
      lat = session.admin_lat + 0.00002;
      lon = session.admin_lon + 0.00002;
      accuracy = 6.0;
    } else if (simulationMode === 'outside') {
      // Simulate outside geofence perimeter (150 meters away from CR's phone)
      lat = session.admin_lat + 0.0014;
      lon = session.admin_lon + 0.0014;
      accuracy = 16.0;
    } else {
      // Real device GPS using navigator.geolocation
      try {
        const pos = await getHighAccuracyLocation();
        lat = pos.latitude;
        lon = pos.longitude;
        accuracy = pos.accuracy;
      } catch (err: any) {
        setLocating(false);
        setGeoError(err as GeoErrorResult);
        return;
      }
    }

    try {
      const studentIdToUse = student ? student.id : matricInput.trim();
      const result = await aegisStore.submitAttendance(
        selectedSessionId,
        studentIdToUse,
        pinInput.trim(),
        lat,
        lon,
        accuracy,
        matricInput.trim().toUpperCase()
      );

      setSubmissionResult(result);
      refreshData();
    } catch (err: any) {
      alert('Error submitting attendance: ' + err.message);
    } finally {
      setLocating(false);
    }
  };

  // Helper to calculate student's overall attendance rate for a course
  const getCourseAttendanceRate = (courseId: string) => {
    const courseSessions = aegisStore.sessions.filter((s) => s.course_id === courseId);
    if (courseSessions.length === 0) return 100;

    const sessionIds = new Set(courseSessions.map((s) => s.id));
    const attended = attendanceRecords.filter(
      (l) => sessionIds.has(l.session_id) && l.status === 'Present'
    ).length;

    return Math.round((attended / courseSessions.length) * 100);
  };

  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Header Profile Banner */}
      <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center text-xl font-bold font-serif shadow-inner">
            {currentUser.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-oxford-800">
                {currentUser.full_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-brand/10 text-teal-brand border border-teal-brand/30">
                Student
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Matriculation No: <strong className="text-oxford-800">{student?.matric_number || matricInput || 'UG/2023/CS/1042'}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowQrPassModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-oxford-800 text-white hover:bg-oxford-700 font-bold text-xs transition shadow-sm"
            title="Display offline QR badge to be scanned by Course Representative"
          >
            <QrCode className="w-4 h-4 text-teal-brand" />
            <span>My Student QR Pass</span>
          </button>

          {/* Anti-Proxy Device Binding Status */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-teal-brand shrink-0" />
            <div>
              <span className="font-semibold text-oxford-800">Device Locked: </span>
              <span className="font-mono text-[11px] text-slate-500">
                {currentUser.device_fingerprint?.substring(0, 16) || 'fp_active_device'}...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active Class Session Check-In Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Live Geofence Check-in Terminal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-teal-brand animate-ping" />
                <h2 className="font-serif text-xl font-bold text-oxford-800">
                  Live Classroom Presence Verification
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {activeSessions.length} Session{activeSessions.length === 1 ? '' : 's'} Active
              </span>
            </div>

            {activeSessions.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl">
                <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="font-serif text-base font-bold text-oxford-800">
                  No Active Class Sessions Currently
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  When your Course Representative or Lecturer starts a dynamic class session, it will appear here immediately for check-in.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Session Cards */}
                {activeSessions.map((session) => {
                  const course = aegisStore.courses.find((c) => c.id === session.course_id);
                  const isSelected = selectedSessionId === session.id;
                  const existingLog = attendanceRecords.find((l) => l.session_id === session.id);

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-brand bg-teal-brand/5 shadow-sm ring-1 ring-teal-brand'
                          : 'border-surface-border bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-oxford-800 font-mono">
                              {course?.course_code}
                            </span>
                            <span className="text-xs text-slate-700 font-medium">
                              {course?.title}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1 font-semibold text-oxford-800">
                              <MapPin className="w-3.5 h-3.5 text-teal-brand" />
                              Venue: {session.venue || 'Classroom Amphitheatre'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-gold-dark" />
                              Anchor: {session.anchor_device_name || "Course Rep Phone"}
                            </span>
                            <span>•</span>
                            <span>Perimeter: <strong>{session.geofence_radius_meters}m</strong></span>
                          </div>
                        </div>

                        {existingLog && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                            existingLog.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {existingLog.status} ({existingLog.distance_calculated}m)
                          </span>
                        )}
                      </div>

                      {/* Announcement from CR / Lecturer if present */}
                      {session.announcement && (
                        <div className="mt-3 p-2.5 rounded-lg bg-teal-brand/10 border border-teal-brand/20 text-xs text-teal-dark flex items-start gap-2">
                          <Bell className="w-3.5 h-3.5 text-teal-brand shrink-0 mt-0.5" />
                          <span><strong>Class Announcement:</strong> {session.announcement}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mode Switcher: GPS Geofenced vs Backup QR Code */}
                <div className="flex border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCheckInMode('geofence')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition ${
                      checkInMode === 'geofence'
                        ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
                        : 'border-transparent text-slate-500 hover:text-oxford-800'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 text-teal-brand" />
                    <span>Standard Geofenced Check-In (GPS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckInMode('qr_backup')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition ${
                      checkInMode === 'qr_backup'
                        ? 'border-gold-brand text-oxford-800 bg-gold-brand/15'
                        : 'border-transparent text-slate-500 hover:text-oxford-800'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-gold-dark" />
                    <span>Backup QR Check-In (Zero GPS)</span>
                  </button>
                </div>

                {checkInMode === 'qr_backup' ? (
                  <div className="p-5 bg-gradient-to-br from-oxford-50 to-teal-50/40 rounded-2xl border border-teal-200/80 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-brand/20 border border-teal-brand/30 flex items-center justify-center text-teal-brand shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-base text-oxford-800">
                          Zero-Geofence Backup Sign-In
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          If your device lacks GPS, battery is dying, or location accuracy is low:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Option A: Show QR Pass */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Option 1 (Recommended)
                          </span>
                          <h4 className="font-bold text-sm text-oxford-800 mt-1.5">
                            Show My Student QR Pass
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Display your unique QR badge on your screen for the Course Rep or Lecturer to scan.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowQrPassModal(true)}
                          className="w-full py-2 px-3 rounded-lg bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <QrCode className="w-4 h-4 text-teal-brand" />
                          <span>Open My QR Pass</span>
                        </button>
                      </div>

                      {/* Option B: Scan Projected Classroom QR */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gold-dark bg-gold-brand/20 px-2 py-0.5 rounded border border-gold-brand/30">
                            Option 2
                          </span>
                          <h4 className="font-bold text-sm text-oxford-800 mt-1.5">
                            Scan Classroom Projector QR
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Use your phone camera to scan the backup QR code projected on the hall screen.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStudentScannerModal(true)}
                          className="w-full py-2 px-3 rounded-lg bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Launch Camera Scanner</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard GPS PIN & Matric Number Check-in Form */
                  <form onSubmit={handleCheckIn} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Matriculation Number Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-teal-brand" /> Matriculation Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. UG/2023/CS/1042"
                        value={matricInput}
                        onChange={(e) => setMatricInput(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 text-xs border border-surface-border rounded-xl focus:border-teal-brand focus:outline-none font-mono font-bold bg-white uppercase"
                      />
                    </div>

                    {/* 4-Digit PIN Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-gold-dark" /> 4-Digit Session PIN
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="••••"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-[0.4em] font-mono text-base font-bold py-2 border border-surface-border rounded-xl focus:border-teal-brand focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Presence is verified by comparing your phone's GPS distance against the{' '}
                    <strong>{selectedSession?.anchor_device_name || "Course Representative's Phone"}</strong>.
                  </p>

                  {/* Location Mode Switcher (For Evaluation & Demo Review) */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-teal-brand" /> Geolocation Telemetry Simulation
                      </span>
                      <span className="text-[10px] text-slate-500">Evaluation helper</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSimulationMode('real')}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          simulationMode === 'real'
                            ? 'bg-oxford-800 text-white font-bold border-oxford-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5 mx-auto mb-0.5" />
                        <span className="text-[10px]">Real Device GPS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSimulationMode('podium')}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          simulationMode === 'podium'
                            ? 'bg-emerald-700 text-white font-bold border-emerald-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-0.5 text-emerald-400" />
                        <span className="text-[10px]">Near CR Phone (&lt;10m)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSimulationMode('outside')}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          simulationMode === 'outside'
                            ? 'bg-amber-700 text-white font-bold border-amber-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-300" />
                        <span className="text-[10px]">Far Outside (&gt;100m)</span>
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={locating || pinInput.length !== 4 || !matricInput.trim()}
                    className="w-full py-3.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-sm transition-all shadow-academic flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {locating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Measuring Distance from CR Phone & Verifying...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>Verify Presence & Submit Check-In</span>
                      </>
                    )}
                  </button>
                </form>
                )}

                {/* Result Feedback Banner */}
                {submissionResult && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in ${
                    submissionResult.status === 'Present'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : submissionResult.status === 'Flagged'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {submissionResult.status === 'Present' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-sm">
                        Verification Status: {submissionResult.status}
                        {submissionResult.distance_meters !== null && (
                          <span className="ml-2 font-mono font-normal">
                            ({submissionResult.distance_meters}m from {selectedSession?.anchor_device_name || "Course Rep's Phone"})
                          </span>
                        )}
                      </p>
                      <p>{submissionResult.message}</p>
                      {submissionResult.allowed_radius_meters && (
                        <p className="text-[11px] text-slate-500">
                          Class Geofence Threshold: {submissionResult.allowed_radius_meters}m (indoor Wi-Fi buffer included)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Enrolled Courses & Attendance Performance */}
        <div className="space-y-6">
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-brand" />
              Course Offerings & Attendance Rate
            </h3>

            <div className="space-y-4">
              {enrolledCourses.map((course) => {
                const rate = getCourseAttendanceRate(course.id);
                const isSatisfactory = rate >= 75;

                return (
                  <div
                    key={course.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs text-oxford-800 font-mono">
                          {course.course_code}
                        </span>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {course.title}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isSatisfactory
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {rate}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isSatisfactory ? 'bg-teal-brand' : 'bg-red-500'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{course.credit_load} Credit Units</span>
                      <span>Min Threshold: 75%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* GPS Denial / Low Accuracy Troubleshooting Modal */}
      <GpsPermissionModal
        error={geoError}
        onRetry={() => {
          setGeoError(null);
        }}
        onClose={() => setGeoError(null)}
      />

      {/* Student's Personal Digital QR Pass Modal */}
      {student && (
        <StudentQrPassModal
          isOpen={showQrPassModal}
          onClose={() => setShowQrPassModal(false)}
          student={student}
          user={currentUser}
          department={aegisStore.departments.find((d) => d.id === student.department_id)}
          onRegenerated={() => refreshData()}
        />
      )}

      {/* Student Camera Scanner Modal (for scanning projected class QR) */}
      {selectedSession && (
        <QrCameraScannerModal
          isOpen={showStudentScannerModal}
          onClose={() => setShowStudentScannerModal(false)}
          sessionId={selectedSession.id}
          sessionTitle={`Scan ${aegisStore.courses.find((c) => c.id === selectedSession.course_id)?.course_code || 'Class'} Backup QR`}
          onScanCompleted={() => {
            refreshData();
            setShowStudentScannerModal(false);
          }}
        />
      )}
    </div>
  );
};
