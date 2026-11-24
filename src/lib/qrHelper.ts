import QRCode from 'qrcode';
import { Student, UserProfile, ClassSession } from '../types';

export interface StudentQrPayload {
  type: 'AEGISROLL_STUDENT_PASS';
  qr_id: string;
  matric: string;
  name?: string;
  issued_at: string;
}

export interface SessionQrPayload {
  type: 'AEGISROLL_SESSION_BACKUP';
  session_id: string;
  session_pin: string;
  course_code?: string;
  venue?: string;
  created_at: string;
}

/**
 * Generates a high-quality data URL for a QR code with prestige academic teal/navy accents.
 */
export async function generateQrDataUrl(
  text: string,
  options?: {
    width?: number;
    darkColor?: string;
    lightColor?: string;
  }
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 320,
      margin: 2,
      color: {
        dark: options?.darkColor || '#0F2137', // Oxford Navy
        light: options?.lightColor || '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw err;
  }
}

/**
 * Creates a structured JSON payload for a student's personal digital QR pass.
 */
export function buildStudentQrPayload(student: Student, user?: UserProfile): string {
  const payload: StudentQrPayload = {
    type: 'AEGISROLL_STUDENT_PASS',
    qr_id: student.qr_code_id || `AR-QR-${student.matric_number.replace(/[^A-Za-z0-9]/g, '')}`,
    matric: student.matric_number,
    name: user?.full_name,
    issued_at: new Date().toISOString()
  };
  return JSON.stringify(payload);
}

/**
 * Builds a universal mobile check-in URL for a live class session.
 * Native smartphone cameras scan this QR code and immediately open AegisRoll with the session pre-filled!
 */
export function buildSessionBackupQrPayload(session: ClassSession): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const pathname = window.location.pathname || '/';
    return `${origin}${pathname}?session_id=${encodeURIComponent(session.id)}&pin=${encodeURIComponent(session.session_pin)}#checkin`;
  }
  return `AEGISROLL_CHECKIN:${session.id}:${session.session_pin}`;
}

/**
 * Tests whether a string resembles an academic matriculation number
 * rather than a random card token, chip UID, or hash.
 */
export function isLikelyMatricNumber(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toUpperCase();
  // Standard format: U24MTH1019, U23CSC2005, etc.
  if (/^[A-Z]\d{2}[A-Z]{2,5}[12]\d{3,}$/.test(clean)) return true;
  // University slash/hyphen formats: e.g. "20/55EC012", "CSC/2021/045", "ENG-20-104"
  if (/^[A-Z0-9]{2,6}[\/\-][A-Z0-9]{2,6}[\/\-][A-Z0-9]{2,6}$/.test(clean)) return true;
  // Dept + 4 digits: "MTH1019", "CSC2005"
  if (/^[A-Z]{2,5}\d{4}$/.test(clean)) return true;
  return false;
}

/**
 * Parses the raw text decoded by the camera scanner into a normalized student identifier.
 * Supports AegisRoll JSON passes, direct URLs, barcodes, and raw physical ID card tokens.
 */
export function parseScannedStudentQr(rawText: string): {
  qrId: string;
  matricNumber?: string;
  name?: string;
} {
  const trimmed = rawText.trim();

  // 1. Check if raw text is a URL with student matric params
  if (trimmed.includes('matric=') || trimmed.includes('student=')) {
    try {
      const urlStr = trimmed.startsWith('http') ? trimmed : `https://aegis.edu/${trimmed}`;
      const url = new URL(urlStr);
      const matric = url.searchParams.get('matric') || url.searchParams.get('student');
      const name = url.searchParams.get('name') || undefined;
      const qrId = url.searchParams.get('qr_id') || matric || trimmed;
      if (matric) {
        return { qrId, matricNumber: matric.toUpperCase(), name };
      }
    } catch {
      // Continue
    }
  }

  // 2. Check structured JSON pass
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'AEGISROLL_STUDENT_PASS' || parsed.qr_id || parsed.matric) {
        const potentialMatric = parsed.matric || parsed.matricNumber;
        return {
          qrId: parsed.qr_id || parsed.matric || trimmed,
          matricNumber: potentialMatric ? potentialMatric.toUpperCase() : undefined,
          name: parsed.name || parsed.studentName
        };
      }
    }
  } catch {
    // Plain text QR code (e.g. physical plastic card token or "AR-QR-MTH1019" or "U24MTH1019")
  }

  return {
    qrId: trimmed,
    matricNumber: isLikelyMatricNumber(trimmed) ? trimmed.toUpperCase() : undefined
  };
}

/**
 * Parses a session QR code scanned either by a phone's normal camera app or the in-app scanner.
 * Extracts the session_id and 4-digit PIN accurately across all formats.
 */
export function parseScannedSessionQr(rawText: string): {
  sessionId: string;
  sessionPin: string;
} | null {
  const trimmed = rawText.trim();

  // 1. URL format (e.g. https://.../?session_id=ses-xyz&pin=1234#checkin)
  if (trimmed.includes('session_id=') || trimmed.includes('session=') || trimmed.includes('pin=')) {
    try {
      const urlStr = trimmed.startsWith('http') ? trimmed : `https://aegis.edu/${trimmed}`;
      const url = new URL(urlStr);
      let sessionId = url.searchParams.get('session_id') || url.searchParams.get('session');
      let sessionPin = url.searchParams.get('pin');

      if (!sessionId || !sessionPin) {
        const hash = url.hash;
        if (hash.includes('?')) {
          const hashParams = new URLSearchParams(hash.split('?')[1]);
          sessionId = sessionId || hashParams.get('session_id') || hashParams.get('session');
          sessionPin = sessionPin || hashParams.get('pin');
        }
      }

      if (sessionId && sessionPin) {
        return { sessionId: sessionId.trim(), sessionPin: sessionPin.trim() };
      }
    } catch {
      const matchSes = trimmed.match(/session(?:_id)?=([^&?#]+)/);
      const matchPin = trimmed.match(/pin=([^&?#]+)/);
      if (matchSes && matchPin) {
        return { sessionId: matchSes[1].trim(), sessionPin: matchPin[1].trim() };
      }
    }
  }

  // 2. JSON format
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const sId = parsed.session_id || parsed.sessionId;
      const pin = parsed.session_pin || parsed.sessionPin || parsed.pin;
      if (sId && pin) {
        return { sessionId: String(sId).trim(), sessionPin: String(pin).trim() };
      }
    }
  } catch {
    // Continue
  }

  // 3. String Delimiter format: "AEGISROLL_CHECKIN:sessionId:pin" or "sessionId:pin"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((s) => s.trim());
    if (parts.length === 3 && parts[0] === 'AEGISROLL_CHECKIN') {
      return { sessionId: parts[1], sessionPin: parts[2] };
    }
    if (parts.length === 2 && parts[0].length >= 3 && parts[1].length === 4) {
      return { sessionId: parts[0], sessionPin: parts[1] };
    }
  }

  return null;
}

/**
 * Synthesizes a clean success confirmation chime and haptic feedback.
 */
export function playSuccessChime() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([80, 40, 80]);
    } catch {}
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Silently continue if audio context is gated
  }
}
