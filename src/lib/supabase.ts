import { createClient } from '@supabase/supabase-js';
import {
  UserProfile,
  Department,
  Student,
  Course,
  Enrollment,
  ClassSchedule,
  ClassSession,
  AttendanceLog,
  AttendanceSubmissionResult,
  DeviceBindingResult,
  AttendanceReportSummary,
  AttendanceStatus
} from '../types';
import { calculateHaversineDistance } from './geolocation';

// Environment variables for live Supabase connection
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Allow runtime override via localStorage for convenient testing
const storedUrl = localStorage.getItem('aegis_supabase_url') || envUrl;
const storedKey = localStorage.getItem('aegis_supabase_key') || envAnonKey;

export const isLiveSupabaseConfigured = Boolean(
  storedUrl &&
  storedKey &&
  storedUrl.startsWith('http') &&
  !storedUrl.includes('your-project')
);

export const supabase = isLiveSupabaseConfigured
  ? createClient(storedUrl, storedKey)
  : null;

// ==============================================================================
// SEED MOCK DATA (For instant evaluation & demonstration without friction)
// ==============================================================================

const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-1', name: 'Department of Computer Science & Engineering', code: 'CSE' },
  { id: 'dept-2', name: 'Department of Electrical & Information Systems', code: 'EEE' },
  { id: 'dept-3', name: 'Department of Mathematics & Statistics', code: 'MTH' }
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-student-1',
    email: 'alex.chen@university.edu',
    full_name: 'Alex Chen',
    role: 'student',
    device_fingerprint: 'fp_sample_device_alex_123',
    fingerprint_updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'usr-student-2',
    email: 'fatima.almansoori@university.edu',
    full_name: 'Fatima Al-Mansoori',
    role: 'student',
    device_fingerprint: 'fp_sample_device_fatima_456',
    fingerprint_updated_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'usr-student-3',
    email: 'david.okafor@university.edu',
    full_name: 'David Okafor',
    role: 'student'
  },
  {
    id: 'usr-student-4',
    email: 'sophia.martinez@university.edu',
    full_name: 'Sophia Martinez',
    role: 'student'
  },
  {
    id: 'usr-student-5',
    email: 'tariq.nawaz@university.edu',
    full_name: 'Tariq Nawaz',
    role: 'student'
  },
  {
    id: 'usr-lecturer-1',
    email: 'dr.adams@university.edu',
    full_name: 'Dr. Gregory Adams',
    role: 'lecturer'
  },
  {
    id: 'usr-admin-1',
    email: 'class.rep@university.edu',
    full_name: 'Chidi Nnamdi (Class Rep)',
    role: 'admin'
  }
];

const INITIAL_STUDENTS: Student[] = [
  { id: 'std-1', user_id: 'usr-student-1', matric_number: 'UG/2023/CS/1042', department_id: 'dept-1', qr_code_id: 'AR-QR-CS1042' },
  { id: 'std-2', user_id: 'usr-student-2', matric_number: 'UG/2023/CS/1089', department_id: 'dept-1', qr_code_id: 'AR-QR-CS1089' },
  { id: 'std-3', user_id: 'usr-student-3', matric_number: 'UG/2023/EE/2014', department_id: 'dept-2', qr_code_id: 'AR-QR-EE2014' },
  { id: 'std-4', user_id: 'usr-student-4', matric_number: 'UG/2023/CS/1105', department_id: 'dept-1', qr_code_id: 'AR-QR-CS1105' },
  { id: 'std-5', user_id: 'usr-student-5', matric_number: 'UG/2023/CS/1120', department_id: 'dept-1', qr_code_id: 'AR-QR-CS1120' }
];

const INITIAL_COURSES: Course[] = [
  {
    id: 'crs-1',
    course_code: 'CSC 401',
    title: 'Distributed Systems & Network Architecture',
    credit_load: 3,
    department_id: 'dept-1',
    lecturer_id: 'usr-lecturer-1'
  },
  {
    id: 'crs-2',
    course_code: 'CSC 405',
    title: 'Cryptography & Cyber-Physical Security',
    credit_load: 4,
    department_id: 'dept-1',
    lecturer_id: 'usr-lecturer-1'
  },
  {
    id: 'crs-3',
    course_code: 'EEE 312',
    title: 'Signals, Systems & Digital Processing',
    credit_load: 3,
    department_id: 'dept-2',
    lecturer_id: 'usr-lecturer-1'
  }
];

const INITIAL_SCHEDULES: ClassSchedule[] = [
  {
    id: 'sch-1',
    course_id: 'crs-1',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '11:00',
    venue: 'Engineering Amphitheatre A'
  },
  {
    id: 'sch-2',
    course_id: 'crs-1',
    day_of_week: 'Thursday',
    start_time: '14:00',
    end_time: '16:00',
    venue: 'Computer Science Lab 2'
  },
  {
    id: 'sch-3',
    course_id: 'crs-2',
    day_of_week: 'Wednesday',
    start_time: '10:00',
    end_time: '12:00',
    venue: 'Cybersecurity Seminar Room B'
  },
  {
    id: 'sch-4',
    course_id: 'crs-3',
    day_of_week: 'Friday',
    start_time: '08:30',
    end_time: '10:30',
    venue: 'EEE Main Hall'
  }
];

const INITIAL_ENROLLMENTS: Enrollment[] = [
  { id: 'enr-1', student_id: 'std-1', course_id: 'crs-1', semester: 'First Semester', academic_year: '2026/2027' },
  { id: 'enr-2', student_id: 'std-2', course_id: 'crs-1', semester: 'First Semester', academic_year: '2026/2027' },
  { id: 'enr-3', student_id: 'std-4', course_id: 'crs-1', semester: 'First Semester', academic_year: '2026/2027' },
  { id: 'enr-4', student_id: 'std-5', course_id: 'crs-1', semester: 'First Semester', academic_year: '2026/2027' },
  { id: 'enr-5', student_id: 'std-1', course_id: 'crs-2', semester: 'First Semester', academic_year: '2026/2027' },
  { id: 'enr-6', student_id: 'std-3', course_id: 'crs-3', semester: 'First Semester', academic_year: '2026/2027' }
];

// Active classroom session anchored to Class Rep's phone location (Science Lecture Hall: 40.7128, -74.0060)
const INITIAL_SESSIONS: ClassSession[] = [
  {
    id: 'ses-1',
    course_id: 'crs-1',
    lecturer_id: 'usr-admin-1', // Class Rep anchored
    session_pin: '8492',
    start_time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    is_active: true,
    admin_lat: 40.712776,
    admin_lon: -74.005974,
    geofence_radius_meters: 75,
    venue: 'Engineering Amphitheatre A',
    announcement: 'Welcome to CSC 401. Please keep your seats until after attendance is verified.',
    auto_close_minutes: 30,
    anchor_device_name: "Course Representative's Phone (Galaxy S24)"
  }
];

const INITIAL_LOGS: AttendanceLog[] = [
  {
    id: 'log-1',
    session_id: 'ses-1',
    student_id: 'std-2',
    checked_in_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    student_lat: 40.712800,
    student_lon: -74.005950,
    gps_accuracy_meters: 8.5,
    distance_calculated: 3.4,
    status: 'Present',
    marked_by: 'geofence_auto',
    notes: "Verified within 3.4m of Class Representative's phone."
  },
  {
    id: 'log-2',
    session_id: 'ses-1',
    student_id: 'std-4',
    checked_in_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    student_lat: 40.713900,
    student_lon: -74.006500,
    gps_accuracy_meters: 14.0,
    distance_calculated: 132.8,
    status: 'Flagged',
    marked_by: 'geofence_auto',
    notes: "Outside geofence (132.8m from CR's phone > 82.0m threshold)."
  }
];

// Reactive event dispatcher for real-time updates in both mock & live environments
type RealtimeCallback = (payload: any) => void;
const subscribers: Record<string, RealtimeCallback[]> = {};

function notifySubscribers(channel: string, payload: any) {
  if (subscribers[channel]) {
    subscribers[channel].forEach((cb) => cb(payload));
  }
}

export function subscribeToSessionAttendance(
  sessionId: string,
  callback: RealtimeCallback
): () => void {
  const channel = `session_${sessionId}`;
  if (!subscribers[channel]) {
    subscribers[channel] = [];
  }
  subscribers[channel].push(callback);

  // If live Supabase is connected, subscribe to Postgres changes
  let supabaseChannel: any = null;
  if (isLiveSupabaseConfigured && supabase) {
    supabaseChannel = supabase
      .channel(`public:attendance_logs:session_id=eq.${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
  }

  return () => {
    subscribers[channel] = subscribers[channel].filter((cb) => cb !== callback);
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}

// ==============================================================================
// REACTIVE DATA STORE WITH LOCAL STORAGE CACHE
// ==============================================================================

class AegisStore {
  departments: Department[];
  users: UserProfile[];
  students: Student[];
  courses: Course[];
  schedules: ClassSchedule[];
  enrollments: Enrollment[];
  sessions: ClassSession[];
  logs: AttendanceLog[];
  currentUser: UserProfile | null = null;

  constructor() {
    this.departments = this.load('aegis_departments', INITIAL_DEPARTMENTS);
    this.users = this.load('aegis_users', INITIAL_USERS);
    this.students = this.load('aegis_students', INITIAL_STUDENTS).map((st) => {
      if (!st.qr_code_id) {
        const rawMatric = st.matric_number ? st.matric_number.replace(/[^A-Za-z0-9]/g, '') : '';
        st.qr_code_id = `AR-QR-${rawMatric || Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
      return st;
    });
    this.courses = this.load('aegis_courses', INITIAL_COURSES);
    this.schedules = this.load('aegis_schedules', INITIAL_SCHEDULES);
    this.enrollments = this.load('aegis_enrollments', INITIAL_ENROLLMENTS);
    this.sessions = this.load('aegis_sessions', INITIAL_SESSIONS);
    this.logs = this.load('aegis_logs', INITIAL_LOGS);

    const savedUser = localStorage.getItem('aegis_current_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch {
        this.currentUser = this.users[0];
      }
    } else {
      this.currentUser = this.users[6]; // Default to Class Representative (Admin)
    }
  }

  private load<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  save() {
    localStorage.setItem('aegis_departments', JSON.stringify(this.departments));
    localStorage.setItem('aegis_users', JSON.stringify(this.users));
    localStorage.setItem('aegis_students', JSON.stringify(this.students));
    localStorage.setItem('aegis_courses', JSON.stringify(this.courses));
    localStorage.setItem('aegis_schedules', JSON.stringify(this.schedules));
    localStorage.setItem('aegis_enrollments', JSON.stringify(this.enrollments));
    localStorage.setItem('aegis_sessions', JSON.stringify(this.sessions));
    localStorage.setItem('aegis_logs', JSON.stringify(this.logs));
    if (this.currentUser) {
      localStorage.setItem('aegis_current_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('aegis_current_user');
    }
  }

  resetToDefaults() {
    this.departments = [...INITIAL_DEPARTMENTS];
    this.users = [...INITIAL_USERS];
    this.students = [...INITIAL_STUDENTS];
    this.courses = [...INITIAL_COURSES];
    this.schedules = [...INITIAL_SCHEDULES];
    this.enrollments = [...INITIAL_ENROLLMENTS];
    this.sessions = [...INITIAL_SESSIONS];
    this.logs = [...INITIAL_LOGS];
    this.currentUser = this.users[6];
    this.save();
  }

  // --- Auth & Session Logic ---

  setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    this.save();
  }

  async validateAndBindDevice(
    userId: string,
    fingerprint: string
  ): Promise<DeviceBindingResult> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('bind_or_validate_device', {
          p_user_id: userId,
          p_fingerprint: fingerprint
        });
        if (error) throw error;
        return data as DeviceBindingResult;
      } catch (err: any) {
        console.warn('Supabase device binding RPC fallback to local check:', err);
      }
    }

    // Local / Mock validation: check 12-hour conflict
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { allowed: false, message: 'User not found.' };

    if (user.role !== 'student') {
      return { allowed: true, message: 'Staff/CR role bypassed.' };
    }

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    const conflicting = this.users.find(
      (u) =>
        u.device_fingerprint === fingerprint &&
        u.id !== userId &&
        u.role === 'student' &&
        u.fingerprint_updated_at &&
        new Date(u.fingerprint_updated_at).getTime() > twelveHoursAgo
    );

    if (conflicting) {
      return {
        allowed: false,
        message: `Proxy check-in prevention: This device was used by another student (${conflicting.full_name}) within the past 12 hours.`
      };
    }

    user.device_fingerprint = fingerprint;
    user.fingerprint_updated_at = new Date().toISOString();
    this.save();
    return { allowed: true, message: 'Device bound successfully.' };
  }

  // --- Geofence Attendance Submission (Supports Matric Number + PIN or Student ID) ---

  async submitAttendance(
    sessionId: string,
    studentIdOrMatric: string,
    sessionPin: string,
    studentLat: number,
    studentLon: number,
    accuracy: number,
    matricNumber?: string
  ): Promise<AttendanceSubmissionResult> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'Class session not found.'
      };
    }

    if (!session.is_active) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'This class session is closed or inactive.'
      };
    }

    // Check auto-close deadline if configured
    if (session.auto_close_minutes && session.auto_close_minutes > 0) {
      const elapsedMinutes = (Date.now() - new Date(session.start_time).getTime()) / (60 * 1000);
      if (elapsedMinutes > session.auto_close_minutes) {
        session.is_active = false;
        this.save();
        return {
          success: false,
          status: 'Error',
          distance_meters: null,
          message: `Attendance window closed: The ${session.auto_close_minutes}-minute limit for this session has expired.`
        };
      }
    }

    if (session.session_pin.trim() !== sessionPin.trim()) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'Invalid 4-digit session PIN. Verify with Course Representative.'
      };
    }

    // Resolve student record
    let targetStudent = this.students.find((s) => s.id === studentIdOrMatric);
    if (!targetStudent && matricNumber) {
      targetStudent = this.students.find(
        (s) => s.matric_number.toUpperCase() === matricNumber.trim().toUpperCase()
      );
    }
    if (!targetStudent) {
      targetStudent = this.students.find(
        (s) => s.matric_number.toUpperCase() === studentIdOrMatric.trim().toUpperCase()
      );
    }

    if (!targetStudent) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: `Student with matriculation number "${matricNumber || studentIdOrMatric}" not found on the roster.`
      };
    }

    // Check existing check-in
    const existing = this.logs.find(
      (l) => l.session_id === sessionId && l.student_id === targetStudent!.id
    );
    if (existing) {
      return {
        success: false,
        status: existing.status,
        distance_meters: existing.distance_calculated,
        message: `You have already submitted attendance for this session. Current status: ${existing.status}`
      };
    }

    // Haversine exact calculation against CR / Lecturer phone anchor
    const distance = calculateHaversineDistance(
      studentLat,
      studentLon,
      session.admin_lat,
      session.admin_lon
    );

    // Fair indoor GPS grace buffer: v_distance <= (v_radius + LEAST(p_accuracy * 0.5, 25))
    const graceBuffer = Math.min((accuracy || 10) * 0.5, 25.0);
    const allowedRadius = session.geofence_radius_meters + graceBuffer;
    const isInside = distance <= allowedRadius;
    const status: AttendanceStatus = isInside ? 'Present' : 'Flagged';

    const anchorName = session.anchor_device_name || "Course Representative's Phone";

    const newLog: AttendanceLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      session_id: sessionId,
      student_id: targetStudent.id,
      checked_in_at: new Date().toISOString(),
      student_lat: studentLat,
      student_lon: studentLon,
      gps_accuracy_meters: accuracy,
      distance_calculated: Math.round(distance * 100) / 100,
      status,
      marked_by: 'geofence_auto',
      notes: isInside
        ? `Verified within ${distance.toFixed(1)}m of ${anchorName}.`
        : `Flagged outside geofence: ${distance.toFixed(1)}m from ${anchorName} (allowed threshold: ${allowedRadius.toFixed(1)}m).`
    };

    this.logs.unshift(newLog);
    this.save();

    // Trigger realtime dispatch
    notifySubscribers(`session_${sessionId}`, {
      eventType: 'INSERT',
      new: newLog
    });

    return {
      success: true,
      status,
      distance_meters: Math.round(distance * 100) / 100,
      allowed_radius_meters: Math.round(allowedRadius * 100) / 100,
      gps_accuracy_meters: accuracy,
      message: isInside
        ? `Presence Verified! You are marked Present (${distance.toFixed(1)}m from ${anchorName}).`
        : `Attendance Flagged: Location is ${distance.toFixed(1)}m from ${anchorName}. Please notify your Class Representative.`
    };
  }

  // --- Backup QR Code Attendance Submission (Zero-Geofence Backup) ---
  async submitAttendanceByQr(
    sessionId: string,
    qrCodeIdOrMatric: string,
    markedBy: string = 'cr_qr_scan'
  ): Promise<AttendanceSubmissionResult> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('submit_attendance_by_qr', {
          p_session_id: sessionId,
          p_qr_code_id: qrCodeIdOrMatric.trim(),
          p_marked_by: markedBy
        });
        if (error) throw error;
        return data as AttendanceSubmissionResult;
      } catch (err: any) {
        console.warn('Supabase submit_attendance_by_qr RPC fallback to local execution:', err);
      }
    }

    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'Class session not found.'
      };
    }

    if (!session.is_active) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'This class session is closed or inactive.'
      };
    }

    // Resolve student record by qr_code_id (exact or case-insensitive), matric_number, or id
    const rawTrimmed = qrCodeIdOrMatric.trim();
    const cleanId = rawTrimmed.toUpperCase();
    let targetStudent = this.students.find(
      (s) =>
        s.qr_code_id === rawTrimmed ||
        (s.qr_code_id && s.qr_code_id.toUpperCase() === cleanId) ||
        s.matric_number.toUpperCase() === cleanId ||
        s.id === rawTrimmed
    );

    if (!targetStudent) {
      return {
        success: false,
        status: 'Error',
        distance_meters: null,
        message: `Student with QR Code Pass ID "${qrCodeIdOrMatric}" not found in university roster.`
      };
    }

    const targetUser = this.users.find((u) => u.id === targetStudent!.user_id);
    const studentName = targetUser ? targetUser.full_name : targetStudent.matric_number;

    // Check existing check-in
    const existing = this.logs.find(
      (l) => l.session_id === sessionId && l.student_id === targetStudent!.id
    );
    if (existing) {
      return {
        success: false,
        already_marked: true,
        status: existing.status,
        student_name: studentName,
        matric_number: targetStudent.matric_number,
        distance_meters: existing.distance_calculated,
        message: `${studentName} (${targetStudent.matric_number}) is already registered as ${existing.status} for this session.`
      };
    }

    const newLog: AttendanceLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      session_id: sessionId,
      student_id: targetStudent.id,
      checked_in_at: new Date().toISOString(),
      student_lat: session.admin_lat,
      student_lon: session.admin_lon,
      gps_accuracy_meters: 0,
      distance_calculated: 0,
      status: 'Present',
      marked_by: markedBy,
      notes: `Verified via student digital QR Pass (${targetStudent.qr_code_id || targetStudent.matric_number}) - Geofencing bypassed.`
    };

    this.logs.unshift(newLog);
    this.save();

    notifySubscribers(`session_${sessionId}`, {
      eventType: 'INSERT',
      new: newLog
    });

    return {
      success: true,
      status: 'Present',
      student_name: studentName,
      matric_number: targetStudent.matric_number,
      distance_meters: 0,
      allowed_radius_meters: session.geofence_radius_meters,
      gps_accuracy_meters: 0,
      message: `✓ Presence Verified! ${studentName} (${targetStudent.matric_number}) marked Present via QR Pass.`
    };
  }

  regenerateStudentQrCode(studentId: string): string {
    const student = this.students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student not found');
    const newQr = `AR-QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    student.qr_code_id = newQr;
    this.save();
    return newQr;
  }

  // --- Physical Plastic Student ID Card Binding (e.g. 32-character tokens) ---
  async bindStudentPhysicalQrCard(
    studentId: string,
    physicalQrToken: string
  ): Promise<{ success: boolean; message: string; qr_code_id?: string; student_name?: string }> {
    const cleanToken = physicalQrToken.trim();
    if (!cleanToken || cleanToken.length < 4) {
      return { success: false, message: 'Invalid card QR code token. Token must be at least 4 characters.' };
    }

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('bind_student_qr_card', {
          p_student_id: studentId,
          p_qr_code_id: cleanToken
        });
        if (error) throw error;
        const st = this.students.find((s) => s.id === studentId);
        if (st) st.qr_code_id = cleanToken;
        this.save();
        return data as any;
      } catch (err: any) {
        console.warn('Supabase bind_student_qr_card RPC fallback to local execution:', err);
      }
    }

    const student = this.students.find((s) => s.id === studentId);
    if (!student) {
      return { success: false, message: 'Student record not found.' };
    }

    // Check duplicate card assignment (conflict check)
    const conflicting = this.students.find(
      (s) =>
        s.id !== studentId &&
        s.qr_code_id &&
        (s.qr_code_id === cleanToken || s.qr_code_id.toLowerCase() === cleanToken.toLowerCase())
    );

    if (conflicting) {
      const conflictUser = this.users.find((u) => u.id === conflicting.user_id);
      return {
        success: false,
        message: `Card Binding Conflict: This physical ID card QR code is already bound to ${conflictUser?.full_name || 'another student'} (${conflicting.matric_number}). Each physical card can only belong to one student.`
      };
    }

    student.qr_code_id = cleanToken;
    this.save();

    const user = this.users.find((u) => u.id === student.user_id);
    const tokenDescriptor = cleanToken.length === 32 ? '32-character university card token' : `${cleanToken.length}-character token`;

    return {
      success: true,
      qr_code_id: cleanToken,
      student_name: user?.full_name || student.matric_number,
      message: `✓ Physical ID card successfully bound (${tokenDescriptor}) to ${user?.full_name || 'Student'} (${student.matric_number})!`
    };
  }

  // --- Class Representative & Lecturer Session Controls ---

  createSession(params: {
    course_id: string;
    lecturer_id: string;
    admin_lat: number;
    admin_lon: number;
    geofence_radius_meters: number;
    custom_pin?: string;
    venue?: string;
    announcement?: string;
    auto_close_minutes?: number;
    anchor_device_name?: string;
  }): ClassSession {
    const pin =
      params.custom_pin && params.custom_pin.trim().length === 4
        ? params.custom_pin.trim()
        : Math.floor(1000 + Math.random() * 9000).toString();

    const newSession: ClassSession = {
      id: 'ses-' + Math.random().toString(36).substring(2, 9),
      course_id: params.course_id,
      lecturer_id: params.lecturer_id,
      session_pin: pin,
      start_time: new Date().toISOString(),
      is_active: true,
      admin_lat: params.admin_lat,
      admin_lon: params.admin_lon,
      geofence_radius_meters: params.geofence_radius_meters,
      venue: params.venue || 'Classroom / Lecture Hall',
      announcement: params.announcement || '',
      auto_close_minutes: params.auto_close_minutes || 0,
      anchor_device_name: params.anchor_device_name || "Course Representative's Phone"
    };

    this.sessions.unshift(newSession);
    this.save();
    return newSession;
  }

  endSession(sessionId: string): ClassSession | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.is_active = false;
      session.end_time = new Date().toISOString();
      this.save();
      notifySubscribers(`session_${sessionId}`, {
        eventType: 'UPDATE',
        session
      });
      return session;
    }
    return null;
  }

  // Geofence Fail-Safe: Recalibrate anchor to CR's live phone GPS
  recalibrateSessionAnchor(
    sessionId: string,
    newLat: number,
    newLon: number,
    anchorDeviceName: string = "Course Representative's Phone"
  ): ClassSession | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.admin_lat = newLat;
      session.admin_lon = newLon;
      session.anchor_device_name = anchorDeviceName;
      this.save();
      notifySubscribers(`session_${sessionId}`, {
        eventType: 'RECALIBRATE',
        session
      });
      return session;
    }
    return null;
  }

  updateSessionPin(sessionId: string, newPin: string): ClassSession | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session && newPin.trim().length === 4) {
      session.session_pin = newPin.trim();
      this.save();
      notifySubscribers(`session_${sessionId}`, {
        eventType: 'UPDATE_PIN',
        session
      });
      return session;
    }
    return null;
  }

  setSessionAnnouncement(sessionId: string, announcement: string): ClassSession | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.announcement = announcement.trim();
      this.save();
      notifySubscribers(`session_${sessionId}`, {
        eventType: 'ANNOUNCEMENT',
        session
      });
      return session;
    }
    return null;
  }

  // Manual Attendance Fail-Safe: Mark attendance for students with battery dead, network crash, or device issue
  manuallyMarkAttendance(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    reason: string = 'Physically verified by Course Representative',
    markedBy: string = 'Course Representative'
  ): AttendanceLog {
    const session = this.sessions.find((s) => s.id === sessionId);
    let log = this.logs.find(
      (l) => l.session_id === sessionId && l.student_id === studentId
    );

    if (log) {
      log.status = status;
      log.marked_by = markedBy;
      log.manual_reason = reason;
      log.notes = `Manual mark: ${reason} (Authorized by ${markedBy} at ${new Date().toLocaleTimeString()})`;
    } else {
      log = {
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        session_id: sessionId,
        student_id: studentId,
        checked_in_at: new Date().toISOString(),
        student_lat: session ? session.admin_lat : 0,
        student_lon: session ? session.admin_lon : 0,
        gps_accuracy_meters: 0,
        distance_calculated: 0,
        status,
        marked_by: markedBy,
        manual_reason: reason,
        notes: `Manual entry: ${reason} (Authorized by ${markedBy})`
      };
      this.logs.unshift(log);
    }

    this.save();
    notifySubscribers(`session_${sessionId}`, {
      eventType: 'UPDATE',
      log
    });
    return log;
  }

  overrideAttendanceStatus(
    logId: string,
    newStatus: AttendanceStatus
  ) {
    const log = this.logs.find((l) => l.id === logId);
    if (log) {
      log.status = newStatus;
      log.notes = `Status updated to ${newStatus} by Class Representative/Lecturer.`;
      this.save();
      notifySubscribers(`session_${log.session_id}`, {
        eventType: 'UPDATE',
        log
      });
      return log;
    }
    return null;
  }

  // --- Class Schedule & Timetable Management ---

  createSchedule(params: {
    course_id: string;
    day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
    start_time: string;
    end_time: string;
    venue: string;
    created_by?: string;
  }): ClassSchedule {
    const newSchedule: ClassSchedule = {
      id: 'sch-' + Math.random().toString(36).substring(2, 9),
      course_id: params.course_id,
      day_of_week: params.day_of_week,
      start_time: params.start_time,
      end_time: params.end_time,
      venue: params.venue,
      created_by: params.created_by
    };
    this.schedules.push(newSchedule);
    this.save();
    return newSchedule;
  }

  deleteSchedule(scheduleId: string): boolean {
    const len = this.schedules.length;
    this.schedules = this.schedules.filter((s) => s.id !== scheduleId);
    if (this.schedules.length !== len) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Enrollment Management ---

  enrollStudentInCourse(
    studentId: string,
    courseId: string,
    semester: string = 'First Semester',
    academicYear: string = '2026/2027'
  ): { success: boolean; message: string; enrollment?: Enrollment } {
    const existing = this.enrollments.find(
      (e) => e.student_id === studentId && e.course_id === courseId
    );
    if (existing) {
      return { success: false, message: 'Student is already enrolled in this course.' };
    }

    const newEnrollment: Enrollment = {
      id: 'enr-' + Math.random().toString(36).substring(2, 9),
      student_id: studentId,
      course_id: courseId,
      semester,
      academic_year: academicYear
    };

    this.enrollments.push(newEnrollment);
    this.save();
    return { success: true, message: 'Student enrolled successfully.', enrollment: newEnrollment };
  }

  unenrollStudentFromCourse(studentId: string, courseId: string): boolean {
    const initialLength = this.enrollments.length;
    this.enrollments = this.enrollments.filter(
      (e) => !(e.student_id === studentId && e.course_id === courseId)
    );
    if (this.enrollments.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  enrollAllStudentsFromDepartment(departmentId: string, courseId: string): number {
    const deptStudents = this.students.filter((s) => s.department_id === departmentId);
    let count = 0;
    deptStudents.forEach((st) => {
      const exists = this.enrollments.some(
        (e) => e.student_id === st.id && e.course_id === courseId
      );
      if (!exists) {
        this.enrollments.push({
          id: 'enr-' + Math.random().toString(36).substring(2, 9),
          student_id: st.id,
          course_id: courseId,
          semester: 'First Semester',
          academic_year: '2026/2027'
        });
        count++;
      }
    });
    if (count > 0) this.save();
    return count;
  }

  // --- Reporting Engine ---

  getAttendanceReport(filters?: {
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    courseId?: string;
  }): AttendanceReportSummary[] {
    const summaries: AttendanceReportSummary[] = [];

    // Filter relevant courses
    let filteredCourses = this.courses;
    if (filters?.courseId) {
      filteredCourses = filteredCourses.filter((c) => c.id === filters.courseId);
    }
    if (filters?.departmentId) {
      filteredCourses = filteredCourses.filter((c) => c.department_id === filters.departmentId);
    }

    filteredCourses.forEach((course) => {
      const dept = this.departments.find((d) => d.id === course.department_id);
      const enrollments = this.enrollments.filter((e) => e.course_id === course.id);

      // Filter sessions for this course within date range
      let courseSessions = this.sessions.filter((s) => s.course_id === course.id);
      if (filters?.startDate) {
        const start = new Date(filters.startDate).getTime();
        courseSessions = courseSessions.filter((s) => new Date(s.start_time).getTime() >= start);
      }
      if (filters?.endDate) {
        const end = new Date(filters.endDate).getTime() + 86400000;
        courseSessions = courseSessions.filter((s) => new Date(s.start_time).getTime() <= end);
      }

      const totalSessions = courseSessions.length;
      const sessionIds = new Set(courseSessions.map((s) => s.id));

      enrollments.forEach((enrollment) => {
        const student = this.students.find((st) => st.id === enrollment.student_id);
        if (!student) return;

        const user = this.users.find((u) => u.id === student.user_id);

        // Count sessions attended with 'Present' status
        const attended = this.logs.filter(
          (l) =>
            sessionIds.has(l.session_id) &&
            l.student_id === student.id &&
            l.status === 'Present'
        ).length;

        const percentage = totalSessions > 0 ? (attended / totalSessions) * 100 : 100;

        summaries.push({
          matric_number: student.matric_number,
          student_name: user ? user.full_name : 'Unknown Student',
          department_name: dept ? dept.name : 'Unknown Department',
          course_code: course.course_code,
          course_title: course.title,
          credit_load: course.credit_load,
          total_sessions: totalSessions,
          sessions_attended: attended,
          attendance_percentage: percentage
        });
      });
    });

    return summaries;
  }
}

export const aegisStore = new AegisStore();
