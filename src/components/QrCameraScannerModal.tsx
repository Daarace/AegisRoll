import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, Sparkles, UserCheck, Keyboard } from 'lucide-react';
import { parseScannedStudentQr, playSuccessChime } from '../lib/qrHelper';
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
  sessionId: string;
  sessionTitle?: string;
  onScanCompleted?: () => void;
}

export const QrCameraScannerModal: React.FC<QrCameraScannerModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionTitle = 'Active Class Session',
  onScanCompleted
}) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<AttendanceSubmissionResult | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedRecord[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const containerId = 'aegis-qr-reader-container';

  // Process a decoded QR text string (from camera or manual input)
  const handleProcessCode = async (rawCode: string) => {
    if (!rawCode.trim()) return;

    // Debounce duplicate scans within 2.5 seconds
    const now = Date.now();
    if (rawCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }

    lastScannedCodeRef.current = rawCode;
    lastScannedTimeRef.current = now;

    setIsProcessing(true);
    const parsed = parseScannedStudentQr(rawCode);
    const identifier = parsed.qrId || parsed.matricNumber || rawCode;

    try {
      const result = await aegisStore.submitAttendanceByQr(
        sessionId,
        identifier,
        'CR QR Camera Scanner'
      );

      setLastScannedResult(result);

      if (result.success || result.already_marked) {
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
      }
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
    }, 200);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, sessionId]);

  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current && isScanningRef.current) {
        return;
      }

      const qrCodeScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrCodeRef.current = qrCodeScanner;

      await qrCodeScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleProcessCode(decodedText);
        },
        () => {
          // Frame decode error - normal polling noise, ignore
        }
      );

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setCameraError(
        err.message ||
          'Camera access was denied or not supported on this browser. You can still enter the student QR code ID manually below.'
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
              <h2 className="font-serif font-bold text-lg text-white">Student QR Code Scanner</h2>
              <p className="text-xs text-slate-300">Continuous Rapid Attendance Check-In</p>
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
            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
              {scannedHistory.length} Scanned
            </span>
          </div>

          {/* Camera Viewport Container */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-72 mx-auto flex items-center justify-center border-2 border-teal-brand/40 shadow-inner">
            <div id={containerId} className="w-full h-full" />

            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Initializing rear camera scanner...</p>
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
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-slate-600 hover:text-oxford-800 font-medium flex items-center gap-1.5"
            >
              <Keyboard className="w-4 h-4 text-teal-brand" />
              {showManualInput ? 'Hide manual entry' : 'Type Student QR ID / Matric Number manually'}
            </button>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. U24MTH1019, U23CSC2005 (or 4-digit serial 1019)"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-teal-brand outline-none"
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
          {scannedHistory.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-oxford-800">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-brand" />
                  Students Scanned This Session ({scannedHistory.length})
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {scannedHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-semibold text-oxford-800">{item.studentName}</span>{' '}
                      <span className="font-mono text-slate-500">({item.matricNumber})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{item.timestamp}</span>
                      <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[10px]">
                        Present
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Continuous mode: keep scanning next student
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-xs bg-oxford-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-oxford-700 transition"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
