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
  AttendanceStatus,
  CsvStudentRow,
  BulkImportResult
} from '../types';
import { calculateHaversineDistance } from './geolocation';
import { matchStudentByMatricOrShorthand } from './matricHelper';

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
// INITIAL CLEAN DATA STORES (Zero hardcoded records - fully customizable)
// ==============================================================================

const INITIAL_DEPARTMENTS: Department[] = [];
const INITIAL_USERS: UserProfile[] = [];
const INITIAL_STUDENTS: Student[] = [];
const INITIAL_COURSES: Course[] = [];
const INITIAL_SCHEDULES: ClassSchedule[] = [];
const INITIAL_ENROLLMENTS: Enrollment[] = [];
const INITIAL_SESSIONS: ClassSession[] = [];
const INITIAL_LOGS: AttendanceLog[] = [];

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
    this.students = this.load('aegis_students', INITIAL_STUDENTS);
    this.courses = this.load('aegis_courses', INITIAL_COURSES);
    this.schedules = this.load('aegis_schedules', INITIAL_SCHEDULES);
    this.enrollments = this.load('aegis_enrollments', INITIAL_ENROLLMENTS);
    this.sessions = this.load('aegis_sessions', INITIAL_SESSIONS);
    this.logs = this.load('aegis_logs', INITIAL_LOGS);

    const savedUser = localStorage.getItem('aegis_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        this.currentUser = this.users.find((u) => u.id === parsed.id) || null;
      } catch {
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
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
    this.clearAllData();
  }

  clearAllData() {
    this.departments = [];
    this.users = [];
    this.students = [];
    this.courses = [];
    this.schedules = [];
    this.enrollments = [];
    this.sessions = [];
    this.logs = [];
    this.currentUser = null;
    localStorage.removeItem('aegis_departments');
    localStorage.removeItem('aegis_users');
    localStorage.removeItem('aegis_students');
    localStorage.removeItem('aegis_courses');
    localStorage.removeItem('aegis_schedules');
    localStorage.removeItem('aegis_enrollments');
    localStorage.removeItem('aegis_sessions');
    localStorage.removeItem('aegis_logs');
    localStorage.removeItem('aegis_current_user');
    localStorage.removeItem('aegis_admin_lock_enabled');
  }

  // --- Workaround 1: Offline Vault Export & Import (Zero External Database) ---

  exportVaultData(): string {
    const payload = {
      system: 'AegisRoll Offline Vault',
      version: '1.0',
      exported_at: new Date().toISOString(),
      counts: {
        students: this.students.length,
        courses: this.courses.length,
        sessions: this.sessions.length,
        logs: this.logs.length
      },
      departments: this.departments,
      users: this.users,
      students: this.students,
      courses: this.courses,
      schedules: this.schedules,
      enrollments: this.enrollments,
      sessions: this.sessions,
      logs: this.logs
    };
    return JSON.stringify(payload, null, 2);
  }

  importVaultData(jsonString: string): { success: boolean; message: string; count?: number } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.students)) {
        return { success: false, message: 'Invalid AegisRoll vault backup file. Missing student array.' };
      }
      if (Array.isArray(data.departments)) this.departments = data.departments;
      if (Array.isArray(data.users)) this.users = data.users;
      if (Array.isArray(data.students)) this.students = data.students;
      if (Array.isArray(data.courses)) this.courses = data.courses;
      if (Array.isArray(data.schedules)) this.schedules = data.schedules;
      if (Array.isArray(data.enrollments)) this.enrollments = data.enrollments;
      if (Array.isArray(data.sessions)) this.sessions = data.sessions;
      if (Array.isArray(data.logs)) this.logs = data.logs;

      this.save();
      return {
        success: true,
        message: `Vault successfully restored! Loaded ${this.students.length} students, ${this.courses.length} courses, and ${this.logs.length} attendance logs.`,
        count: this.students.length
      };
    } catch (err: any) {
      return { success: false, message: 'Failed to parse JSON file: ' + err.message };
    }
  }

  // --- Auth & Session Logic ---

  setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    this.save();
  }

  getInstitutionName(): string {
    return localStorage.getItem('aegis_institution_name') || 'University Academic Portal';
  }

  setInstitutionName(name: string): void {
    localStorage.setItem('aegis_institution_name', name.trim());
  }

  // --- Department Management (Fully Customizable) ---

  addDepartment(name: string, code: string): Department {
    const newDept: Department = {
      id: 'dept-' + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      created_at: new Date().toISOString()
    };
    this.departments.push(newDept);
    this.save();
    return newDept;
  }

  updateDepartment(id: string, name: string, code: string): boolean {
    const dept = this.departments.find((d) => d.id === id);
    if (!dept) return false;
    dept.name = name.trim();
    dept.code = code.trim().toUpperCase();
    this.save();
    return true;
  }

  deleteDepartment(id: string): { success: boolean; message: string } {
    const hasCourses = this.courses.some((c) => c.department_id === id);
    if (hasCourses) {
      return { success: false, message: 'Cannot delete department: courses are currently assigned to it.' };
    }
    const hasStudents = this.students.some((s) => s.department_id === id);
    if (hasStudents) {
      return { success: false, message: 'Cannot delete department: students are currently assigned to it.' };
    }
    this.departments = this.departments.filter((d) => d.id !== id);
    this.save();
    return { success: true, message: 'Department successfully deleted.' };
  }

  updateUserPassword(userId: string, newPass: string): boolean {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return false;
    user.password = newPass.trim();
    if (this.currentUser?.id === userId) {
      this.currentUser.password = newPass.trim();
    }
    this.save();
    return true;
  }

  resetPasswordByEmail(emailOrMatric: string, newPass: string): { success: boolean; message: string } {
    const clean = emailOrMatric.trim().toLowerCase();
    let user = this.users.find((u) => u.email.toLowerCase() === clean);
    if (!user) {
      const student = matchStudentByMatricOrShorthand(clean, this.students);
      if (student) {
        user = this.users.find((u) => u.id === student.user_id);
      }
    }
    if (!user) {
      return { success: false, message: 'No registered account found with this matriculation number or institutional email.' };
    }
    user.password = newPass.trim();
    if (this.currentUser?.id === user.id) {
      this.currentUser.password = newPass.trim();
    }
    this.save();
    return { success: true, message: `Password for ${user.full_name} has been successfully reset.` };
  }

  verifyUserPassword(emailOrId: string, passAttempt: string): boolean {
    let user = this.users.find(
      (u) => u.id === emailOrId || u.email.toLowerCase() === emailOrId.toLowerCase()
    );
    if (!user) {
      const student = matchStudentByMatricOrShorthand(emailOrId, this.students);
      if (student) {
        user = this.users.find((u) => u.id === student.user_id);
      }
    }
    if (!user || !user.password) return false;
    return user.password === passAttempt.trim();
  }

  isAdminLockEnabled(): boolean {
    return localStorage.getItem('aegis_admin_lock_enabled') === 'true';
  }

  setAdminLockEnabled(enabled: boolean) {
    localStorage.setItem('aegis_admin_lock_enabled', enabled ? 'true' : 'false');
  }

  getAdminUser(): UserProfile | undefined {
    return this.users.find((u) => u.role === 'admin');
  }

  // --- Course Rep Manual Attendance by Matriculation Number ---

  markAttendanceByMatricNumber(
    sessionId: string,
    matricNumber: string,
    status: AttendanceStatus = 'Present',
    studentName?: string,
    markedBy: string = 'Course Representative'
  ): { success: boolean; message: string; log?: AttendanceLog; student?: Student } {
    let cleanMatric = matricNumber.trim().toUpperCase();
    if (!cleanMatric) {
      return { success: false, message: 'Please enter a valid matriculation number.' };
    }

    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return { success: false, message: 'Active session not found.' };
    }

    // Dynamically match student (by exact matric, 4-digit serial [entry mode + serial], or dept+serial)
    let student = matchStudentByMatricOrShorthand(
      cleanMatric,
      this.students,
      session.course_id,
      this.enrollments
    );

    if (student) {
      cleanMatric = student.matric_number;
    } else if (/^\d{4}$/.test(cleanMatric)) {
      // Dynamic prefix derived from active course's department & entry year
      const course = this.courses.find((c) => c.id === session.course_id);
      const courseDept = course ? this.departments.find((d) => d.id === course.department_id) : null;
      const deptCode = courseDept ? courseDept.code.toUpperCase() : (this.departments[0]?.code || 'GEN');
      const year = new Date().getFullYear().toString().slice(-2);
      cleanMatric = `U${year}${deptCode}${cleanMatric}`;
    }

    // If student doesn't exist yet, automatically create student record and user profile
    if (!student) {
      const newUserId = 'usr-std-' + Math.random().toString(36).substring(2, 9);
      const studentFullName = studentName?.trim() || `Student (${cleanMatric})`;
      const defaultDeptId = this.departments[0]?.id || 'dept-general';

      const newUser: UserProfile = {
        id: newUserId,
        email: `${cleanMatric.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.edu`,
        full_name: studentFullName,
        role: 'student',
        password: 'password123',
        created_at: new Date().toISOString()
      };
      this.users.push(newUser);

      student = {
        id: 'std-' + Math.random().toString(36).substring(2, 9),
        user_id: newUserId,
        matric_number: cleanMatric.toUpperCase(),
        department_id: defaultDeptId,
        qr_code_id: `AR-QR-${cleanMatric.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`
      };
      this.students.push(student);
    }

    // Ensure student is enrolled in the session's course
    const isEnrolled = this.enrollments.some(
      (e) => e.student_id === student!.id && e.course_id === session.course_id
    );
    if (!isEnrolled) {
      this.enrollments.push({
        id: 'enr-' + Math.random().toString(36).substring(2, 9),
        student_id: student.id,
        course_id: session.course_id,
        semester: 'Current',
        academic_year: new Date().getFullYear().toString()
      });
    }

    // Record attendance
    const log = this.manuallyMarkAttendance(
      sessionId,
      student.id,
      status,
      `Manual Roll-Call by Course Rep (Matric: ${cleanMatric})`,
      markedBy
    );

    const user = this.users.find((u) => u.id === student!.user_id);
    const displayName = user?.full_name || student.matric_number;

    return {
      success: true,
      message: `Marked ${status}: ${displayName} (${student.matric_number})`,
      log,
      student
    };
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

    // Resolve student record dynamically without hardcoded departments
    let targetStudent: Student | null | undefined = this.students.find((s) => s.id === studentIdOrMatric);
    const candidateMatric = (matricNumber || studentIdOrMatric).trim().toUpperCase();
    if (!targetStudent && candidateMatric) {
      targetStudent = matchStudentByMatricOrShorthand(
        candidateMatric,
        this.students,
        session.course_id,
        this.enrollments
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
      targetStudent = matchStudentByMatricOrShorthand(
        rawTrimmed,
        this.students,
        session.course_id,
        this.enrollments
      ) || undefined;
    }

    if (!targetStudent) {
      // Auto-create student record if a matric code or student pass is scanned
      let cleanMatric = rawTrimmed.toUpperCase().replace(/^AR-QR-/, '');
      if (/^\d{4}$/.test(cleanMatric)) {
        const course = this.courses.find((c) => c.id === session.course_id);
        const courseDept = course ? this.departments.find((d) => d.id === course.department_id) : null;
        const deptCode = courseDept ? courseDept.code.toUpperCase() : (this.departments[0]?.code || 'GEN');
        const year = new Date().getFullYear().toString().slice(-2);
        cleanMatric = `U${year}${deptCode}${cleanMatric}`;
      }

      if (cleanMatric.length >= 3) {
        const newUserId = 'usr-std-' + Math.random().toString(36).substring(2, 9);
        const defaultDeptId = this.departments[0]?.id || 'dept-general';
        const newUser: UserProfile = {
          id: newUserId,
          email: `${cleanMatric.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.edu`,
          full_name: `Student (${cleanMatric})`,
          role: 'student',
          password: 'password123',
          created_at: new Date().toISOString()
        };
        this.users.push(newUser);

        targetStudent = {
          id: 'std-' + Math.random().toString(36).substring(2, 9),
          user_id: newUserId,
          matric_number: cleanMatric.toUpperCase(),
          department_id: defaultDeptId,
          qr_code_id: rawTrimmed
        };
        this.students.push(targetStudent);
      } else {
        return {
          success: false,
          status: 'Error',
          distance_meters: null,
          message: `Unrecognized student QR code or matriculation number: "${qrCodeIdOrMatric}".`
        };
      }
    }

    // Ensure student is enrolled in the session's course
    const isEnrolled = this.enrollments.some(
      (e) => e.student_id === targetStudent!.id && e.course_id === session.course_id
    );
    if (!isEnrolled) {
      this.enrollments.push({
        id: 'enr-' + Math.random().toString(36).substring(2, 9),
        student_id: targetStudent.id,
        course_id: session.course_id,
        semester: 'Current',
        academic_year: new Date().getFullYear().toString()
      });
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

  // --- Bulk CSV Import of Student Rosters ---
  bulkImportStudents(
    rows: CsvStudentRow[],
    options?: {
      defaultDepartmentId?: string;
      targetCourseId?: string;
      updateExisting?: boolean;
    }
  ): BulkImportResult {
    const result: BulkImportResult = {
      totalRows: rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      enrolled: 0,
      errors: []
    };

    const updateExisting = options?.updateExisting ?? true;
    let defaultDeptId = options?.defaultDepartmentId;
    if (!defaultDeptId && this.departments.length > 0) {
      defaultDeptId = this.departments[0].id;
    }
    if (!defaultDeptId) {
      const generalDept = this.addDepartment('General Academic Studies', 'GEN');
      defaultDeptId = generalDept.id;
    }

    rows.forEach((row, index) => {
      const lineNum = index + 1;
      let cleanMatric = row.matric_number ? row.matric_number.trim().toUpperCase() : '';
      if (!cleanMatric) {
        result.errors.push(`Row #${lineNum}: Missing matriculation number.`);
        result.skipped++;
        return;
      }
      // If student matric is 4 digits, dynamically prefix with target department code if available
      if (/^\d{4}$/.test(cleanMatric)) {
        let deptCode = 'GEN';
        if (row.department_code) {
          deptCode = row.department_code.trim().toUpperCase();
        } else if (defaultDeptId) {
          const d = this.departments.find((dep) => dep.id === defaultDeptId);
          if (d) deptCode = d.code.toUpperCase();
        }
        const year = new Date().getFullYear().toString().slice(-2);
        cleanMatric = `U${year}${deptCode}${cleanMatric}`;
      }

      const cleanName = row.full_name ? row.full_name.trim() : `Student (${cleanMatric})`;
      const cleanEmail = row.email && row.email.trim()
        ? row.email.trim().toLowerCase()
        : `${cleanMatric.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.edu`;

      // Resolve department
      let deptId = defaultDeptId;
      if (row.department_code && row.department_code.trim()) {
        const dCode = row.department_code.trim().toUpperCase();
        let matched = this.departments.find(
          (d) => d.code.toUpperCase() === dCode || d.name.toUpperCase().includes(dCode)
        );
        if (!matched) {
          matched = this.addDepartment(dCode + ' Department', dCode);
        }
        deptId = matched.id;
      }

      // Check existing student
      let student = this.students.find(
        (s) => s.matric_number.toUpperCase() === cleanMatric
      );

      if (student) {
        if (updateExisting) {
          const user = this.users.find((u) => u.id === student!.user_id);
          if (user) {
            user.full_name = cleanName;
            if (row.email) user.email = cleanEmail;
          }
          student.department_id = deptId;
          if (row.card_qr && row.card_qr.trim().length >= 4) {
            student.qr_code_id = row.card_qr.trim();
          }
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Create new user and student
        const newUserId = 'usr-' + Math.random().toString(36).substring(2, 9);
        const newUser: UserProfile = {
          id: newUserId,
          email: cleanEmail,
          full_name: cleanName,
          role: 'student',
          password: 'password123',
          created_at: new Date().toISOString()
        };
        this.users.push(newUser);

        const cardQr = row.card_qr && row.card_qr.trim().length >= 4
          ? row.card_qr.trim()
          : `AR-QR-${cleanMatric.replace(/[^A-Za-z0-9]/g, '')}`;

        student = {
          id: 'std-' + Math.random().toString(36).substring(2, 9),
          user_id: newUserId,
          matric_number: cleanMatric,
          department_id: deptId,
          qr_code_id: cardQr
        };
        this.students.push(student);
        result.imported++;
      }

      // Course Enrollment
      const enrollInCourse = (courseId: string) => {
        const alreadyEnrolled = this.enrollments.some(
          (e) => e.student_id === student!.id && e.course_id === courseId
        );
        if (!alreadyEnrolled) {
          this.enrollments.push({
            id: 'enr-' + Math.random().toString(36).substring(2, 9),
            student_id: student!.id,
            course_id: courseId,
            semester: 'Current',
            academic_year: new Date().getFullYear().toString()
          });
          result.enrolled++;
        }
      };

      if (options?.targetCourseId) {
        enrollInCourse(options.targetCourseId);
      }

      if (row.course_code && row.course_code.trim()) {
        const cCode = row.course_code.trim().toUpperCase();
        let course = this.courses.find((c) => c.course_code.toUpperCase() === cCode);
        if (!course) {
          course = {
            id: 'crs-' + Math.random().toString(36).substring(2, 9),
            course_code: cCode,
            title: cCode + ' Course',
            credit_load: 3,
            department_id: deptId
          };
          this.courses.push(course);
        }
        enrollInCourse(course.id);
      }
    });

    this.save();
    return result;
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

  // Pre-Deployment & Historical Attendance Recording (Backdating Past Weeks)
  recordHistoricalSession(params: {
    course_id: string;
    lecturer_id: string;
    session_date: string;
    week_label?: string;
    venue?: string;
    present_student_ids: string[];
    absent_student_ids?: string[];
    notes?: string;
  }): { session: ClassSession; logsCreated: number } {
    const sessionDate = new Date(params.session_date);
    const validDateStr = isNaN(sessionDate.getTime()) ? new Date().toISOString() : sessionDate.toISOString();

    const newSession: ClassSession = {
      id: 'ses-hist-' + Math.random().toString(36).substring(2, 9),
      course_id: params.course_id,
      lecturer_id: params.lecturer_id,
      session_pin: 'PAST',
      start_time: validDateStr,
      end_time: validDateStr,
      is_active: false,
      admin_lat: 0,
      admin_lon: 0,
      geofence_radius_meters: 0,
      venue: params.venue || 'Classroom (Pre-Deployment Register)',
      announcement: params.week_label ? `Historical Session: ${params.week_label}` : 'Pre-deployment historical session',
      auto_close_minutes: 0,
      anchor_device_name: 'Pre-Deployment Paper Register / Archive'
    };

    this.sessions.unshift(newSession);

    let logsCount = 0;
    params.present_student_ids.forEach((studentId) => {
      this.logs.unshift({
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        session_id: newSession.id,
        student_id: studentId,
        checked_in_at: validDateStr,
        student_lat: 0,
        student_lon: 0,
        gps_accuracy_meters: 0,
        distance_calculated: 0,
        status: 'Present',
        marked_by: 'historical_archive',
        manual_reason: `Pre-deployment register entry (${params.week_label || 'Past Week'})`,
        notes: params.notes || 'Retroactive entry before AegisRoll deployment'
      });
      logsCount++;
    });

    if (params.absent_student_ids) {
      params.absent_student_ids.forEach((studentId) => {
        this.logs.unshift({
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          session_id: newSession.id,
          student_id: studentId,
          checked_in_at: validDateStr,
          student_lat: 0,
          student_lon: 0,
          gps_accuracy_meters: 0,
          distance_calculated: 0,
          status: 'Absent',
          marked_by: 'historical_archive',
          manual_reason: `Pre-deployment register absence (${params.week_label || 'Past Week'})`,
          notes: params.notes || 'Retroactive entry before AegisRoll deployment'
        });
        logsCount++;
      });
    }

    this.save();
    return { session: newSession, logsCreated: logsCount };
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
