# AegisRoll 🎓🛡️
### *Verified Presence. Academic Integrity.*

**AegisRoll** is a production-ready, zero-install Progressive Web App (PWA) engineered for higher education academic attendance governance. It replaces fragile manual sign-in sheets, vulnerability-prone QR codes, and expensive Bluetooth/hardware beacons with dynamic classroom geofencing, browser device fingerprinting, and cryptographic auditability.

Designed specifically for modern cloud architectures:
- **Frontend / Client PWA:** React + Vite + TypeScript + Tailwind CSS, optimized for zero-configuration static hosting on **Netlify**.
- **Backend / Database:** **Supabase** (PostgreSQL 15+, Row Level Security, Realtime WebSockets, and Haversine RPC functions).

---

## 🏛️ Brand & Architectural Highlights

- **Formal Academic SaaS Styling:** Oxford Navy (`#0F2137`), Academic Teal (`#26B9A8`), Prestige Gold (`#D9B354`), Crisp Off-White (`#F8FAFC`), and Slate borders (`#E2E8F0`).
- **Typography:** Serif headings (`Merriweather` / `Playfair Display`) paired with crisp tabular data sans-serif (`Inter`).
- **Zero-Install PWA:** Functions as a native app on iOS Safari and Android Chrome with standalone home screen launch, offline caching, and responsive layouts.
- **Multi-Format Audit Engine:**
  - **CSV Exports** powered by `papaparse` for registrar gradebook imports.
  - **Authoritative PDF Audits** styled with Oxford Navy headers, institution metadata, and Course Lecturer & Dean of Faculty signature certification lines via `jspdf` & `jspdf-autotable`.
  - **Word Document (.docx) Records** generated with authentic Microsoft Word table layouts, typography, and registrar attestation statements via `docx`.

---

## 📍 Dynamic Classroom Geofencing Protocol

### 1. Haversine Distance Computation
When a student submits attendance, the client provides their coordinates `(student_lat, student_lon)` along with horizontal accuracy `accuracy_meters`. The PostgreSQL RPC `submit_attendance` computes the exact terrestrial great-circle distance against the lecturer's locked coordinates `(admin_lat, admin_lon)` using the Haversine formula (Earth mean radius $R = 6,371,000\text{ m}$):

$$\Delta\sigma = 2 \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lon}}{2}\right)} \right)$$

$$\text{Distance} = R \cdot \Delta\sigma$$

### 2. Fair Indoor GPS Grace Buffer
Thick concrete lecture halls and multi-story university buildings cause multi-path GPS degradation. AegisRoll implements a fair indoor grace buffer to eliminate false absences while strictly bounding fraud:

$$\text{Effective Allowed Radius} = \text{Radius} + \min(\text{Accuracy} \times 0.5, 25.0)$$

- If $\text{Distance} \le \text{Effective Allowed Radius}$, attendance is marked **Present**.
- If $\text{Distance} > \text{Effective Allowed Radius}$, attendance is marked **Flagged** with the exact distance discrepancy and streamed in real time to the lecturer's monitor for review and one-click override.

### 3. Anti-Proxy Device Fingerprinting
To prevent "proxy check-ins" (a student in class checking in on behalf of absent dorm mates), AegisRoll integrates **FingerprintJS**:
- A student's device fingerprint is bound to `users.device_fingerprint`.
- The system enforces a **12-hour lockout rule**: If another student account attempts to submit attendance using the same device fingerprint within 12 hours, the submission is blocked with an anti-proxy security notice.

---

## 🗄️ Database Schema & Server-Side RPC (`schema.sql`)

The repository includes a complete, runnable `schema.sql` file providing:

1. **Tables:**
   - `departments` (`id`, `name`, `code`)
   - `users` (`id`, `full_name`, `email`, `role`, `device_fingerprint`, `fingerprint_updated_at`)
   - `students` (`id`, `user_id`, `matric_number`, `department_id`)
   - `courses` (`id`, `course_code`, `title`, `credit_load`, `department_id`, `lecturer_id`)
   - `enrollments` (`id`, `student_id`, `course_id`, `semester`, `academic_year`)
   - `class_sessions` (`id`, `course_id`, `lecturer_id`, `session_pin`, `start_time`, `end_time`, `is_active`, `admin_lat`, `admin_lon`, `geofence_radius_meters`)
   - `attendance_logs` (`id`, `session_id`, `student_id`, `checked_in_at`, `student_lat`, `student_lon`, `gps_accuracy_meters`, `distance_calculated`, `status`)
2. **PostgreSQL RPCs:**
   - `submit_attendance(p_session_id, p_student_id, p_session_pin, p_student_lat, p_student_lon, p_accuracy)`
   - `bind_or_validate_device(p_user_id, p_fingerprint)`
3. **Row Level Security (RLS) Policies:**
   - Students can only view their own enrollments, active sessions, and submitted logs.
   - Lecturers can create sessions for their assigned courses and update logs for those sessions.
   - Admins possess comprehensive auditing read/write access.
4. **Realtime Replication:**
   - Realtime publication on `attendance_logs` and `class_sessions`.

---

## 🚀 Quick Start & Evaluation

### 1. Zero-Install Instant Evaluation (Demo Mode)
AegisRoll features an integrated in-memory reactive data store backed by `localStorage` and seeded with university departments, courses, students, and live sessions:
- Open the application in your browser.
- Use the **Fast Role Switcher** in the top navigation bar to switch between:
  - **Student (Alex Chen):** Enter the 4-digit PIN, test high-accuracy GPS check-in (or toggle simulated podium/outside coordinates), and view verified presence badges.
  - **Lecturer (Dr. Gregory Adams):** Launch a new class session with custom 50m/75m/100m geofence, open the large auditorium PIN projection display, monitor incoming check-ins in real time, and override flagged entries.
  - **Institution Admin:** Audit student attendance across courses, filter by date and department, perform bulk student CSV uploads, and download **CSV**, **PDF**, or **Word (.docx)** reports.

### 2. Connecting to Live Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor**, paste the contents of [`schema.sql`](file:///c:/Users/USER/Downloads/AegisRoll/schema.sql), and run it.
3. In AegisRoll, click the **Database Pill** in the top navbar and input your:
   - `Supabase Project URL` (e.g. `https://your-project.supabase.co`)
   - `Supabase Anon Key` (e.g. `eyJhbGciOiJIUzI1Ni...`)
4. Click **Save & Reload** to switch seamlessly from Demo Mode to Live Supabase!

---

## 🌐 Netlify Deployment Guide

1. **Option A: Netlify Git Continuous Deployment**
   - Push this repository to GitHub or GitLab.
   - In Netlify, click **Add new site** -> **Import an existing project**.
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add Environment Variables:
     - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
   - Deploy! Netlify automatically honors [`netlify.toml`](file:///c:/Users/USER/Downloads/AegisRoll/netlify.toml) with SPA redirects and security headers.

2. **Option B: Manual Netlify CLI Deploy**
   ```bash
   npm run build
   npx netlify-cli deploy --prod --dir=dist
   ```

---

## 💻 Tech Stack Summary

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Bundler & Build** | Vite 6 |
| **Styling & Icons** | Tailwind CSS + Lucide React |
| **PWA & Offline** | Web Manifest + Service Worker + Standalone Meta |
| **Database & Auth** | Supabase JS Client (`@supabase/supabase-js`) |
| **Device Fingerprint** | `@fingerprintjs/fingerprintjs` |
| **Data Exports** | `papaparse` (CSV), `jspdf` + `jspdf-autotable` (PDF), `docx` + `file-saver` (Word) |
| **Geofencing** | HTML5 Geolocation API (`highAccuracy: true`) + PostgreSQL Haversine RPC |

---

© 2026 AegisRoll Systems. All rights reserved.
