import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, Sparkles, UserCheck, Keyboard, SwitchCamera, Upload } from 'lucide-react';
import { parseScannedStudentQr, parseScannedSessionQr, playSuccessChime } from '../lib/qrHelper';
import { aegisStore } from '../lib/supabase';
import { AttendanceSubmissionResult } from '../types';

interface ScannedRecord {
  timestamp: string;
  studentName: string;
  matricNumber: string;
  status: string;
  message: string;
}

interface QrCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  sessionTitle?: string;
  onScanCompleted?: () => void;
  onSessionScanned?: (result: { sessionId: string; sessionPin: string }) => void;
  mode?: 'scan_student' | 'scan_session';
}

export const QrCameraScannerModal: React.FC<QrCameraScannerModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionTitle = 'Active Class Session',
  onScanCompleted,
  onSessionScanned,
  mode = 'scan_student'
}) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<AttendanceSubmissionResult | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedRecord[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const containerId = 'aegis-qr-reader-container';

  // Process a decoded QR text string (from camera, file, or manual input)
  const handleProcessCode = async (rawCode: string) => {
    const rawTrimmed = rawCode.trim();
    if (!rawTrimmed) return;

    // Debounce duplicate scans within 1.5 seconds
    const now = Date.now();
    if (rawTrimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1500) {
      return;
    }

    lastScannedCodeRef.current = rawTrimmed;
    lastScannedTimeRef.current = now;

    // Trigger visual green flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 600);

    // MODE 1: Student scanning projected auditorium screen QR code
    if (mode === 'scan_session' && onSessionScanned) {
      const parsedSession = parseScannedSessionQr(rawTrimmed);
      if (parsedSession) {
        playSuccessChime();
        stopCamera();
        onSessionScanned(parsedSession);
        return;
      }
    }

    // MODE 2: Lecturer / Rep scanning student digital pass or ID card
    setIsProcessing(true);
    const parsed = parseScannedStudentQr(rawTrimmed);
    const identifier = parsed.matricNumber || parsed.qrId || rawTrimmed;

    const targetSessionId = sessionId || aegisStore.sessions.find((s) => s.is_active)?.id;
    if (!targetSessionId) {
      setLastScannedResult({
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'No active session found to register this student. Please start a session first.'
      });
      setIsProcessing(false);
      return;
    }

    try {
      const result = await aegisStore.submitAttendanceByQr(
        targetSessionId,
        identifier,
        'CR QR Camera Scanner'
      );

      setLastScannedResult(result);
      playSuccessChime();

      const record: ScannedRecord = {
        timestamp: new Date().toLocaleTimeString(),
        studentName: result.student_name || parsed.name || identifier,
        matricNumber: result.matric_number || parsed.matricNumber || identifier,
        status: result.status,
        message: result.message
      };

      setScannedHistory((prev) => [record, ...prev]);
      if (onScanCompleted) onScanCompleted();
    } catch (err: any) {
      setLastScannedResult({
        success: false,
        status: 'Error',
        distance_meters: null,
        message: err.message || 'Failed to submit QR attendance.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    setLastScannedResult(null);

    const timer = setTimeout(() => {
      startCamera();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, sessionId, selectedCameraId]);

  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current && isScanningRef.current) {
        return;
      }

      // Query available devices to facilitate switching
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
        }
      } catch (e) {
        console.warn('Could not enumerate cameras:', e);
      }

      const qrCodeScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
      html5QrCodeRef.current = qrCodeScanner;

      // Responsive scanning area - no hardcoded 1.0 aspect ratio distortion!
      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(Math.floor(edge * 0.85), 200);
          return { width: size, height: size };
        }
      };

      if (selectedCameraId) {
        await qrCodeScanner.start(
          selectedCameraId,
          scanConfig,
          (decodedText) => handleProcessCode(decodedText),
          () => {}
        );
      } else {
        try {
          // Rear environment camera (ideal for scanning student passes or screens)
          await qrCodeScanner.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => handleProcessCode(decodedText),
            () => {}
          );
        } catch (backCamErr) {
          console.warn('Environment facingMode failed, falling back:', backCamErr);
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              const rearCam = cameras.find((c) =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('rear') ||
                c.label.toLowerCase().includes('environment')
              ) || cameras[0];
              await qrCodeScanner.start(
                rearCam.id,
                scanConfig,
                (decodedText) => handleProcessCode(decodedText),
                () => {}
              );
            } else {
              await qrCodeScanner.start(
                { facingMode: 'user' },
                scanConfig,
                (decodedText) => handleProcessCode(decodedText),
                () => {}
              );
            }
          } catch (fallbackErr: any) {
            throw fallbackErr;
          }
        }
      }

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setCameraError(
        err.message ||
          'Camera access was denied or not supported on this browser. You can still enter or paste the code manually below.'
      );
      setScannerActive(false);
      setShowManualInput(true);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      } finally {
        isScanningRef.current = false;
        setScannerActive(false);
        html5QrCodeRef.current = null;
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCodeInput.trim()) {
      handleProcessCode(manualCodeInput.trim());
      setManualCodeInput('');
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !html5QrCodeRef.current) return;
    try {
      setIsProcessing(true);
      const decoded = await html5QrCodeRef.current.scanFile(file, true);
      handleProcessCode(decoded);
    } catch (err: any) {
      setLastScannedResult({
        success: false,
        status: 'Error',
        distance_meters: null,
        message: 'Could not detect a valid QR code in the uploaded image.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card w-full max-w-lg rounded-2xl shadow-academic border border-surface-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-oxford-800 text-white px-6 py-4 flex items-center justify-between border-b border-oxford-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                {mode === 'scan_session' ? 'Scan Classroom Screen QR' : 'Student QR Code Scanner'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'scan_session'
                  ? 'Point camera at the projector screen to check in'
                  : 'Continuous Rapid Attendance Check-In'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Active Banner */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <span className="font-medium text-oxford-800 truncate">{sessionTitle}</span>
            {mode === 'scan_student' && (
              <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
                {scannedHistory.length} Scanned
              </span>
            )}
          </div>

          {/* Camera Viewport Container */}
          <div className={`relative rounded-2xl overflow-hidden bg-black aspect-video sm:aspect-square max-h-72 mx-auto flex items-center justify-center border-2 shadow-inner transition-colors ${
            isFlashing ? 'border-emerald-400 ring-4 ring-emerald-400/30' : 'border-teal-brand/40'
          }`}>
            <div id={containerId} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Initializing camera scanner...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs text-amber-200">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-2 text-xs bg-teal-brand text-oxford-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-teal-400 transition"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Camera Controls & Switcher */}
          {availableCameras.length > 1 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 flex items-center gap-1">
                <SwitchCamera className="w-3.5 h-3.5" /> Camera:
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  stopCamera();
                  setSelectedCameraId(e.target.value);
                }}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white font-medium text-slate-700 max-w-[200px] truncate"
              >
                {availableCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Instant Scan Feedback Toast */}
          {lastScannedResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs transition animate-fade-in ${
                lastScannedResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : lastScannedResult.already_marked
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {lastScannedResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  {lastScannedResult.student_name ? `${lastScannedResult.student_name} (${lastScannedResult.matric_number})` : 'Scan Result'}
                </p>
                <p>{lastScannedResult.message}</p>
              </div>
            </div>
          )}

          {/* Manual Input Toggle / Form */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs text-slate-600 hover:text-oxford-800 font-medium flex items-center gap-1.5"
              >
                <Keyboard className="w-4 h-4 text-teal-brand" />
                {showManualInput ? 'Hide manual entry' : mode === 'scan_session' ? 'Enter 4-Digit PIN manually' : 'Type Student QR ID / Matric manually'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-teal-brand hover:underline font-medium flex items-center gap-1"
                title="Scan QR code from an image or screenshot"
              >
                <Upload className="w-3.5 h-3.5" /> Scan Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileScan}
                className="hidden"
              />
            </div>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder={mode === 'scan_session' ? 'e.g. 1234' : 'e.g. U24MTH1019, U23CSC2005'}
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-teal-brand outline-none uppercase font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim() || isProcessing}
                  className="bg-oxford-800 text-white text-xs px-3.5 py-2 rounded-lg font-medium hover:bg-oxford-700 transition disabled:opacity-50"
                >
                  Verify
                </button>
              </form>
            )}
          </div>

          {/* Live Batch Scan History */}
          {mode === 'scan_student' && scannedHistory.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-oxford-800">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-brand" />
                  Students Scanned This Session ({scannedHistory.length})
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {scannedHistory.map((rec, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-oxford-800">{rec.studentName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{rec.matricNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {rec.status}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{rec.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
