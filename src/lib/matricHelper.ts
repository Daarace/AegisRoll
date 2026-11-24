import { Student, Enrollment } from '../types';

export interface MatricBreakdown {
  programme: string; // e.g. 'U' (Undergraduate), 'P' (Postgraduate)
  year: string; // e.g. '24' (2024), '23' (2023)
  deptCode: string; // e.g. 'MTH', 'CSC', 'EEE'
  entryMode: string; // '1' = UTME, '2' = Direct Entry (DE)
  serial: string; // e.g. '019', '101'
  entryModeLabel: string; // 'UTME' | 'Direct Entry' | 'Standard'
  raw: string;
}

/**
 * Parses academic matriculation numbers following the dynamic taxonomy:
 * [Programme: 1 char][Year of Entry: 2 digits][Dept Abbr: 2-5 letters][Entry Mode: 1=UTME, 2=DE][Serial: 3+ digits]
 * Example: U24MTH1019 -> U (Undergraduate), 24 (Year 2024), MTH (Maths), 1 (UTME), 019 (Serial #19)
 * Example: U23CSC2005 -> U (Undergraduate), 23 (Year 2023), CSC (Comp Sci), 2 (Direct Entry), 005 (Serial #5)
 */
export function parseMatricNumber(matric: string): MatricBreakdown | null {
  if (!matric) return null;
  const clean = matric.trim().toUpperCase().replace(/[\/\-_]/g, '');

  const match = clean.match(/^([A-Z])(\d{2})([A-Z]{2,5})([12])(\d{3,})$/);
  if (match) {
    const [, programme, year, deptCode, entryMode, serial] = match;
    return {
      programme,
      year,
      deptCode,
      entryMode,
      serial,
      entryModeLabel: entryMode === '1' ? 'UTME' : entryMode === '2' ? 'Direct Entry (DE)' : 'Standard',
      raw: matric.trim().toUpperCase()
    };
  }
  return null;
}

/**
 * Helper to construct a standard dynamic matriculation number.
 */
export function buildMatricNumber(
  programme: string = 'U',
  yearOfEntry: string | number = '24',
  deptCode: string = 'MTH',
  entryMode: '1' | '2' = '1',
  serial: string | number = '001'
): string {
  const p = (programme || 'U').trim().toUpperCase().charAt(0);
  const yr = String(yearOfEntry).trim().slice(-2);
  const dept = (deptCode || 'GEN').trim().toUpperCase().replace(/[^A-Z]/g, '');
  const mode = entryMode === '2' ? '2' : '1';
  const sStr = String(serial).trim().padStart(3, '0');
  return `${p}${yr}${dept}${mode}${sStr}`;
}

/**
 * Resolves a student from a user input query without hardcoding any specific department or year.
 * Supports:
 * 1. Full matriculation number (e.g. "U24MTH1019", "U23CSC2005")
 * 2. 4-Digit shorthand: [Entry Mode: 1/2] + [3-digit Serial] (e.g. "1019", "2005")
 * 3. Dept code + 4-digit shorthand (e.g. "MTH1019", "CSC2005")
 * 4. 3-Digit serial alone (e.g. "019")
 *
 * If multiple students match across departments, the active course enrollment takes precedence.
 */
export function matchStudentByMatricOrShorthand(
  query: string,
  students: Student[],
  activeCourseId?: string,
  enrollments?: Enrollment[]
): Student | null {
  if (!query || !students || students.length === 0) return null;
  const clean = query.trim().toUpperCase();

  // 1. Direct exact match by physical card QR token, qr_code_id, or matriculation number (case-insensitive)
  const rawQuery = query.trim();
  const exact = students.find(
    (s) =>
      s.qr_code_id === rawQuery ||
      (s.qr_code_id && s.qr_code_id.toUpperCase() === clean) ||
      s.matric_number.toUpperCase() === clean ||
      s.id === rawQuery
  );
  if (exact) return exact;

  let candidates: Student[] = [];

  // 2. Dept + 4 digits (e.g. "MTH1019", "CSC2005")
  if (/^[A-Z]{2,5}\d{4}$/.test(clean)) {
    candidates = students.filter((s) => s.matric_number.toUpperCase().endsWith(clean));
  }
  // 3. 4-digit serial entry: 1/2 for entry mode + 3 digits (e.g. "1019", "2005")
  else if (/^[12]\d{3}$/.test(clean)) {
    candidates = students.filter((s) => s.matric_number.toUpperCase().endsWith(clean));
  }
  // 4. Any 4 digits
  else if (/^\d{4}$/.test(clean)) {
    candidates = students.filter((s) => s.matric_number.toUpperCase().endsWith(clean));
  }
  // 5. 3-digit serial alone (e.g. "019")
  else if (/^\d{3}$/.test(clean)) {
    candidates = students.filter((s) => s.matric_number.toUpperCase().endsWith(clean));
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Disambiguate if multiple candidates match: prioritize student enrolled in activeCourseId
  if (activeCourseId && enrollments) {
    const enrolledIds = new Set(
      enrollments.filter((e) => e.course_id === activeCourseId).map((e) => e.student_id)
    );
    const courseMatch = candidates.find((c) => enrolledIds.has(c.id));
    if (courseMatch) return courseMatch;
  }

  return candidates[0];
}
