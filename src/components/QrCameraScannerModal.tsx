import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserCheck,
  Keyboard,
  SwitchCamera,
  Upload,
  Zap,
  ZapOff
} from 'lucide-react';
import { parseScannedStudentQr, parseScannedSessionQr, playSuccessChime } from '../lib/qrHelper';
import { decodeVideoFrame, decodeImageFile } from '../lib/fastScanner';
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
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Process a decoded QR text string (from camera, file, or manual input)
  const handleProcessCode = async (rawCode: string) => {
    const rawTrimmed = rawCode.trim();
    if (!rawTrimmed) return;

    // Debounce duplicate scans within 1.2 seconds
    const now = Date.now();
    if (rawTrimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1200) {
      return;
    }

    lastScannedCodeRef.current = rawTrimmed;
    lastScannedTimeRef.current = now;

    // Trigger visual green flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 500);

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
    if (!isOpen) {
      stopCamera();
      return;
    }

    setCameraError(null);
    setLastScannedResult(null);

    const timer = setTimeout(() => {
      startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, selectedCameraId]);

  const startCamera = async () => {
    try {
      stopCamera();
      setScannerActive(false);
      setCameraError(null);

      // 1. Enumerate available video inputs
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, idx) => ({
            id: d.deviceId,
            label: d.label || `Camera ${idx + 1}`
          }));
        setAvailableCameras(videoDevices);
      } catch (e) {
        console.warn('Could not enumerate video devices:', e);
      }

      // 2. Camera constraints with high resolution & continuous focus
      const videoConstraints: MediaTrackConstraints = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints
      });

      mediaStreamRef.current = stream;

      // Check capabilities & apply continuous autofocus
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          setHasTorch(Boolean(caps.torch));

          const adv: any = {};
          if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            adv.focusMode = 'continuous';
          }
          if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
            adv.whiteBalanceMode = 'continuous';
          }
          if (Object.keys(adv).length > 0 && track.applyConstraints) {
            await track.applyConstraints({ advanced: [adv] as any });
          }
        } catch (e) {
          console.warn('Track constraint error:', e);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('video.play() error:', playErr);
        }
      }

      isScanningRef.current = true;
      setScannerActive(true);

      // Start high-speed scan loop
      runScanLoop();
    } catch (err: any) {
      console.warn('Fast camera scanner failed to start:', err);
      // Fallback: try basic environment video constraints without strict resolution
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'environment' }
        });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          await videoRef.current.play();
        }
        isScanningRef.current = true;
        setScannerActive(true);
        runScanLoop();
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr.message ||
            'Camera access was denied or is not supported. Please allow camera permissions or enter matric number manually.'
        );
        setScannerActive(false);
        setShowManualInput(true);
      }
    }
  };

  const isFrameBusyRef = useRef(false);

  const runScanLoop = () => {
    if (!isScanningRef.current) return;

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      if (!isFrameBusyRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        isFrameBusyRef.current = true;
        try {
          const result = await decodeVideoFrame(videoRef.current);
          if (result && result.text) {
            handleProcessCode(result.text);
          }
        } catch {
          // Frame decode exception; continue
        } finally {
          isFrameBusyRef.current = false;
        }
      }

      if (isScanningRef.current) {
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.torch) {
        try {
          const nextState = !isTorchOn;
          await track.applyConstraints({
            advanced: [{ torch: nextState }] as any
          });
          setIsTorchOn(nextState);
        } catch (e) {
          console.warn('Torch toggle failed:', e);
        }
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
    if (!file) return;
    try {
      setIsProcessing(true);
      const decoded = await decodeImageFile(file);
      if (decoded) {
        handleProcessCode(decoded);
      } else {
        setLastScannedResult({
          success: false,
          status: 'Error',
          distance_meters: null,
          message: 'No clear QR code or barcode found in this image.'
        });
      }
    } catch (err: any) {
      setLastScannedResult({
        success: false,
        status: 'Error',
        distance_meters: null,
        message: err.message || 'Failed to process image file.'
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
                {mode === 'scan_session' ? 'Scan Classroom Screen QR' : 'Rapid ID Card & QR Scanner'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'scan_session'
                  ? 'Point camera at projector screen to check in'
                  : 'Fast hardware-accelerated ID card roll call'}
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

          {/* High-Definition Camera Viewport Container */}
          <div
            className={`relative rounded-2xl overflow-hidden bg-black aspect-video sm:aspect-square max-h-72 mx-auto flex items-center justify-center border-2 shadow-inner transition-all ${
              isFlashing ? 'border-emerald-400 ring-4 ring-emerald-400/40' : 'border-teal-brand/40'
            }`}
          >
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Hidden canvas for image extraction */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning Viewfinder Overlay & Target Frame */}
            {scannerActive && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Viewfinder Target Box */}
                <div className="w-56 h-56 border-2 border-teal-brand/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Glowing Corner Accents */}
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-teal-brand rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-teal-brand rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-teal-brand rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-teal-brand rounded-br-lg" />

                  {/* Animated Laser Scan Bar */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-brand to-transparent shadow-[0_0_8px_#26B9A8] animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Loading Spinner */}
            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Activating camera scanner...</p>
              </div>
            )}

            {/* Camera Error Message */}
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

          {/* Camera Auxiliary Controls (Torch & Camera Switcher) */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            {hasTorch ? (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                  isTorchOn
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {isTorchOn ? <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" /> : <ZapOff className="w-3.5 h-3.5" />}
                <span>{isTorchOn ? 'Torch On' : 'Torch Off'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Position card inside frame</span>
            )}

            {availableCameras.length > 1 && (
              <div className="flex items-center gap-1.5">
                <SwitchCamera className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white font-medium text-slate-700 max-w-[180px] truncate"
                >
                  {availableCameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

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

          {/* Manual Input Toggle & File Upload */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs text-slate-600 hover:text-oxford-800 font-medium flex items-center gap-1.5"
              >
                <Keyboard className="w-4 h-4 text-teal-brand" />
                {showManualInput ? 'Hide manual entry' : mode === 'scan_session' ? 'Enter 4-Digit PIN manually' : 'Type Student ID / Matric manually'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-teal-brand hover:underline font-medium flex items-center gap-1"
                title="Scan QR code from an image or screenshot"
              >
                <Upload className="w-3.5 h-3.5" /> Scan Photo
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
