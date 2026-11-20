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
 * Parses the raw text decoded by the camera scanner into a normalized student identifier.
 */
export function parseScannedStudentQr(rawText: string): {
  qrId: string;
  matricNumber?: string;
  name?: string;
} {
  const trimmed = rawText.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'AEGISROLL_STUDENT_PASS' || parsed.qr_id) {
        return {
          qrId: parsed.qr_id || trimmed,
          matricNumber: parsed.matric,
          name: parsed.name
        };
      }
    }
  } catch {
    // Plain text QR code (e.g. "AR-QR-MTH1019" or "U24MTH1019")
  }

  return {
    qrId: trimmed,
    matricNumber: trimmed
  };
}

/**
 * Builds a structured JSON payload for a live session backup QR code.
 */
export function buildSessionBackupQrPayload(session: ClassSession): string {
  const payload: SessionQrPayload = {
    type: 'AEGISROLL_SESSION_BACKUP',
    session_id: session.id,
    session_pin: session.session_pin,
    venue: session.venue,
    created_at: session.start_time
  };
  return JSON.stringify(payload);
}

/**
 * Parses a session backup QR code scanned by a student.
 */
export function parseScannedSessionQr(rawText: string): {
  sessionId: string;
  sessionPin: string;
} | null {
  const trimmed = rawText.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.session_id && parsed.session_pin) {
      return {
        sessionId: parsed.session_id,
        sessionPin: parsed.session_pin
      };
    }
  } catch {
    // If format is "sessionId:sessionPin"
    if (trimmed.includes(':')) {
      const [sessionId, sessionPin] = trimmed.split(':');
      if (sessionId && sessionPin) {
        return { sessionId: sessionId.trim(), sessionPin: sessionPin.trim() };
      }
    }
  }
  return null;
}

/**
 * Synthesizes a clean success confirmation chime using browser Web Audio API.
 */
export function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext might be blocked before user interaction; ignore silently
  }
}
