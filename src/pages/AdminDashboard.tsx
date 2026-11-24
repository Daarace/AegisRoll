import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  FileCode,
  Plus,
  Upload,
  Search,
  Filter,
  Download,
  Building2,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Sparkles,
  X,
  Check,
  Calendar,
  Clock,
  MapPin,
  Smartphone,
  Navigation,
  Radio,
  KeyRound,
  Bell,
  RefreshCw,
  Edit3,
  Play,
  Square,
  Maximize2,
  Camera,
  QrCode,
  CreditCard,
  ScanLine,
  Lock,
  History,
  FileCheck
} from 'lucide-react';
import Papa from 'papaparse';
import {
  UserProfile,
  Department,
  Course,
  Student,
  Enrollment,
  ClassSchedule,
  ClassSession,
  AttendanceLog,
  AttendanceReportSummary,
  AttendanceStatus
} from '../types';
import { aegisStore, subscribeToSessionAttendance } from '../lib/supabase';
import { exportAttendanceToCSV, exportAttendanceToPDF, exportAttendanceToWord } from '../lib/exporters';
import { getHighAccuracyLocation, GeoErrorResult } from '../lib/geolocation';
import { GpsPermissionModal } from '../components/GpsPermissionModal';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';
import { StudentQrPassModal } from '../components/StudentQrPassModal';
import { BindIdCardModal } from '../components/BindIdCardModal';
import { RepSecurityModal } from '../components/RepSecurityModal';
import { CsvStudentImportModal } from '../components/CsvStudentImportModal';
import { DirectCardScannerModal, ScannedIdCardResult } from '../components/DirectCardScannerModal';
import { matchStudentByMatricOrShorthand } from '../lib/matricHelper';

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'schedules' | 'live_session' | 'courses' | 'departments' | 'students' | 'reports'>('schedules');

  // Security & Screen Lock states
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isRepUnlocked, setIsRepUnlocked] = useState(!aegisStore.isAdminLockEnabled());
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Department Management States
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptNameInput, setDeptNameInput] = useState('');
  const [deptCodeInput, setDeptCodeInput] = useState('');
  const [deptError, setDeptError] = useState<string | null>(null);

  // Institution / Campus Name Modal
  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
  const [institutionNameInput, setInstitutionNameInput] = useState(aegisStore.getInstitutionName());

  // Quick Roll Call by Matriculation Number (Course Rep exclusive)
  const [quickMatricInput, setQuickMatricInput] = useState('');
  const [quickMatricStatus, setQuickMatricStatus] = useState<AttendanceStatus>('Present');
  const [quickMatricFeedback, setQuickMatricFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [unregisteredMatricModal, setUnregisteredMatricModal] = useState<{ matric: string } | null>(null);
  const [unregisteredStudentName, setUnregisteredStudentName] = useState('');

  // Filter States for Reporting Engine
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Course Management Modals & States
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCredits, setNewCourseCredits] = useState(3);
  const [newCourseDeptId, setNewCourseDeptId] = useState(aegisStore.departments[0]?.id || '');
  const [newCourseLecturerId, setNewCourseLecturerId] = useState(
    aegisStore.users.find((u) => u.role === 'lecturer')?.id || ''
  );
  const [newCourseSemester, setNewCourseSemester] = useState('First Semester');
  const [newCourseAcademicYear, setNewCourseAcademicYear] = useState('2026/2027');
  const [autoEnrollDeptStudents, setAutoEnrollDeptStudents] = useState(true);

  // Class Schedule Modals & States
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [schedCourseId, setSchedCourseId] = useState(aegisStore.courses[0]?.id || '');
  const [schedDay, setSchedDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'>('Monday');
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('11:00');
  const [schedVenue, setSchedVenue] = useState('Lecture Hall A');

  // Start Session Modal / State (with Custom PIN & Venue)
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [sessionCourseId, setSessionCourseId] = useState(aegisStore.courses[0]?.id || '');
  const [sessionCustomPin, setSessionCustomPin] = useState('');
  const [sessionRadius, setSessionRadius] = useState<number>(75);
  const [sessionVenue, setSessionVenue] = useState('Lecture Hall A');
  const [sessionAnnouncement, setSessionAnnouncement] = useState('Attendance check-in is now active. Please remain seated.');
  const [sessionAutoCloseMins, setSessionAutoCloseMins] = useState(30);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [geoError, setGeoError] = useState<GeoErrorResult | null>(null);

  // Manual Mark Attendance (Fail-Safe) Modal State
  const [showManualMarkModal, setShowManualMarkModal] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Present');
  const [manualReason, setManualReason] = useState('Physically verified in classroom');
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  // Edit PIN Modal State
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  const [updatedPin, setUpdatedPin] = useState('');

  // Broadcast Announcement Modal State
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');

  // Dedicated "Manage Students Offering Course" Modal State
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<string>('');
  const [courseStudentSearch, setCourseStudentSearch] = useState<string>('');

  // Student CRUD Modals & States
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showDirectScannerForOnboard, setShowDirectScannerForOnboard] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvTargetCourseId, setCsvTargetCourseId] = useState<string | undefined>(undefined);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentMatric, setNewStudentMatric] = useState('');
  const [newStudentDeptId, setNewStudentDeptId] = useState(aegisStore.departments[0]?.id || '');
  const [selectedCoursesForNewStudent, setSelectedCoursesForNewStudent] = useState<string[]>([]);

  // Large Projection Modal
  const [showProjectionModal, setShowProjectionModal] = useState(false);

  // Backup QR Code & ID Card Modals
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [showSessionQrModal, setShowSessionQrModal] = useState(false);
  const [selectedStudentForQrModal, setSelectedStudentForQrModal] = useState<Student | null>(null);
  const [selectedStudentForBindModal, setSelectedStudentForBindModal] = useState<Student | null>(null);
  const [newStudentCustomQr, setNewStudentCustomQr] = useState<string>('');

  // Historical / Pre-Deployment Session Recorder State (Course Rep)
  const [showPastAttendanceModal, setShowPastAttendanceModal] = useState(false);
  const [pastCourseId, setPastCourseId] = useState<string>(() => aegisStore.courses[0]?.id || '');
  const [pastWeekLabel, setPastWeekLabel] = useState<string>('Week 1');
  const [pastDate, setPastDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [pastSelectedStudentIds, setPastSelectedStudentIds] = useState<string[]>([]);
  const [pastPasteMatricText, setPastPasteMatricText] = useState<string>('');
  const [pastNotes, setPastNotes] = useState<string>('Pre-deployment register entry verified by Course Representative');
  const [pastSuccessMessage, setPastSuccessMessage] = useState<string | null>(null);

  // Reactive Tick for immediate re-render
  const [tick, setTick] = useState(0);
  const triggerUpdate = () => setTick((t) => t + 1);

  // Find active session
  const activeSession = aegisStore.sessions.find((s) => s.is_active);

  // Subscribe to real-time events for active session
  useEffect(() => {
    if (!activeSession) return;
    const unsub = subscribeToSessionAttendance(activeSession.id, () => {
      triggerUpdate();
    });
    return () => unsub();
  }, [activeSession?.id]);

  // Compute Reporting Data
  const reportData = useMemo(() => {
    return aegisStore.getAttendanceReport({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      departmentId: selectedDeptId || undefined,
      courseId: selectedCourseId || undefined
    });
  }, [startDate, endDate, selectedDeptId, selectedCourseId, tick, aegisStore.enrollments.length]);

  // Filter reporting data by search
  const filteredReport = useMemo(() => {
    if (!searchQuery.trim()) return reportData;
    const q = searchQuery.toLowerCase();
    return reportData.filter(
      (r) =>
        r.matric_number.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.course_code.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  // Aggregate Metrics for Reporting
  const totalAuditedStudents = filteredReport.length;
  const avgAttendance =
    filteredReport.length > 0
      ? (
          filteredReport.reduce((acc, curr) => acc + curr.attendance_percentage, 0) /
          filteredReport.length
        ).toFixed(1)
      : '0.0';
  const flaggedCount = filteredReport.filter((r) => r.attendance_percentage < 75).length;

  // Export handlers
  const currentFilterMeta = {
    courseCode: aegisStore.courses.find((c) => c.id === selectedCourseId)?.course_code,
    courseTitle: aegisStore.courses.find((c) => c.id === selectedCourseId)?.title,
    departmentName: aegisStore.departments.find((d) => d.id === selectedDeptId)?.name,
    startDate,
    endDate
  };

  const handleExportCSV = () => {
    exportAttendanceToCSV(filteredReport, 'AegisRoll_Class_Attendance_Report.csv');
  };

  const handleExportPDF = () => {
    exportAttendanceToPDF(filteredReport, currentFilterMeta, 'AegisRoll_Official_Attendance_Audit.pdf');
  };

  const handleExportWord = () => {
    exportAttendanceToWord(filteredReport, currentFilterMeta, 'AegisRoll_Official_Attendance_Audit.docx');
  };

  // --- SCHEDULE ACTIONS ---

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCourseId || !schedVenue) return;
    aegisStore.createSchedule({
      course_id: schedCourseId,
      day_of_week: schedDay,
      start_time: schedStartTime,
      end_time: schedEndTime,
      venue: schedVenue.trim(),
      created_by: currentUser.id
    });
    setShowAddScheduleModal(false);
    triggerUpdate();
  };

  const handleDeleteSchedule = (schedId: string) => {
    if (confirm('Delete this scheduled class timetable entry?')) {
      aegisStore.deleteSchedule(schedId);
      triggerUpdate();
    }
  };

  const handleStartSessionFromSchedule = (schedule: ClassSchedule) => {
    setSessionCourseId(schedule.course_id);
    setSessionVenue(schedule.venue);
    setSessionCustomPin(Math.floor(1000 + Math.random() * 9000).toString());
    setShowStartSessionModal(true);
  };

  // --- HISTORICAL / PRE-DEPLOYMENT ATTENDANCE CONTROLS (COURSE REP) ---

  const handleOpenPastAttendanceModal = (courseId?: string) => {
    const cId = courseId || pastCourseId || aegisStore.courses[0]?.id || '';
    setPastCourseId(cId);
    const enrolledIds = aegisStore.enrollments
      .filter((e) => e.course_id === cId)
      .map((e) => e.student_id);
    setPastSelectedStudentIds(enrolledIds);
    setPastSuccessMessage(null);
    setPastPasteMatricText('');
    setShowPastAttendanceModal(true);
  };

  const handleApplyPastedMatrics = () => {
    if (!pastPasteMatricText.trim()) return;
    const tokens = pastPasteMatricText
      .split(/[\n,;\t ]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length >= 3);

    const cId = pastCourseId || aegisStore.courses[0]?.id;
    const matchedStudentIds: string[] = [];

    tokens.forEach((token) => {
      let matched = aegisStore.students.find(
        (s) => s.matric_number.toUpperCase() === token || s.matric_number.toUpperCase().includes(token)
      );
      if (!matched) {
        matched = matchStudentByMatricOrShorthand(token, aegisStore.students, cId, aegisStore.enrollments) || undefined;
      }
      if (matched && !matchedStudentIds.includes(matched.id)) {
        matchedStudentIds.push(matched.id);
      }
    });

    setPastSelectedStudentIds((prev) => Array.from(new Set([...prev, ...matchedStudentIds])));
  };

  const handleSavePastAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const cId = pastCourseId || aegisStore.courses[0]?.id;
    if (!cId) {
      alert('Please select a course for historical attendance.');
      return;
    }

    const enrolledStudents = aegisStore.enrollments
      .filter((e) => e.course_id === cId)
      .map((e) => aegisStore.students.find((s) => s.id === e.student_id))
      .filter(Boolean) as Student[];

    const allEnrolledIds = enrolledStudents.map((s) => s.id);
    const absentIds = allEnrolledIds.filter((id) => !pastSelectedStudentIds.includes(id));

    const course = aegisStore.courses.find((c) => c.id === cId);
    const lecturerId = course?.lecturer_id || currentUser.id;

    aegisStore.recordHistoricalSession({
      course_id: cId,
      lecturer_id: lecturerId,
      session_date: pastDate,
      week_label: pastWeekLabel,
      venue: 'Classroom (Pre-Deployment Register)',
      present_student_ids: pastSelectedStudentIds,
      absent_student_ids: absentIds,
      notes: pastNotes
    });

    triggerUpdate();
    setPastSuccessMessage(
      `✓ Successfully recorded historical attendance for ${course?.course_code || 'Course'} (${pastWeekLabel})! ${pastSelectedStudentIds.length} students marked Present, ${absentIds.length} marked Absent. Historical attendance is now saved in the system and included in all audit exports.`
    );
  };

  // --- SESSION CONTROLS & GEOFENCE RECALIBRATION ---

  const handleLaunchSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCourseId) return;

    setIsStartingSession(true);
    let lat = 40.712776;
    let lon = -74.005974;

    try {
      const pos = await getHighAccuracyLocation();
      lat = pos.latitude;
      lon = pos.longitude;
    } catch (err: any) {
      console.warn("Using CR's classroom reference GPS anchor:", err);
    }

    const pinToUse =
      sessionCustomPin && sessionCustomPin.trim().length === 4
        ? sessionCustomPin.trim()
        : Math.floor(1000 + Math.random() * 9000).toString();

    aegisStore.createSession({
      course_id: sessionCourseId,
      lecturer_id: currentUser.id, // Class Rep anchors the session
      admin_lat: lat,
      admin_lon: lon,
      geofence_radius_meters: sessionRadius,
      custom_pin: pinToUse,
      venue: sessionVenue,
      announcement: sessionAnnouncement,
      auto_close_minutes: sessionAutoCloseMins,
      anchor_device_name: "Course Representative's Phone"
    });

    setIsStartingSession(false);
    setShowStartSessionModal(false);
    setActiveTab('live_session');
    setShowProjectionModal(true);
    triggerUpdate();
  };

  const handleRecalibrateAnchor = async () => {
    if (!activeSession) return;
    try {
      const pos = await getHighAccuracyLocation();
      aegisStore.recalibrateSessionAnchor(
        activeSession.id,
        pos.latitude,
        pos.longitude,
        "Course Representative's Phone (Recalibrated)"
      );
      alert(`Geofence successfully recalibrated to your phone's live GPS coordinates! (${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)})`);
      triggerUpdate();
    } catch (err: any) {
      alert("Unable to fetch phone GPS: " + (err.message || 'Please enable location permissions.'));
    }
  };

  const handleUpdatePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || updatedPin.trim().length !== 4) return;
    aegisStore.updateSessionPin(activeSession.id, updatedPin.trim());
    setShowEditPinModal(false);
    setUpdatedPin('');
    triggerUpdate();
  };

  const handleBroadcastAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    aegisStore.setSessionAnnouncement(activeSession.id, broadcastText);
    setShowAnnouncementModal(false);
    setBroadcastText('');
    triggerUpdate();
  };

  const handleEndLiveSession = () => {
    if (!activeSession) return;
    if (confirm('Conclude active class attendance session? Students will no longer be able to check in.')) {
      aegisStore.endSession(activeSession.id);
      triggerUpdate();
    }
  };

  // --- MANUAL ATTENDANCE (FAIL-SAFE) ---

  const handleManualMarkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !manualStudentId) return;
    aegisStore.manuallyMarkAttendance(
      activeSession.id,
      manualStudentId,
      manualStatus,
      manualReason.trim() || 'Manual sign-in authorized by Class Representative',
      'Course Representative (Fail-Safe)'
    );
    setShowManualMarkModal(false);
    setManualStudentId('');
    setManualReason('Student phone battery depleted - physically verified in class');
    triggerUpdate();
  };

  // --- DEPARTMENT MANAGEMENT ---

  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    if (!deptNameInput.trim() || !deptCodeInput.trim()) {
      setDeptError('Department Name and Code are required.');
      return;
    }

    if (editingDept) {
      aegisStore.updateDepartment(editingDept.id, deptNameInput, deptCodeInput);
    } else {
      aegisStore.addDepartment(deptNameInput, deptCodeInput);
    }

    setShowAddDeptModal(false);
    setEditingDept(null);
    setDeptNameInput('');
    setDeptCodeInput('');
    triggerUpdate();
  };

  const handleDeleteDepartment = (id: string) => {
    if (confirm('Delete this department?')) {
      const res = aegisStore.deleteDepartment(id);
      if (!res.success) {
        alert(res.message);
      } else {
        triggerUpdate();
      }
    }
  };

  // --- INSTITUTION NAME ---

  const handleSaveInstitutionName = (e: React.FormEvent) => {
    e.preventDefault();
    aegisStore.setInstitutionName(institutionNameInput);
    setShowInstitutionModal(false);
    triggerUpdate();
  };

  // --- QUICK MANUAL ROLL CALL BY MATRIC NUMBER ---

  const handleQuickMatricSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setQuickMatricFeedback(null);
    let clean = quickMatricInput.trim().toUpperCase();
    if (!clean) return;

    // Dynamically match student by full matric, 4-digit serial (entry mode 1/2 + 3 digits), or dept+serial
    const matched = matchStudentByMatricOrShorthand(
      clean,
      aegisStore.students,
      activeSession.course_id,
      aegisStore.enrollments
    );

    if (matched) {
      clean = matched.matric_number;
    } else if (/^\d{4}$/.test(clean)) {
      // Dynamic prefix derived from active course's department & entry year
      const course = aegisStore.courses.find((c) => c.id === activeSession.course_id);
      const dept = course ? aegisStore.departments.find((d) => d.id === course.department_id) : null;
      const deptCode = dept ? dept.code.toUpperCase() : (aegisStore.departments[0]?.code || 'GEN');
      const year = new Date().getFullYear().toString().slice(-2);
      clean = `U${year}${deptCode}${clean}`;
    }

    const existingStudent = aegisStore.students.find(
      (st) => st.matric_number.toUpperCase() === clean
    );

    if (!existingStudent) {
      setUnregisteredMatricModal({ matric: clean });
      setUnregisteredStudentName('');
      return;
    }

    const res = aegisStore.markAttendanceByMatricNumber(
      activeSession.id,
      clean,
      quickMatricStatus,
      undefined,
      currentUser.full_name
    );

    setQuickMatricFeedback(res);
    setQuickMatricInput('');
    triggerUpdate();
  };

  const handleConfirmUnregisteredStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !unregisteredMatricModal) return;

    const res = aegisStore.markAttendanceByMatricNumber(
      activeSession.id,
      unregisteredMatricModal.matric,
      quickMatricStatus,
      unregisteredStudentName.trim() || undefined,
      currentUser.full_name
    );

    setQuickMatricFeedback(res);
    setUnregisteredMatricModal(null);
    setUnregisteredStudentName('');
    setQuickMatricInput('');
    triggerUpdate();
  };

  // --- COURSE CRUD ACTIONS ---

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseTitle) return;

    const newCourse: Course = {
      id: 'crs-' + Math.random().toString(36).substring(2, 9),
      course_code: newCourseCode.trim().toUpperCase(),
      title: newCourseTitle.trim(),
      credit_load: Number(newCourseCredits) || 3,
      department_id: newCourseDeptId,
      lecturer_id: newCourseLecturerId || aegisStore.users.find((u) => u.role === 'lecturer')?.id
    };

    aegisStore.courses.push(newCourse);

    if (autoEnrollDeptStudents) {
      const deptStudents = aegisStore.students.filter((s) => s.department_id === newCourseDeptId);
      deptStudents.forEach((st) => {
        aegisStore.enrollments.push({
          id: 'enr-' + Math.random().toString(36).substring(2, 9),
          student_id: st.id,
          course_id: newCourse.id,
          semester: newCourseSemester,
          academic_year: newCourseAcademicYear
        });
      });
    }

    aegisStore.save();
    setNewCourseCode('');
    setNewCourseTitle('');
    setNewCourseCredits(3);
    setShowAddCourseModal(false);
    triggerUpdate();
  };

  const handleDeleteCourse = (courseId: string, courseCode: string) => {
    if (confirm(`Are you sure you want to delete course ${courseCode}? All associated enrollments will also be removed.`)) {
      aegisStore.courses = aegisStore.courses.filter((c) => c.id !== courseId);
      aegisStore.enrollments = aegisStore.enrollments.filter((e) => e.course_id !== courseId);
      aegisStore.schedules = aegisStore.schedules.filter((s) => s.course_id !== courseId);
      aegisStore.save();
      triggerUpdate();
    }
  };

  // --- ENROLLED STUDENTS IN COURSE ---

  const enrolledStudentsInManagingCourse = useMemo(() => {
    if (!managingCourse) return [];
    return aegisStore.enrollments
      .filter((e) => e.course_id === managingCourse.id)
      .map((e) => {
        const student = aegisStore.students.find((s) => s.id === e.student_id);
        const user = student ? aegisStore.users.find((u) => u.id === student.user_id) : null;
        const dept = student ? aegisStore.departments.find((d) => d.id === student.department_id) : null;

        const courseSessions = aegisStore.sessions.filter((s) => s.course_id === managingCourse.id);
        const total = courseSessions.length;
        const sessionIds = new Set(courseSessions.map((s) => s.id));
        const attended = student
          ? aegisStore.logs.filter((l) => sessionIds.has(l.session_id) && l.student_id === student.id && l.status === 'Present').length
          : 0;
        const rate = total > 0 ? (attended / total) * 100 : 100;

        return {
          enrollmentId: e.id,
          student,
          user,
          dept,
          totalSessions: total,
          attendedSessions: attended,
          attendanceRate: rate
        };
      })
      .filter((item) => Boolean(item.student));
  }, [managingCourse, tick, aegisStore.enrollments.length]);

  const eligibleStudentsForManagingCourse = useMemo(() => {
    if (!managingCourse) return [];
    const enrolledIds = new Set(
      aegisStore.enrollments
        .filter((e) => e.course_id === managingCourse.id)
        .map((e) => e.student_id)
    );

    return aegisStore.students
      .filter((st) => !enrolledIds.has(st.id))
      .map((st) => {
        const user = aegisStore.users.find((u) => u.id === st.user_id);
        const dept = aegisStore.departments.find((d) => d.id === st.department_id);
        return { student: st, user, dept };
      });
  }, [managingCourse, tick, aegisStore.enrollments.length]);

  const filteredEnrolledStudents = useMemo(() => {
    if (!courseStudentSearch.trim()) return enrolledStudentsInManagingCourse;
    const q = courseStudentSearch.toLowerCase();
    return enrolledStudentsInManagingCourse.filter(
      (item) =>
        item.student?.matric_number.toLowerCase().includes(q) ||
        item.user?.full_name.toLowerCase().includes(q)
    );
  }, [enrolledStudentsInManagingCourse, courseStudentSearch]);

  const handleEnrollStudentInManagingCourse = () => {
    if (!managingCourse || !selectedStudentToEnroll) return;
    const res = aegisStore.enrollStudentInCourse(selectedStudentToEnroll, managingCourse.id);
    if (res.success) {
      setSelectedStudentToEnroll('');
      triggerUpdate();
    } else {
      alert(res.message);
    }
  };

  const handleUnenrollStudentFromManagingCourse = (studentId: string, matricNo: string) => {
    if (!managingCourse) return;
    if (confirm(`Remove student (${matricNo}) from offering ${managingCourse.course_code}?`)) {
      aegisStore.unenrollStudentFromCourse(studentId, managingCourse.id);
      triggerUpdate();
    }
  };

  // --- STUDENT CRUD ACTIONS ---

  const handleDirectScannerResult = (result: ScannedIdCardResult) => {
    setShowDirectScannerForOnboard(false);
    const raw = (result.rawCode || '').trim();
    if (!raw) return;

    // Check if student already exists in the roster by card token or matric
    const cleanRaw = raw.toUpperCase();
    const existing = aegisStore.students.find(
      (s) =>
        s.qr_code_id === raw ||
        (s.qr_code_id && s.qr_code_id.toUpperCase() === cleanRaw) ||
        (result.matricNumber && s.matric_number.toUpperCase() === result.matricNumber.toUpperCase())
    );

    if (existing) {
      const user = aegisStore.users.find((u) => u.id === existing.user_id);
      alert(`Card Already Registered: This card is already bound to "${user?.full_name || 'Student'}" (${existing.matric_number}).`);
      return;
    }

    // Always capture the raw card content into the Physical ID Card QR field
    setNewStudentCustomQr(raw);

    // If the scanned code also contained an actual matriculation number:
    if (result.matricNumber) {
      setNewStudentMatric(result.matricNumber);
      if (result.studentName) {
        setNewStudentName(result.studentName);
      } else {
        setNewStudentName(`Student (${result.matricNumber})`);
      }
      setNewStudentEmail(`${result.matricNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.edu`);
    } else {
      // If arbitrary card token, do not pollute matric field with random characters
      if (!newStudentMatric) {
        setNewStudentMatric('');
      }
    }

    // Auto-select department if detected
    if (result.deptCode) {
      const matchedDept = aegisStore.departments.find(
        (d) => d.code.toUpperCase() === result.deptCode?.toUpperCase()
      );
      if (matchedDept) setNewStudentDeptId(matchedDept.id);
    } else if (aegisStore.departments.length > 0) {
      setNewStudentDeptId(aegisStore.departments[0].id);
    }

    setSelectedCoursesForNewStudent(aegisStore.courses.map((c) => c.id));
    setShowAddStudentModal(true);
  };

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentEmail || !newStudentMatric) return;

    let cleanMatric = newStudentMatric.trim().toUpperCase();
    if (/^\d{4}$/.test(cleanMatric)) {
      const selectedDept = aegisStore.departments.find((d) => d.id === newStudentDeptId);
      const deptCode = selectedDept ? selectedDept.code.toUpperCase() : 'GEN';
      const year = new Date().getFullYear().toString().slice(-2);
      cleanMatric = `U${year}${deptCode}${cleanMatric}`;
    }

    const existingMatric = aegisStore.students.find(
      (s) => s.matric_number.toUpperCase() === cleanMatric
    );
    if (existingMatric) {
      alert(`Student with matriculation number ${cleanMatric} already exists.`);
      return;
    }

    const newUser: UserProfile = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      email: newStudentEmail.trim(),
      full_name: newStudentName.trim(),
      role: 'student'
    };
    aegisStore.users.push(newUser);

    const qrToUse = newStudentCustomQr.trim() || ('AR-QR-' + cleanMatric.replace(/[^A-Za-z0-9]/g, ''));
    const newStd: Student = {
      id: 'std-' + Math.random().toString(36).substring(2, 9),
      user_id: newUser.id,
      matric_number: cleanMatric,
      department_id: newStudentDeptId,
      qr_code_id: qrToUse
    };
    aegisStore.students.push(newStd);

    selectedCoursesForNewStudent.forEach((courseId) => {
      aegisStore.enrollments.push({
        id: 'enr-' + Math.random().toString(36).substring(2, 9),
        student_id: newStd.id,
        course_id: courseId,
        semester: 'First Semester',
        academic_year: '2026/2027'
      });
    });

    aegisStore.save();
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentMatric('');
    setNewStudentCustomQr('');
    setSelectedCoursesForNewStudent([]);
    setShowAddStudentModal(false);
    triggerUpdate();
  };

  // Students eligible for manual mark-in in active session
  const activeCourse = activeSession ? aegisStore.courses.find((c) => c.id === activeSession.course_id) : null;
  const activeSessionLogs = activeSession ? aegisStore.logs.filter((l) => l.session_id === activeSession.id) : [];

  const studentsEligibleForManualMark = useMemo(() => {
    if (!activeSession) return [];
    const courseEnrollments = aegisStore.enrollments.filter((e) => e.course_id === activeSession.course_id);
    const enrolledStudents = courseEnrollments.map((e) => {
      const student = aegisStore.students.find((s) => s.id === e.student_id);
      const user = student ? aegisStore.users.find((u) => u.id === student.user_id) : null;
      const log = activeSessionLogs.find((l) => l.student_id === student?.id);
      return { student, user, log };
    }).filter((item) => Boolean(item.student));

    if (!manualSearchQuery.trim()) return enrolledStudents;
    const q = manualSearchQuery.toLowerCase();
    return enrolledStudents.filter(
      (item) =>
        item.student?.matric_number.toLowerCase().includes(q) ||
        item.user?.full_name.toLowerCase().includes(q)
    );
  }, [activeSession, activeSessionLogs, manualSearchQuery, tick]);

  if (!isRepUnlocked) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="p-8 bg-surface-card rounded-2xl border border-surface-border shadow-academic-lg text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center mx-auto mb-4 shadow-md">
            <Lock className="w-8 h-8 text-teal-brand" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-oxford-800 mb-1">
            Course Rep Portal Locked
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Anti-tamper protection active. Enter the Course Representative password or PIN to access live sessions, rosters, and attendance logs.
          </p>

          {unlockError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{unlockError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUnlockError(null);
              const valid = aegisStore.verifyUserPassword(currentUser.id, unlockPassword);
              if (valid) {
                setIsRepUnlocked(true);
              } else {
                setUnlockError('Incorrect password or PIN.');
              }
            }}
            className="space-y-4"
          >
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter Course Rep Password or PIN"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors shadow-academic flex items-center justify-center gap-2"
            >
              <span>Unlock Admin Hub</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-oxford-800 text-teal-brand border border-teal-brand/30 flex items-center justify-center text-xl font-bold font-serif shadow-inner">
            <ShieldAlert className="w-7 h-7 text-teal-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-oxford-800">
                Course Representative Administration & Geofence Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-brand/10 text-teal-dark border border-teal-brand/30">
                Course Rep (Admin)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Class timetables, mobile geofence anchoring, manual attendance fail-safes, and course roster controls
            </p>
          </div>
        </div>

        {/* Workaround 1 Vault Controls & Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setInstitutionNameInput(aegisStore.getInstitutionName());
              setShowInstitutionModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-oxford-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors font-semibold shadow-sm"
            title="Configure University / Faculty Name"
          >
            <Building2 className="w-3.5 h-3.5 text-teal-brand" /> Campus Name
          </button>

          <button
            onClick={() => handleOpenPastAttendanceModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-oxford-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors font-semibold shadow-sm"
            title="Record historical / pre-deployment attendance for past weeks"
          >
            <History className="w-3.5 h-3.5 text-teal-brand" /> Log Past Weeks
          </button>

          <button
            onClick={() => setShowSecurityModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-oxford-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors font-semibold shadow-sm"
            title="Change Course Rep master password or PIN"
          >
            <KeyRound className="w-3.5 h-3.5 text-teal-brand" /> Rep Password
          </button>

          {aegisStore.isAdminLockEnabled() && (
            <button
              onClick={() => {
                setIsRepUnlocked(false);
                setUnlockPassword('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors font-semibold shadow-sm"
              title="Lock Admin Dashboard immediately"
            >
              <Lock className="w-3.5 h-3.5 text-red-600" /> Lock Screen
            </button>
          )}

          <button
            onClick={() => {
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
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors font-semibold shadow-sm"
            title="Download complete database backup (Workaround 1)"
          >
            <Download className="w-3.5 h-3.5" /> Backup Vault (JSON)
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-oxford-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors font-semibold shadow-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-teal-brand" /> Restore
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result as string;
                  const res = aegisStore.importVaultData(content);
                  alert(res.message);
                  if (res.success) {
                    triggerUpdate();
                    window.location.reload();
                  }
                };
                reader.readAsText(file);
              }}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              if (confirm('Clear all stored courses, departments, students, and attendance records from this browser vault?')) {
                aegisStore.clearAllData();
                window.location.reload();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors font-semibold shadow-sm"
            title="Clear all records and start completely clean"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Data
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Class Schedules ({aegisStore.schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('live_session')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'live_session'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <Radio className="w-4 h-4 text-teal-brand animate-pulse" />
          <span>Live Session Proctor {activeSession && '(Active)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'courses'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Courses ({aegisStore.courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'departments'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments ({aegisStore.departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'students'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student Roster ({aegisStore.students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-teal-brand text-teal-dark bg-teal-brand/10'
              : 'border-transparent text-slate-500 hover:text-oxford-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Attendance Audits & Exports</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLASS SCHEDULES & TIMETABLE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-border">
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-brand" />
                  Academic Class Timetable & Schedule Initiator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage recurring class times and days. Launch live attendance directly from any scheduled class with your phone as the GPS anchor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPastAttendanceModal()}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-oxford-800 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-200 shadow-sm shrink-0"
                  title="Record pre-deployment or past weeks attendance from paper register"
                >
                  <History className="w-4 h-4 text-oxford-600" /> Log Past Weeks
                </button>
                <button
                  onClick={() => setShowAddScheduleModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Class Schedule
                </button>
              </div>
            </div>

            {/* Timetable Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {aegisStore.schedules.map((schedule) => {
                const course = aegisStore.courses.find((c) => c.id === schedule.course_id);
                const enrolledCount = aegisStore.enrollments.filter((e) => e.course_id === schedule.course_id).length;
                const isSessionActiveForCourse = activeSession && activeSession.course_id === schedule.course_id;

                return (
                  <div
                    key={schedule.id}
                    className="p-5 rounded-2xl border border-surface-border bg-slate-50/50 hover:bg-white hover:shadow-academic transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-oxford-800 text-gold-brand font-mono">
                          {schedule.day_of_week}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-teal-brand" />
                          {schedule.start_time} - {schedule.end_time}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-bold text-base text-oxford-800 font-mono">
                          {course?.course_code}
                        </h4>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">
                          {course?.title}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-teal-brand shrink-0" />
                        <span className="font-medium text-slate-700 truncate">{schedule.venue}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {enrolledCount} Students Enrolled Offering This Course
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Delete schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {isSessionActiveForCourse ? (
                        <button
                          onClick={() => setActiveTab('live_session')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <Radio className="w-3.5 h-3.5 animate-ping" />
                          <span>Session In Progress</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartSessionFromSchedule(schedule)}
                          className="px-3.5 py-1.5 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 text-teal-brand fill-teal-brand" />
                          <span>Start Attendance Session</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE GEOFENCE SESSION PROCTOR & FAIL-SAFE                          */}
      {/* ========================================================================= */}
      {activeTab === 'live_session' && (
        <div className="space-y-6">
          {!activeSession ? (
            <div className="bg-surface-card rounded-2xl p-10 text-center shadow-academic border border-surface-border space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-oxford-800 text-teal-brand flex items-center justify-center mx-auto shadow-md">
                <Radio className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-oxford-800">
                No Active Class Attendance Session
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Launch an ad-hoc session or start attendance directly from your timetable schedules. 
                Your smartphone's GPS will act as the dynamic geofence anchor for the classroom.
              </p>
              <button
                onClick={() => {
                  setSessionCustomPin(Math.floor(1000 + Math.random() * 9000).toString());
                  setShowStartSessionModal(true);
                }}
                className="px-6 py-3 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors shadow-academic inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-oxford-900" />
                <span>Launch Dynamic Geofenced Session</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Session Control Toolbar */}
              <div className="bg-oxford-800 text-white rounded-2xl p-6 shadow-academic-lg border border-oxford-700 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-teal-brand animate-ping" />
                      <span className="font-mono text-xl font-extrabold text-teal-brand">
                        {activeCourse?.course_code}
                      </span>
                      <span className="text-lg font-serif font-bold text-white">
                        • {activeCourse?.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                      <span>Venue: <strong>{activeSession.venue || 'Lecture Hall'}</strong></span>
                      <span>•</span>
                      <span>Perimeter: <strong>{activeSession.geofence_radius_meters}m</strong></span>
                      <span>•</span>
                      <span>Anchor: <strong className="text-gold-brand">{activeSession.anchor_device_name || "CR's Phone"}</strong></span>
                    </p>
                  </div>

                  {/* Big PIN Display & Buttons */}
                  <div className="flex items-center gap-3">
                    <div className="bg-oxford-900 border border-teal-brand/40 px-4 py-2 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                        Session PIN
                      </span>
                      <span className="font-mono text-2xl font-black tracking-widest text-gold-brand">
                        {activeSession.session_pin}
                      </span>
                    </div>

                    <button
                      onClick={() => setShowProjectionModal(true)}
                      className="p-2.5 rounded-xl bg-oxford-700 hover:bg-oxford-600 text-teal-brand"
                      title="Project Large PIN in Class"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => {
                        setUpdatedPin(activeSession.session_pin);
                        setShowEditPinModal(true);
                      }}
                      className="p-2.5 rounded-xl bg-oxford-700 hover:bg-oxford-600 text-white"
                      title="Set Custom PIN for Session"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={handleEndLiveSession}
                      className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Square className="w-4 h-4" /> End
                    </button>
                  </div>
                </div>

                {/* Fail-Safe Control Strip: Recalibrate GPS Anchor & Manual Mark In */}
                <div className="pt-3 border-t border-oxford-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* CR Phone GPS Recalibration Fail-Safe Button */}
                    <button
                      onClick={handleRecalibrateAnchor}
                      className="px-3.5 py-2 rounded-xl bg-teal-brand/20 hover:bg-teal-brand/30 border border-teal-brand/40 text-teal-brand font-bold flex items-center gap-1.5 transition-colors"
                      title="Use live phone location if class moved rooms"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Recalibrate Geofence to My Live Phone Location</span>
                    </button>

                    {/* QR Code Offline Backup Scanner */}
                    <button
                      onClick={() => setShowQrScannerModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Scan student digital QR passes or 32-character ID cards with camera"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Scan Student Cards / Passes</span>
                    </button>

                    {/* Announcement Broadcast */}
                    <button
                      onClick={() => {
                        setBroadcastText(activeSession.announcement || '');
                        setShowAnnouncementModal(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-oxford-700 hover:bg-oxford-600 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-gold-brand" />
                      <span>Broadcast Notice</span>
                    </button>
                  </div>

                  {/* Manual Mark In (Fail-Safe) Button */}
                  <button
                    onClick={() => {
                      setManualStudentId('');
                      setShowManualMarkModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-gold-brand hover:bg-gold-light text-oxford-900 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <UserPlus className="w-4 h-4 text-oxford-900" />
                    <span>Select Student from List</span>
                  </button>
                </div>
              </div>

              {/* Course Rep Exclusive: Quick Manual Roll Call by Matriculation Number */}
              {currentUser.role === 'admin' && (
                <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-teal-brand/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-brand/10 text-teal-dark flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-teal-brand" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-oxford-800 flex items-center gap-2">
                          <span>Quick Roll Call by Matriculation Number</span>
                          <span className="text-[10px] bg-teal-brand/10 text-teal-dark px-2 py-0.5 rounded-full font-semibold border border-teal-brand/30">
                            Course Rep Only
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Type student matriculation number and press Enter to mark attendance instantly.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleQuickMatricSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        placeholder="Enter Matric No. or 4-digit serial (e.g. U24MTH1019 or 1019)..."
                        value={quickMatricInput}
                        onChange={(e) => setQuickMatricInput(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase rounded-xl border border-surface-border bg-white text-oxford-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-brand"
                      />
                    </div>

                    <select
                      value={quickMatricStatus}
                      onChange={(e) => setQuickMatricStatus(e.target.value as AttendanceStatus)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-surface-border bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-brand"
                    >
                      <option value="Present">Present</option>
                      <option value="Flagged">Flagged / Late</option>
                      <option value="Absent">Absent</option>
                    </select>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark Attendance</span>
                    </button>
                  </form>

                  {/* Feedback Message */}
                  {quickMatricFeedback && (
                    <div
                      className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                        quickMatricFeedback.success
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {quickMatricFeedback.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span>{quickMatricFeedback.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Roster & Distance Telemetry from CR's Phone */}
              <div className="bg-surface-card rounded-2xl shadow-academic border border-surface-border overflow-hidden">
                <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-teal-brand animate-pulse" />
                      Enrolled Student Presence & CR Phone Distance Telemetry
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Physical presence quantified by terrestrial distance from <strong>Course Representative's Phone</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      {activeSessionLogs.filter((l) => l.status === 'Present').length} Verified Present
                    </span>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {activeSessionLogs.filter((l) => l.status === 'Flagged').length} Flagged
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Matric No.</th>
                        <th className="py-3 px-4">Check-In Time</th>
                        <th className="py-3 px-4">Distance from CR Phone</th>
                        <th className="py-3 px-4">Verification Source</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Quick Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {studentsEligibleForManualMark.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No enrolled students found for this course.
                          </td>
                        </tr>
                      ) : (
                        studentsEligibleForManualMark.map((item) => {
                          const log = item.log;
                          const hasCheckedIn = Boolean(log);
                          const isPresent = log?.status === 'Present';
                          const isManual = log?.marked_by && log.marked_by !== 'geofence_auto';

                          return (
                            <tr key={item.student!.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 font-semibold text-oxford-800">
                                {item.user?.full_name || 'N/A'}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-oxford-800">
                                {item.student?.matric_number}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                {log ? new Date(log.checked_in_at).toLocaleTimeString() : 'Not Yet'}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold">
                                {log ? (
                                  <span
                                    className={
                                      log.distance_calculated > activeSession.geofence_radius_meters
                                        ? 'text-red-600'
                                        : 'text-emerald-700'
                                    }
                                  >
                                    {log.distance_calculated}m from CR
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">Pending</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {isManual ? (
                                  <span className="text-gold-dark font-semibold">
                                    Manual (Fail-Safe)
                                  </span>
                                ) : log ? (
                                  <span>Automated Geofence</span>
                                ) : (
                                  <span className="text-slate-400">--</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {log ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                      isPresent
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {isPresent ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                    {log.status}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Unchecked</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {log?.status === 'Flagged' ? (
                                    <button
                                      onClick={() => aegisStore.overrideAttendanceStatus(log.id, 'Present')}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                    >
                                      Approve
                                    </button>
                                  ) : !log ? (
                                    <button
                                      onClick={() => {
                                        setManualStudentId(item.student!.id);
                                        setShowManualMarkModal(true);
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-oxford-800 bg-slate-100 hover:bg-teal-brand/20 rounded-lg transition-colors"
                                    >
                                      Mark Present
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => aegisStore.overrideAttendanceStatus(log.id, 'Flagged')}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                                    >
                                      Flag
                                    </button>
                                  )}
                                </div>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COURSES & STUDENT ALLOCATIONS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-border">
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-brand" />
                  Academic Course Catalog & Enrollments
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click <strong className="text-oxford-800">"Manage Students"</strong> on any course to enroll, drop, or inspect students offering that course
                </p>
              </div>

              <button
                onClick={() => setShowAddCourseModal(true)}
                className="px-4 py-2.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Add New Course
              </button>
            </div>

            {/* Courses Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Course Code</th>
                    <th className="py-3.5 px-4">Course Title</th>
                    <th className="py-3.5 px-4 text-center">Credit Load</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Assigned Lecturer</th>
                    <th className="py-3.5 px-4 text-center">Students Offering</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {aegisStore.courses.map((course) => {
                    const dept = aegisStore.departments.find((d) => d.id === course.department_id);
                    const lec = aegisStore.users.find((u) => u.id === course.lecturer_id);
                    const enrolledCount = aegisStore.enrollments.filter((e) => e.course_id === course.id).length;

                    return (
                      <tr key={course.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-oxford-800">
                          {course.course_code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-oxford-800 max-w-xs">
                          {course.title}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {course.credit_load} Units
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {dept?.code} ({dept?.name.replace('Department of ', '')})
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {lec?.full_name || 'Unassigned Lecturer'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setManagingCourse(course);
                              setSelectedStudentToEnroll('');
                              setCourseStudentSearch('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-brand/10 hover:bg-teal-brand/20 text-teal-dark border border-teal-brand/30 font-bold transition-all group"
                          >
                            <Users className="w-3.5 h-3.5 text-teal-brand group-hover:scale-110 transition-transform" />
                            <span>{enrolledCount} Enrolled</span>
                            <span className="text-[10px] uppercase font-semibold text-teal-brand ml-1">
                              • Manage
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setManagingCourse(course);
                                setSelectedStudentToEnroll('');
                                setCourseStudentSearch('');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-oxford-800 hover:bg-oxford-700 text-white rounded-lg transition-colors flex items-center gap-1"
                              title="Manage students offering this course"
                            >
                              <Users className="w-3 h-3 text-teal-brand" /> Manage
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(course.id, course.course_code)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Course"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ACADEMIC DEPARTMENTS & FACULTIES                                    */}
      {/* ========================================================================= */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-border">
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-brand" />
                  Academic Departments & Faculties
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your university departments and faculties. Courses and student rosters are linked to departments.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingDept(null);
                  setDeptNameInput('');
                  setDeptCodeInput('');
                  setDeptError(null);
                  setShowAddDeptModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </div>

            {/* Department List */}
            {aegisStore.departments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-oxford-800" />
                <p className="font-semibold text-oxford-800 text-sm">No departments created yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click "Add Department" above to create your first academic department (e.g. Computer Science, Electrical Engineering).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-oxford-800/5 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-surface-border">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3 text-center">Courses</th>
                      <th className="px-4 py-3 text-center">Enrolled Students</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {aegisStore.departments.map((dept) => {
                      const coursesCount = aegisStore.courses.filter((c) => c.department_id === dept.id).length;
                      const studentsCount = aegisStore.students.filter((s) => s.department_id === dept.id).length;
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-oxford-800">
                            <span className="px-2 py-0.5 rounded bg-teal-brand/10 text-teal-dark border border-teal-brand/30">
                              {dept.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-oxford-800">
                            {dept.name}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-medium">
                            {coursesCount} course{coursesCount !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-medium">
                            {studentsCount} student{studentsCount !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingDept(dept);
                                  setDeptNameInput(dept.name);
                                  setDeptCodeInput(dept.code);
                                  setDeptError(null);
                                  setShowAddDeptModal(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-oxford-800 hover:bg-slate-100 transition-colors"
                                title="Edit Department"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDepartment(dept.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete Department"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STUDENT ROSTER                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'students' && (
        <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-border">
            <div>
              <h3 className="font-serif text-lg font-bold text-oxford-800 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-teal-brand" />
                Student Roster & Registered Hardware Tokens
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Register students, assign their course offerings, and track mobile device fingerprints
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowDirectScannerForOnboard(true)}
                className="px-3.5 py-2 rounded-xl bg-teal-brand/10 hover:bg-teal-brand/20 border border-teal-brand/30 text-teal-dark font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                title="Scan a student's physical ID card barcode or digital QR pass to onboard them immediately"
              >
                <Camera className="w-4 h-4 text-teal-brand" />
                <span>Scan to Onboard</span>
              </button>

              <button
                onClick={() => {
                  setCsvTargetCourseId(undefined);
                  setShowCsvImportModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-oxford-800 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                title="Bulk import students from a CSV spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-brand" />
                <span>Import Students (CSV)</span>
              </button>

              <button
                onClick={() => {
                  if (aegisStore.students.length > 0) {
                    setSelectedStudentForBindModal(aegisStore.students[0]);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                title="Scan and bind physical plastic ID cards for students"
              >
                <CreditCard className="w-4 h-4 text-teal-brand" />
                <span>Card Binding Station</span>
              </button>

              <button
                onClick={() => {
                  setSelectedCoursesForNewStudent(aegisStore.courses.map((c) => c.id));
                  setShowAddStudentModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Student
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Matric Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Courses Offering</th>
                  <th className="py-3 px-4">Unique QR Pass</th>
                  <th className="py-3 px-4">Device Fingerprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {aegisStore.students.map((student) => {
                  const user = aegisStore.users.find((u) => u.id === student.user_id);
                  const dept = aegisStore.departments.find((d) => d.id === student.department_id);
                  const studentEnrollments = aegisStore.enrollments.filter((e) => e.student_id === student.id);
                  const enrolledCourses = studentEnrollments
                    .map((e) => aegisStore.courses.find((c) => c.id === e.course_id)?.course_code)
                    .filter(Boolean);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-oxford-800">
                        {student.matric_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-oxford-800">
                        {user?.full_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {user?.email || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {dept?.code || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {enrolledCourses.map((code, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-100 text-oxford-800 font-mono font-semibold text-[10px]"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {student.qr_code_id && student.qr_code_id.length === 32 ? (
                            <span
                              className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1"
                              title={`Physical ID Card Bound: ${student.qr_code_id}`}
                            >
                              <CreditCard className="w-3 h-3 text-emerald-600" />
                              {student.qr_code_id.substring(0, 8)}... (32c)
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 truncate max-w-[120px]">
                              {student.qr_code_id || 'AR-QR-...'}
                            </span>
                          )}

                          {/* Bind Physical Card Button */}
                          <button
                            onClick={() => setSelectedStudentForBindModal(student)}
                            className="p-1.5 rounded-lg bg-teal-brand/10 hover:bg-teal-brand/20 text-teal-dark transition"
                            title="Scan & Bind Student's Physical 32-character ID Card QR code"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-teal-brand" />
                          </button>

                          {/* View Digital QR Pass */}
                          <button
                            onClick={() => setSelectedStudentForQrModal(student)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-oxford-800 transition"
                            title="View & Print Digital QR Pass"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {user?.device_fingerprint ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {user.device_fingerprint.substring(0, 14)}...
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Not bound yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ATTENDANCE AUDIT & MULTI-FORMAT EXPORTS                             */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Audited Student Entries</span>
              <div className="text-3xl font-extrabold font-mono text-oxford-800 mt-1">
                {totalAuditedStudents}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Across all filtered course offerings</p>
            </div>

            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Class Attendance Average</span>
              <div className="text-3xl font-extrabold font-mono text-teal-dark mt-1">
                {avgAttendance}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Overall verification index</p>
            </div>

            <div className="bg-surface-card rounded-2xl p-5 shadow-academic border border-surface-border">
              <span className="text-xs text-slate-500 font-medium">Below Attendance Threshold (&lt;75%)</span>
              <div className="text-3xl font-extrabold font-mono text-red-600 mt-1">
                {flaggedCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Ineligible for exam admission</p>
            </div>
          </div>

          <div className="bg-surface-card rounded-2xl p-6 shadow-academic border border-surface-border space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-teal-brand" />
                <h3 className="font-serif text-base font-bold text-oxford-800">
                  Customizable Audit Filters
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenPastAttendanceModal(selectedCourseId || undefined)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-oxford-800 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 border border-slate-200"
                  title="Backfill prior weeks from paper roll-call registers"
                >
                  <History className="w-4 h-4 text-oxford-600" />
                  <span>Log Past Weeks</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="px-3.5 py-2 rounded-xl bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-teal-brand" />
                  <span>Export PDF Audit</span>
                </button>

                <button
                  onClick={handleExportWord}
                  className="px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <FileCode className="w-4 h-4 text-blue-300" />
                  <span>Export Word (.docx)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-surface-border rounded-lg bg-white"
                >
                  <option value="">All Courses</option>
                  {aegisStore.courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.course_code} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Department</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-surface-border rounded-lg bg-white"
                >
                  <option value="">All Departments</option>
                  {aegisStore.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-surface-border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Student</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Matric / Name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-surface-border rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-card rounded-2xl shadow-academic border border-surface-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Matric Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Course Code</th>
                    <th className="py-3 px-4 text-center">Credit Load</th>
                    <th className="py-3 px-4 text-center">Sessions Held</th>
                    <th className="py-3 px-4 text-center">Attended</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-right">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredReport.map((row, idx) => {
                    const isSatisfactory = row.attendance_percentage >= 75;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-oxford-800">{row.matric_number}</td>
                        <td className="py-3 px-4 font-medium text-oxford-800">{row.student_name}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-teal-dark">{row.course_code}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.credit_load}</td>
                        <td className="py-3 px-4 text-center font-mono">{row.total_sessions}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{row.sessions_attended}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono font-bold ${isSatisfactory ? 'text-emerald-700' : 'text-red-600'}`}>
                            {row.attendance_percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isSatisfactory ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isSatisfactory ? 'Satisfactory' : 'Flagged (<75%)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: START LIVE SESSION (CUSTOM PIN, VENUE, ANNOUNCEMENT)               */}
      {/* ========================================================================= */}
      {showStartSessionModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 shadow-academic-lg border border-surface-border">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-brand/10 flex items-center justify-center text-teal-brand">
                  <Play className="w-5 h-5 fill-teal-brand" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-oxford-800">
                    Initiate Dynamic Class Attendance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your phone location will lock as the classroom geofence anchor
                  </p>
                </div>
              </div>
              <button onClick={() => setShowStartSessionModal(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
                <select
                  value={sessionCourseId}
                  onChange={(e) => setSessionCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg bg-white font-medium"
                >
                  {aegisStore.courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.course_code} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom 4-Digit PIN
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="e.g. 4421"
                    value={sessionCustomPin}
                    onChange={(e) => setSessionCustomPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg font-mono font-bold tracking-widest text-center text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Geofence Radius
                  </label>
                  <select
                    value={sessionRadius}
                    onChange={(e) => setSessionRadius(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg bg-white"
                  >
                    <option value={50}>50m (Small Classroom)</option>
                    <option value={75}>75m (Standard Hall)</option>
                    <option value={100}>100m (Large Amphitheatre)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lecture Venue</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering Amphitheatre B"
                  value={sessionVenue}
                  onChange={(e) => setSessionVenue(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class Announcement / Notice (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lecturer is seated; attendance verification is now open."
                  value={sessionAnnouncement}
                  onChange={(e) => setSessionAnnouncement(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowStartSessionModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStartingSession}
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg shadow-sm"
                >
                  {isStartingSession ? 'Locking Phone GPS...' : 'Start Session & Lock Geofence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL MARK-IN (FAIL-SAFE FOR DEAD BATTERY / HARDWARE GLITCHES)     */}
      {/* ========================================================================= */}
      {showManualMarkModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 shadow-academic-lg border border-surface-border">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold-brand/20 flex items-center justify-center text-gold-dark">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-oxford-800">
                    Manual Sign-In (Fail-Safe Protocol)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manually sign in physically present students experiencing phone/network failures
                  </p>
                </div>
              </div>
              <button onClick={() => setShowManualMarkModal(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualMarkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Student
                </label>
                <select
                  required
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg bg-white"
                >
                  <option value="">-- Choose enrolled student --</option>
                  {studentsEligibleForManualMark.map((item) => (
                    <option key={item.student!.id} value={item.student!.id}>
                      {item.student!.matric_number} - {item.user?.full_name} {item.log ? `(Current: ${item.log.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status to Mark
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualStatus('Present')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      manualStatus === 'Present'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400 shadow-sm'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStatus('Flagged')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      manualStatus === 'Flagged'
                        ? 'bg-amber-100 text-amber-800 border-amber-400 shadow-sm'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Flagged
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStatus('Absent')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      manualStatus === 'Absent'
                        ? 'bg-red-100 text-red-800 border-red-400 shadow-sm'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Manual Override (Audit Requirement)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student phone battery depleted; physically present in 3rd row."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowManualMarkModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-oxford-900 bg-gold-brand hover:bg-gold-light rounded-lg shadow-sm"
                >
                  Authorize Manual Sign-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CLASS SCHEDULE TIMETABLE ENTRY                                 */}
      {/* ========================================================================= */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-4">Add Class Schedule Entry</h3>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
                <select
                  value={schedCourseId}
                  onChange={(e) => setSchedCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  {aegisStore.courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.course_code} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Day of Week</label>
                <select
                  value={schedDay}
                  onChange={(e: any) => setSchedDay(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={schedStartTime}
                    onChange={(e) => setSchedStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={schedEndTime}
                    onChange={(e) => setSchedEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Classroom / Venue</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering Amphitheatre A"
                  value={schedVenue}
                  onChange={(e) => setSchedVenue(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddScheduleModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT / UPDATE PIN                                                  */}
      {/* ========================================================================= */}
      {showEditPinModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-sm w-full p-6 shadow-academic-lg border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-2">Update Session PIN</h3>
            <p className="text-xs text-slate-500 mb-4">Set a custom 4-digit PIN for students in this contact session.</p>
            <form onSubmit={handleUpdatePinSubmit} className="space-y-4">
              <input
                type="text"
                maxLength={4}
                required
                placeholder="••••"
                value={updatedPin}
                onChange={(e) => setUpdatedPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[0.5em] font-mono text-3xl font-extrabold py-3 border border-surface-border rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditPinModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BROADCAST ANNOUNCEMENT                                            */}
      {/* ========================================================================= */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-2">Broadcast Class Notice</h3>
            <p className="text-xs text-slate-500 mb-4">This message will immediately appear as an alert on all student check-in screens.</p>
            <form onSubmit={handleBroadcastAnnouncement} className="space-y-4">
              <textarea
                rows={3}
                required
                placeholder="e.g. Lecturer is running 10 mins late; sit in front rows."
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
                >
                  Send Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AUDITORIUM LARGE PIN PROJECTION DISPLAY                            */}
      {/* ========================================================================= */}
      {showProjectionModal && activeSession && (
        <div className="fixed inset-0 bg-oxford-900/95 z-50 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
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
                Open <span className="text-teal-brand font-bold underline">AegisRoll</span> • Enter your Matriculation Number & PIN
              </p>
            </div>

            <div className="p-10 rounded-3xl bg-oxford-800 border-2 border-teal-brand/40 shadow-2xl relative overflow-hidden">
              <div className="font-mono text-7xl sm:text-9xl font-black tracking-[0.25em] text-gold-brand select-all">
                {activeSession.session_pin}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-300">
                <span>Venue: <strong>{activeSession.venue || 'Lecture Hall'}</strong></span>
                <span>•</span>
                <span>Geofence: <strong>{activeSession.geofence_radius_meters}m from CR Phone</strong></span>
                <span>•</span>
                <span>Live Checked-in: <strong>{activeSessionLogs.filter((l) => l.status === 'Present').length} Present</strong></span>
              </div>
            </div>

            <button
              onClick={() => setShowProjectionModal(false)}
              className="px-6 py-3 rounded-xl bg-teal-brand hover:bg-teal-hover text-oxford-900 font-bold text-sm transition-colors shadow-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANAGE STUDENTS OFFERING SPECIFIC COURSE                          */}
      {/* ========================================================================= */}
      {managingCourse && (
        <div className="fixed inset-0 bg-oxford-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-academic-lg border border-surface-border overflow-hidden">
            <div className="p-6 bg-oxford-800 text-white flex items-center justify-between border-b border-oxford-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-extrabold text-teal-brand">
                      {managingCourse.course_code}
                    </span>
                    <span className="text-white text-base font-bold font-serif">
                      • {managingCourse.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {managingCourse.credit_load} Credits •{' '}
                    <strong className="text-gold-brand">{enrolledStudentsInManagingCourse.length} Students Offering</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setManagingCourse(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-oxford-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                <select
                  value={selectedStudentToEnroll}
                  onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                  className="w-full flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg bg-white"
                >
                  <option value="">-- Select student to add ({eligibleStudentsForManagingCourse.length} eligible) --</option>
                  {eligibleStudentsForManagingCourse.map((item) => (
                    <option key={item.student.id} value={item.student.id}>
                      {item.student.matric_number} - {item.user?.full_name} ({item.dept?.code})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleEnrollStudentInManagingCourse}
                  disabled={!selectedStudentToEnroll}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enroll Student</span>
                </button>

                <div className="hidden sm:block w-[1px] h-6 bg-slate-200" />

                <button
                  type="button"
                  onClick={() => {
                    setCsvTargetCourseId(managingCourse.id);
                    setShowCsvImportModal(true);
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-teal-dark bg-teal-brand/10 hover:bg-teal-brand/20 border border-teal-brand/30 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  title={`Bulk import and enroll students directly into ${managingCourse.course_code}`}
                >
                  <Upload className="w-3.5 h-3.5 text-teal-brand" />
                  <span>Batch Import CSV</span>
                </button>
              </div>

              <div className="border border-surface-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Matric No.</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-center">Attendance %</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredEnrolledStudents.map((item, idx) => (
                      <tr key={item.enrollmentId} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-oxford-800">{item.student?.matric_number}</td>
                        <td className="py-2.5 px-3 font-medium text-oxford-800">{item.user?.full_name}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">{item.attendanceRate.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleUnenrollStudentFromManagingCourse(item.student!.id, item.student!.matric_number)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            Drop
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-surface-border flex justify-end">
              <button
                onClick={() => setManagingCourse(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COURSE                                                         */}
      {/* ========================================================================= */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 shadow-academic-lg border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-4">Add Course Offering</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSC 401"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono uppercase font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Systems Architecture"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Load</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={newCourseCredits}
                    onChange={(e) => setNewCourseCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={newCourseDeptId}
                    onChange={(e) => setNewCourseDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                  >
                    {aegisStore.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Course Lecturer</label>
                <select
                  value={newCourseLecturerId}
                  onChange={(e) => setNewCourseLecturerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- Select Assigned Lecturer --</option>
                  {aegisStore.users
                    .filter((u) => u.role === 'lecturer' || u.role === 'admin')
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name} ({l.role === 'admin' ? 'Class Rep' : 'Faculty Lecturer'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoEnrollDeptStudents"
                  checked={autoEnrollDeptStudents}
                  onChange={(e) => setAutoEnrollDeptStudents(e.target.checked)}
                  className="rounded text-teal-brand focus:ring-teal-brand"
                />
                <label htmlFor="autoEnrollDeptStudents" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Auto-enroll all registered department students offering this course
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD STUDENT                                                        */}
      {/* ========================================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-oxford-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-6 shadow-academic-lg border border-surface-border">
            <h3 className="font-serif text-lg font-bold text-oxford-800 mb-4">Add Student to Roster</h3>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student Full Name"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Matriculation No</label>
                    <button
                      type="button"
                      onClick={() => setShowDirectScannerForOnboard(true)}
                      className="text-[11px] text-teal-dark hover:text-teal-brand font-semibold flex items-center gap-1 bg-teal-brand/10 hover:bg-teal-brand/20 px-2 py-0.5 rounded border border-teal-brand/30 transition shadow-2xs"
                      title="Scan student plastic ID card barcode or QR code"
                    >
                      <Camera className="w-3 h-3 text-teal-brand" />
                      <span>Scan Card</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U24MTH1019 or 4-digit serial"
                    value={newStudentMatric}
                    onChange={(e) => setNewStudentMatric(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={newStudentDeptId}
                    onChange={(e) => setNewStudentDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                  >
                    {aegisStore.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. student@university.edu"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-teal-brand" /> Physical ID Card QR Code (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDirectScannerForOnboard(true)}
                    className="text-[11px] text-teal-dark hover:text-teal-brand font-semibold flex items-center gap-1 bg-teal-brand/10 hover:bg-teal-brand/20 px-2 py-0.5 rounded border border-teal-brand/30 transition shadow-2xs"
                    title="Scan 32-character plastic card QR code or barcode"
                  >
                    <Camera className="w-3 h-3 text-teal-brand" />
                    <span>Scan Card Token</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Paste or type 32-character ID card QR code (leave empty to auto-generate)"
                  value={newStudentCustomQr}
                  onChange={(e) => setNewStudentCustomQr(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 rounded-lg"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modals */}
      {activeSession && (
        <QrCameraScannerModal
          isOpen={showQrScannerModal}
          onClose={() => setShowQrScannerModal(false)}
          sessionId={activeSession.id}
          sessionTitle={activeCourse ? `${activeCourse.course_code}: ${activeCourse.title}` : 'Active Class Session'}
          onScanCompleted={() => triggerUpdate()}
        />
      )}

      {/* Add / Edit Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border relative">
            <button
              onClick={() => setShowAddDeptModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-oxford-800 text-teal-brand flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800">
                  {editingDept ? 'Edit Academic Department' : 'Create Academic Department'}
                </h3>
                <p className="text-xs text-slate-500">
                  Define faculty or department title and unique course code prefix
                </p>
              </div>
            </div>

            {deptError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{deptError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Department of Computer Science & Engineering"
                  value={deptNameInput}
                  onChange={(e) => setDeptNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSC or EEE"
                  value={deptCodeInput}
                  onChange={(e) => setDeptCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs border rounded-lg font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-teal-brand"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campus / Institution Name Modal */}
      {showInstitutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border relative">
            <button
              onClick={() => setShowInstitutionModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-oxford-800 text-teal-brand flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800">
                  Campus / Institution Branding
                </h3>
                <p className="text-xs text-slate-500">
                  Set the official university, college, or faculty title
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveInstitutionName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Federal University of Technology"
                  value={institutionNameInput}
                  onChange={(e) => setInstitutionNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand font-semibold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInstitutionModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg transition-colors shadow-sm"
                >
                  Save Campus Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unregistered Student Quick Add Modal */}
      {unregisteredMatricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border relative">
            <button
              onClick={() => setUnregisteredMatricModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-oxford-800 text-teal-brand flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-oxford-800">
                  New Student Roll Call
                </h3>
                <p className="text-xs text-slate-500">
                  Matriculation number is not yet in this roster
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
              <span className="text-slate-500">Matriculation Number:</span>
              <div className="font-mono font-bold text-oxford-800 text-sm mt-0.5">
                {unregisteredMatricModal.matric}
              </div>
            </div>

            <form onSubmit={handleConfirmUnregisteredStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Michael Adebayo"
                  value={unregisteredStudentName}
                  onChange={(e) => setUnregisteredStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnregisteredMatricModal(null)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg transition-colors shadow-sm"
                >
                  Enroll & Mark Present
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedStudentForQrModal && (
        <StudentQrPassModal
          isOpen={Boolean(selectedStudentForQrModal)}
          onClose={() => setSelectedStudentForQrModal(null)}
          student={selectedStudentForQrModal}
          user={aegisStore.users.find((u) => u.id === selectedStudentForQrModal.user_id)}
          department={aegisStore.departments.find((d) => d.id === selectedStudentForQrModal.department_id)}
          onRegenerated={() => triggerUpdate()}
        />
      )}

      {selectedStudentForBindModal && (
        <BindIdCardModal
          isOpen={Boolean(selectedStudentForBindModal)}
          onClose={() => setSelectedStudentForBindModal(null)}
          student={selectedStudentForBindModal}
          user={aegisStore.users.find((u) => u.id === selectedStudentForBindModal.user_id)}
          department={aegisStore.departments.find((d) => d.id === selectedStudentForBindModal.department_id)}
          onBoundSuccessfully={() => {
            triggerUpdate();
            setSelectedStudentForBindModal(null);
          }}
        />
      )}

      <RepSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        currentUser={currentUser}
        onPasswordChanged={() => triggerUpdate()}
      />

      <CsvStudentImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onImportCompleted={() => triggerUpdate()}
        preselectedCourseId={csvTargetCourseId}
      />

      <DirectCardScannerModal
        isOpen={showDirectScannerForOnboard}
        onClose={() => setShowDirectScannerForOnboard(false)}
        onScan={handleDirectScannerResult}
        title="Scan Student ID Card to Onboard"
        subtitle="Point camera at student's plastic ID card barcode or digital pass"
      />

      {/* Pre-Deployment & Past Weeks Attendance Entry Modal (Course Rep) */}
      {showPastAttendanceModal && (
        <div className="fixed inset-0 bg-oxford-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-surface-border my-8 space-y-6">
            <div className="flex items-center justify-between border-b border-surface-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-oxford-800 text-teal-brand">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-oxford-800">
                    Course Rep Historical Session Recorder
                  </h3>
                  <p className="text-xs text-slate-500">
                    Record attendance for weeks prior to AegisRoll deployment from paper sign-in registers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPastAttendanceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pastSuccessMessage && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Historical Attendance Recorded!
                </div>
                <p>{pastSuccessMessage}</p>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setPastSuccessMessage(null);
                      const match = pastWeekLabel.match(/Week (\d+)/i);
                      if (match) {
                        setPastWeekLabel(`Week ${parseInt(match[1]) + 1}`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Log Next Week
                  </button>
                  <button
                    onClick={() => setShowPastAttendanceModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSavePastAttendance} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Select Course
                  </label>
                  <select
                    value={pastCourseId}
                    onChange={(e) => {
                      setPastCourseId(e.target.value);
                      const enrolled = aegisStore.enrollments
                        .filter((enr) => enr.course_id === e.target.value)
                        .map((enr) => enr.student_id);
                      setPastSelectedStudentIds(enrolled);
                    }}
                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white font-medium"
                  >
                    {aegisStore.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.course_code} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Academic Week
                  </label>
                  <select
                    value={pastWeekLabel}
                    onChange={(e) => setPastWeekLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white font-medium"
                  >
                    {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10'].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Historical Session Date
                  </label>
                  <input
                    type="date"
                    value={pastDate}
                    onChange={(e) => setPastDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white font-medium"
                    required
                  />
                </div>
              </div>

              {/* Quick Paste Matrics */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-oxford-800 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-teal-brand" /> Quick-Paste Present Matrics (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyPastedMatrics}
                    className="px-2.5 py-1 text-xs font-bold text-teal-dark bg-teal-brand/10 hover:bg-teal-brand/20 rounded-lg transition-colors"
                  >
                    Apply Matrics
                  </button>
                </div>
                <textarea
                  value={pastPasteMatricText}
                  onChange={(e) => setPastPasteMatricText(e.target.value)}
                  placeholder="Paste student matric numbers from physical sign-in sheet (comma, space, or newline separated)..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white font-mono"
                />
              </div>

              {/* Student Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Enrolled Students ({pastSelectedStudentIds.length} of {
                      aegisStore.enrollments.filter((e) => e.course_id === pastCourseId).length
                    } marked Present)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = aegisStore.enrollments
                          .filter((e) => e.course_id === pastCourseId)
                          .map((e) => e.student_id);
                        setPastSelectedStudentIds(allIds);
                      }}
                      className="text-[11px] text-teal-brand hover:underline font-bold"
                    >
                      Select All Present
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setPastSelectedStudentIds([])}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto border border-surface-border rounded-xl divide-y divide-surface-border bg-white">
                  {aegisStore.enrollments
                    .filter((e) => e.course_id === pastCourseId)
                    .map((enr) => {
                      const student = aegisStore.students.find((s) => s.id === enr.student_id);
                      if (!student) return null;
                      const user = aegisStore.users.find((u) => u.id === student.user_id);
                      const isChecked = pastSelectedStudentIds.includes(student.id);

                      return (
                        <label
                          key={student.id}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPastSelectedStudentIds((prev) => [...prev, student.id]);
                                } else {
                                  setPastSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                                }
                              }}
                              className="rounded text-teal-brand focus:ring-teal-brand"
                            />
                            <div>
                              <span className="font-semibold text-oxford-800">{user?.full_name || 'Student'}</span>
                              <span className="ml-2 font-mono text-[11px] text-slate-500">({student.matric_number})</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isChecked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isChecked ? 'Present' : 'Absent'}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  value={pastNotes}
                  onChange={(e) => setPastNotes(e.target.value)}
                  placeholder="e.g. Transcribed from paper roll-call sheet approved by Course Lecturer"
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowPastAttendanceModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-oxford-800 hover:bg-oxford-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                >
                  <History className="w-4 h-4 text-teal-brand" /> Save Historical Attendance Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
