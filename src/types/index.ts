export type UserRole = 'student' | 'lecturer' | 'admin';

export type AttendanceStatus = 'Present' | 'Absent' | 'Flagged';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  device_fingerprint?: string;
  fingerprint_updated_at?: string;
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  created_at?: string;
}

export interface Student {
  id: string;
  user_id: string;
  matric_number: string;
  department_id: string;
  qr_code_id?: string;
  department?: Department;
  user?: UserProfile;
}

export interface Course {
  id: string;
  course_code: string;
  title: string;
  credit_load: number;
  department_id: string;
  lecturer_id?: string;
  department?: Department;
  lecturer?: UserProfile;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  semester: string;
  academic_year: string;
  student?: Student;
  course?: Course;
}

export interface ClassSchedule {
  id: string;
  course_id: string;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  start_time: string; // "09:00"
  end_time: string;   // "11:00"
  venue: string;      // "Engineering Amphitheatre B"
  created_by?: string;
  course?: Course;
}

export interface ClassSession {
  id: string;
  course_id: string;
  lecturer_id: string; // Can be lecturer ID or Class Rep ID
  session_pin: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
  admin_lat: number;
  admin_lon: number;
  geofence_radius_meters: number;
  venue?: string;
  announcement?: string;
  auto_close_minutes?: number;
  anchor_device_name?: string; // e.g. "Class Rep Phone (Galaxy S24 / iPhone)"
  course?: Course;
  lecturer?: UserProfile;
}

export interface AttendanceLog {
  id: string;
  session_id: string;
  student_id: string;
  checked_in_at: string;
  student_lat: number;
  student_lon: number;
  gps_accuracy_meters: number;
  distance_calculated: number;
  status: AttendanceStatus;
  notes?: string;
  marked_by?: string; // 'geofence_auto' | 'cr_manual_override' | 'lecturer_override'
  manual_reason?: string;
  student?: Student;
}

export interface AttendanceSubmissionResult {
  success: boolean;
  status: AttendanceStatus | 'Error';
  distance_meters: number | null;
  allowed_radius_meters?: number;
  gps_accuracy_meters?: number;
  message: string;
  student_name?: string;
  matric_number?: string;
  already_marked?: boolean;
}

export interface DeviceBindingResult {
  allowed: boolean;
  message: string;
}

export interface AttendanceReportSummary {
  matric_number: string;
  student_name: string;
  department_name: string;
  course_code: string;
  course_title: string;
  credit_load: number;
  total_sessions: number;
  sessions_attended: number;
  attendance_percentage: number;
}
