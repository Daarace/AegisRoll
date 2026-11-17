-- ==============================================================================
-- AegisRoll: Academic Class Attendance Tracking System with Dynamic Geofencing
-- Database Schema, Functions, RLS Policies & Seed Data for Supabase (PostgreSQL)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM & DOMAIN TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Flagged');
    END IF;
END $$;

-- 3. TABLES

-- 3.1 Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.2 User Profiles (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'student',
    device_fingerprint VARCHAR(255),
    fingerprint_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.3 Students Detail Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    matric_number VARCHAR(50) NOT NULL UNIQUE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    qr_code_id VARCHAR(100) UNIQUE DEFAULT ('AR-QR-' || upper(substr(md5(random()::text), 1, 8))),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS qr_code_id VARCHAR(100) UNIQUE;

-- 3.4 Courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    credit_load INTEGER NOT NULL DEFAULT 3 CHECK (credit_load > 0),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    lecturer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.5 Enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    semester VARCHAR(50) NOT NULL DEFAULT 'First Semester',
    academic_year VARCHAR(50) NOT NULL DEFAULT '2026/2027',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_student_course_enrollment UNIQUE (student_id, course_id, semester, academic_year)
);

-- 3.6 Class Schedules (Managed by Class Representative & Course Lecturers)
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.7 Class Sessions (Dynamic Geofenced Attendance Sessions)
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lecturer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_pin VARCHAR(4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    admin_lat DOUBLE PRECISION NOT NULL,
    admin_lon DOUBLE PRECISION NOT NULL,
    geofence_radius_meters INTEGER NOT NULL DEFAULT 75 CHECK (geofence_radius_meters BETWEEN 20 AND 500),
    venue VARCHAR(255) DEFAULT 'Classroom / Lecture Hall',
    announcement TEXT,
    auto_close_minutes INTEGER DEFAULT 0,
    anchor_device_name VARCHAR(255) DEFAULT 'Class Representative Phone',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8 Attendance Logs
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    student_lat DOUBLE PRECISION NOT NULL,
    student_lon DOUBLE PRECISION NOT NULL,
    gps_accuracy_meters DOUBLE PRECISION NOT NULL,
    distance_calculated DOUBLE PRECISION NOT NULL,
    status attendance_status NOT NULL DEFAULT 'Present',
    marked_by VARCHAR(50) DEFAULT 'geofence_auto',
    manual_reason TEXT,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    CONSTRAINT unique_student_session_attendance UNIQUE (session_id, student_id)
);

-- 4. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON public.users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_students_matric ON public.students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_qr_code_id ON public.students(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON public.courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON public.class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.class_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_logs(student_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5.1 Departments Policies
CREATE POLICY "Departments are viewable by all authenticated users"
ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Departments manageable by admins only"
ON public.departments FOR ALL TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 5.2 Users Profiles Policies
CREATE POLICY "Users can read own profile or lecturers/admins can view relevant profiles"
ON public.users FOR SELECT TO authenticated
USING (
    id = auth.uid() 
    OR public.get_current_user_role() IN ('lecturer', 'admin')
);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins have full access to users"
ON public.users FOR ALL TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 5.3 Students Policies
CREATE POLICY "Students can view their own student record"
ON public.students FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR public.get_current_user_role() IN ('lecturer', 'admin')
);

CREATE POLICY "Admins can manage students"
ON public.students FOR ALL TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 5.4 Courses Policies
CREATE POLICY "Courses viewable by enrolled students, assigned lecturers, or admins"
ON public.courses FOR SELECT TO authenticated
USING (
    public.get_current_user_role() = 'admin'
    OR lecturer_id = auth.uid()
    OR id IN (
        SELECT e.course_id FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.user_id = auth.uid()
    )
);

CREATE POLICY "Lecturers can update their assigned courses"
ON public.courses FOR UPDATE TO authenticated
USING (lecturer_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins have full course control"
ON public.courses FOR ALL TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 5.5 Enrollments Policies
CREATE POLICY "Students can view their own enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR public.get_current_user_role() IN ('lecturer', 'admin')
);

CREATE POLICY "Admins can manage enrollments"
ON public.enrollments FOR ALL TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 5.6 Class Sessions Policies
CREATE POLICY "Anyone authenticated can view active sessions for courses they attend/teach"
ON public.class_sessions FOR SELECT TO authenticated
USING (
    public.get_current_user_role() = 'admin'
    OR lecturer_id = auth.uid()
    OR (is_active = TRUE AND course_id IN (
        SELECT e.course_id FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "Lecturers can insert sessions for their courses"
ON public.class_sessions FOR INSERT TO authenticated
WITH CHECK (
    lecturer_id = auth.uid() 
    OR public.get_current_user_role() = 'admin'
);

CREATE POLICY "Lecturers can update sessions they created"
ON public.class_sessions FOR UPDATE TO authenticated
USING (
    lecturer_id = auth.uid() 
    OR public.get_current_user_role() = 'admin'
);

-- 5.7 Attendance Logs Policies
CREATE POLICY "Students can view their own attendance logs"
ON public.attendance_logs FOR SELECT TO authenticated
USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR session_id IN (SELECT id FROM public.class_sessions WHERE lecturer_id = auth.uid())
    OR public.get_current_user_role() = 'admin'
);

CREATE POLICY "Lecturers can update attendance logs for their sessions (e.g. approve flagged)"
ON public.attendance_logs FOR UPDATE TO authenticated
USING (
    session_id IN (SELECT id FROM public.class_sessions WHERE lecturer_id = auth.uid())
    OR public.get_current_user_role() = 'admin'
);

-- 6. CORE POSTGRESQL RPC FUNCTION: submit_attendance
CREATE OR REPLACE FUNCTION public.submit_attendance(
    p_session_id UUID,
    p_student_id UUID,
    p_session_pin VARCHAR(4),
    p_student_lat DOUBLE PRECISION,
    p_student_lon DOUBLE PRECISION,
    p_accuracy DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_student RECORD;
    v_distance DOUBLE PRECISION;
    v_status attendance_status;
    v_effective_allowed_radius DOUBLE PRECISION;
    v_existing_log RECORD;
    v_result JSONB;
BEGIN
    -- 1. Validate Session Existence & Active Status
    SELECT * INTO v_session
    FROM public.class_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'Error',
            'distance_meters', NULL,
            'message', 'Class session not found.'
        );
    END IF;

    IF v_session.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'Error',
            'distance_meters', NULL,
            'message', 'This class session is closed or inactive.'
        );
    END IF;

    -- 2. Validate Session PIN
    IF v_session.session_pin <> TRIM(p_session_pin) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'Error',
            'distance_meters', NULL,
            'message', 'Invalid 4-digit session PIN. Please verify with lecturer.'
        );
    END IF;

    -- 3. Validate Student Existence
    SELECT * INTO v_student
    FROM public.students
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'Error',
            'distance_meters', NULL,
            'message', 'Student record not found.'
        );
    END IF;

    -- 4. Check for existing attendance check-in
    SELECT * INTO v_existing_log
    FROM public.attendance_logs
    WHERE session_id = p_session_id AND student_id = p_student_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', v_existing_log.status,
            'distance_meters', v_existing_log.distance_calculated,
            'message', 'You have already submitted attendance for this session. Current status: ' || v_existing_log.status
        );
    END IF;

    -- 5. Calculate Distance using the Haversine Formula (Earth radius ~ 6,371,000 meters)
    v_distance := 6371000 * 2 * ASIN(
        SQRT(
            POWER(SIN(RADIANS(p_student_lat - v_session.admin_lat) / 2), 2) +
            COS(RADIANS(v_session.admin_lat)) * COS(RADIANS(p_student_lat)) *
            POWER(SIN(RADIANS(p_student_lon - v_session.admin_lon) / 2), 2)
        )
    );

    -- 6. Apply Fair Indoor GPS Grace Buffer:
    -- v_distance <= (v_radius + LEAST(p_accuracy * 0.5, 25))
    v_effective_allowed_radius := v_session.geofence_radius_meters + LEAST(COALESCE(p_accuracy, 10.0) * 0.5, 25.0);

    IF v_distance <= v_effective_allowed_radius THEN
        v_status := 'Present';
    ELSE
        v_status := 'Flagged';
    END IF;

    -- 7. Insert attendance log
    INSERT INTO public.attendance_logs (
        session_id,
        student_id,
        checked_in_at,
        student_lat,
        student_lon,
        gps_accuracy_meters,
        distance_calculated,
        status,
        notes
    ) VALUES (
        p_session_id,
        p_student_id,
        timezone('utc'::text, now()),
        p_student_lat,
        p_student_lon,
        p_accuracy,
        ROUND(v_distance::NUMERIC, 2),
        v_status,
        CASE 
            WHEN v_status = 'Flagged' THEN 'Location flagged outside geofence boundary (' || ROUND(v_distance::NUMERIC, 1) || 'm > ' || ROUND(v_effective_allowed_radius::NUMERIC, 1) || 'm threshold).'
            ELSE 'Verified inside classroom boundary.'
        END
    );

    -- 8. Return response payload
    v_result := jsonb_build_object(
        'success', TRUE,
        'status', v_status,
        'distance_meters', ROUND(v_distance::NUMERIC, 2),
        'allowed_radius_meters', ROUND(v_effective_allowed_radius::NUMERIC, 2),
        'gps_accuracy_meters', p_accuracy,
        'message', CASE 
            WHEN v_status = 'Present' THEN 'Attendance successfully verified! You are marked Present.'
            ELSE 'Attendance flagged: Your location is calculated as ' || ROUND(v_distance::NUMERIC, 1) || 'm from the lecturer. Awaiting lecturer review.'
        END
    );

    RETURN v_result;
END;
$$;

-- 6.2 BACKUP QR CODE ATTENDANCE CHECK-IN RPC (GEOFENCE BYPASS)
-- Verifies and registers attendance by scanning the student's unique QR code ID without geofencing
CREATE OR REPLACE FUNCTION public.submit_attendance_by_qr(
    p_session_id UUID,
    p_qr_code_id VARCHAR,
    p_marked_by VARCHAR DEFAULT 'qr_scanner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_student RECORD;
    v_existing_log RECORD;
    v_user RECORD;
    v_result JSONB;
BEGIN
    -- 1. Validate Session
    SELECT * INTO v_session FROM public.class_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'status', 'Error', 'distance_meters', NULL, 'message', 'Class session not found.');
    END IF;

    IF v_session.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'status', 'Error', 'distance_meters', NULL, 'message', 'This class session is closed or inactive.');
    END IF;

    -- 2. Find Student by QR Code ID or Matriculation Number
    SELECT s.*, u.full_name, u.email INTO v_student
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.qr_code_id = TRIM(p_qr_code_id)
       OR s.matric_number = TRIM(p_qr_code_id)
       OR s.id::text = TRIM(p_qr_code_id);

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'Error',
            'distance_meters', NULL,
            'message', 'Student with QR code ID "' || p_qr_code_id || '" not found in university database.'
        );
    END IF;

    -- 3. Check for existing attendance check-in
    SELECT * INTO v_existing_log
    FROM public.attendance_logs
    WHERE session_id = p_session_id AND student_id = v_student.id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'status', v_existing_log.status,
            'already_marked', TRUE,
            'student_name', v_student.full_name,
            'matric_number', v_student.matric_number,
            'distance_meters', v_existing_log.distance_calculated,
            'message', v_student.full_name || ' (' || v_student.matric_number || ') is already checked in as ' || v_existing_log.status || '.'
        );
    END IF;

    -- 4. Insert Attendance Log with Geofence Bypass (admin coordinates, zero distance, Present status)
    INSERT INTO public.attendance_logs (
        session_id,
        student_id,
        checked_in_at,
        student_lat,
        student_lon,
        gps_accuracy_meters,
        distance_calculated,
        status,
        marked_by,
        notes
    ) VALUES (
        p_session_id,
        v_student.id,
        timezone('utc'::text, now()),
        v_session.admin_lat,
        v_session.admin_lon,
        0,
        0,
        'Present',
        COALESCE(p_marked_by, 'qr_scanner'),
        'Backup sign-in verified via student unique QR Code pass: ' || COALESCE(v_student.qr_code_id, p_qr_code_id)
    );

    -- 5. Return success payload
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'Present',
        'student_id', v_student.id,
        'student_name', v_student.full_name,
        'matric_number', v_student.matric_number,
        'distance_meters', 0,
        'marked_by', COALESCE(p_marked_by, 'qr_scanner'),
        'message', '✓ ' || v_student.full_name || ' (' || v_student.matric_number || ') verified & marked Present via QR Pass!'
    );
END;
$$;

-- 6.3 PHYSICAL ID CARD BINDING RPC
-- Binds an existing physical ID card QR code (e.g. 32-character random string) to a student
CREATE OR REPLACE FUNCTION public.bind_student_qr_card(
    p_student_id UUID,
    p_qr_code_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_token VARCHAR;
    v_conflicting RECORD;
    v_student RECORD;
BEGIN
    v_clean_token := TRIM(p_qr_code_id);
    IF v_clean_token IS NULL OR length(v_clean_token) < 4 THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid card QR code token.');
    END IF;

    -- Check if student exists
    SELECT s.*, u.full_name INTO v_student
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.id = p_student_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Student record not found.');
    END IF;

    -- Check if another student has already bound this exact physical ID card token
    SELECT s.*, u.full_name INTO v_conflicting
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE (s.qr_code_id = v_clean_token OR lower(s.qr_code_id) = lower(v_clean_token))
      AND s.id <> p_student_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Card Binding Conflict: This physical ID card QR token is already bound to another student (' || v_conflicting.full_name || ' - ' || v_conflicting.matric_number || '). Each card must be uniquely bound.'
        );
    END IF;

    -- Bind token to student
    UPDATE public.students
    SET qr_code_id = v_clean_token
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'student_id', p_student_id,
        'student_name', v_student.full_name,
        'matric_number', v_student.matric_number,
        'qr_code_id', v_clean_token,
        'token_length', length(v_clean_token),
        'message', 'Physical ID card (' || length(v_clean_token) || '-char token) bound successfully to ' || v_student.full_name || ' (' || v_student.matric_number || ').'
    );
END;
$$;

-- 7. DEVICE BINDING & ANTI-PROXY CHECK RPC
-- Checks if this fingerprint is already bound, or if used by another student within 12 hours
CREATE OR REPLACE FUNCTION public.bind_or_validate_device(
    p_user_id UUID,
    p_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_user RECORD;
    v_conflicting_user RECORD;
BEGIN
    SELECT * INTO v_current_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', FALSE, 'message', 'User not found.');
    END IF;

    -- Only enforce strict 12-hour device binding for student accounts
    IF v_current_user.role <> 'student' THEN
        RETURN jsonb_build_object('allowed', TRUE, 'message', 'Staff role bypassed.');
    END IF;

    -- Check if another student has used this device fingerprint in the last 12 hours
    SELECT * INTO v_conflicting_user
    FROM public.users
    WHERE device_fingerprint = p_fingerprint
      AND id <> p_user_id
      AND role = 'student'
      AND fingerprint_updated_at > (timezone('utc'::text, now()) - INTERVAL '12 hours');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'message', 'Proxy prevention triggered: This device was used by another student (' || v_conflicting_user.full_name || ') within the last 12 hours. Please use your own registered device.'
        );
    END IF;

    -- Bind or update the current user's device fingerprint
    UPDATE public.users
    SET device_fingerprint = p_fingerprint,
        fingerprint_updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    RETURN jsonb_build_object('allowed', TRUE, 'message', 'Device verified and bound successfully.');
END;
$$;

-- 8. REALTIME REPLICATION CONFIGURATION
-- Enables live attendance tracking for lecturers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'class_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sessions;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore if publication doesn't exist yet in local non-supabase environment
END $$;

-- 9. SEED DATA (For development, demonstration, and immediate testing)
INSERT INTO public.departments (id, name, code)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Department of Computer Science & Engineering', 'CSE'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Department of Electrical & Electronics Engineering', 'EEE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Department of Information Systems', 'IFS')
ON CONFLICT (code) DO NOTHING;
