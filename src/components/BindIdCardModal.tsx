import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  CreditCard,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  ShieldCheck,
  Check,
  Zap,
  ZapOff,
  ZoomIn
} from 'lucide-react';
import { Student, UserProfile, Department } from '../types';
import { aegisStore } from '../lib/supabase';
import { playSuccessChime } from '../lib/qrHelper';
import { decodeVideoFrame, decodeImageFile } from '../lib/fastScanner';

interface BindIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  user?: UserProfile;
  department?: Department;
  onBoundSuccessfully?: (newQrId: string) => void;
}

export const BindIdCardModal: React.FC<BindIdCardModalProps> = ({
  isOpen,
  onClose,
  student,
  user,
  department,
  onBoundSuccessfully
}) => {
  const [scannedToken, setScannedToken] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isBinding, setIsBinding] = useState(false);
  const [bindResult, setBindResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('Hold card steady in box');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const isFrameBusyRef = useRef(false);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setScannedToken('');
    setManualInput('');
    setBindResult(null);
    setCameraError(null);
    setScanStatus('Initializing camera...');

    const timer = setTimeout(() => {
      startCamera();
    }, 120);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, student?.id]);

  const onScanSuccess = (decodedText: string) => {
    const trimmed = decodedText.trim();
    if (!trimmed) return;
    setScannedToken(trimmed);
    setManualInput(trimmed);
    playSuccessChime();
  };

  const startCamera = async () => {
    try {
      stopCamera();
      setScannerActive(false);
      setCameraError(null);

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          setHasTorch(Boolean(caps.torch));
          setHasZoom(Boolean(caps.zoom));

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
      setScanStatus('Scanning live video...');
      runScanLoop();
    } catch (err: any) {
      console.warn('Card scanner camera initiation failed:', err);
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
          await videoRef.current.play();
        }
        isScanningRef.current = true;
        setScannerActive(true);
        setScanStatus('Scanning live video (standard)...');
        runScanLoop();
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr.message ||
            'Camera access was denied or not supported. You can snap a photo or enter the token manually below.'
        );
        setScannerActive(false);
      }
    }
  };

  const runScanLoop = () => {
    if (!isScanningRef.current) return;

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      if (!isFrameBusyRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        isFrameBusyRef.current = true;
        try {
          const result = await decodeVideoFrame(videoRef.current);
          if (result && result.text) {
            onScanSuccess(result.text);
            return;
          }
        } catch {
          // Continue loop
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
    isFrameBusyRef.current = false;
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
    setCurrentZoom(1);
  };

  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.torch) {
        try {
          const next = !isTorchOn;
          await track.applyConstraints({ advanced: [{ torch: next }] as any });
          setIsTorchOn(next);
        } catch (e) {
          console.warn('Torch toggle failed:', e);
        }
      }
    }
  };

  const toggleZoom = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.zoom) {
        const nextZoom = currentZoom === 1 ? Math.min(2, caps.zoom.max || 2) : 1;
        try {
          await track.applyConstraints({ advanced: [{ zoom: nextZoom }] as any });
          setCurrentZoom(nextZoom);
        } catch (e) {
          console.warn('Zoom failed:', e);
        }
      }
    }
  };

  // Direct phone photo capture fallback
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanStatus('Decoding photo...');

    try {
      const decodedText = await decodeImageFile(file);
      if (decodedText) {
        onScanSuccess(decodedText);
      } else {
        alert(
          'Could not read a QR code or barcode from this photo. Please hold the card flat in good lighting and try again.'
        );
        setScanStatus('Scanning live video...');
      }
    } catch (err: any) {
      alert(`Photo decode error: ${err.message || 'Failed to process image'}`);
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmBind = async (tokenToBind: string) => {
    if (!tokenToBind.trim()) return;

    setIsBinding(true);
    setBindResult(null);

    try {
      const result = await aegisStore.bindStudentPhysicalQrCard(student.id, tokenToBind.trim());
      setBindResult(result);

      if (result.success) {
        playSuccessChime();
        if (onBoundSuccessfully && result.qr_code_id) {
          onBoundSuccessfully(result.qr_code_id);
        }
      }
    } catch (e: any) {
      setBindResult({
        success: false,
        message: e.message || 'Failed to bind physical ID card.'
      });
    } finally {
      setIsBinding(false);
    }
  };

  if (!isOpen) return null;

  const currentQr = student.qr_code_id || '';
  const isCurrently32Chars = currentQr.length === 32;
  const activeInput = manualInput || scannedToken;
  const isInputValid = activeInput.trim().length >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card w-full max-w-lg rounded-2xl shadow-academic border border-surface-border overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-oxford-800 text-white px-6 py-4 flex items-center justify-between border-b border-oxford-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Bind Physical Student ID Card
              </h2>
              <p className="text-xs text-slate-300">
                Link Any Physical Card QR / Barcode to Student Account
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Student Target Summary */}
          <div className="bg-oxford-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Target Student
              </span>
              <h3 className="font-serif font-bold text-base text-oxford-800 mt-1">
                {user?.full_name || 'Enrolled Student'}
              </h3>
              <p className="text-xs font-mono font-semibold text-oxford-700">
                {student.matric_number} • {department?.code || 'CSE'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">Current Bound ID:</span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border inline-block mt-0.5 ${
                  currentQr
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {currentQr ? `${currentQr.substring(0, 10)}... (${currentQr.length} chars)` : 'None'}
              </span>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-brand" />
                Point Camera at Plastic Student ID Card
              </span>
              {scannedToken && (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                  Scanned!
                </span>
              )}
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-56 mx-auto flex items-center justify-center border-2 border-teal-brand/40 shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Torch & Zoom Controls */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                {hasZoom && scannerActive && (
                  <button
                    type="button"
                    onClick={toggleZoom}
                    className={`p-2 rounded-xl backdrop-blur-md transition text-xs font-bold ${
                      currentZoom > 1
                        ? 'bg-teal-brand text-oxford-950 shadow-md ring-2 ring-teal-300'
                        : 'bg-black/60 text-white/90 hover:text-white'
                    }`}
                    title="Toggle 2x Macro Zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                )}

                {hasTorch && scannerActive && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md transition ${
                      isTorchOn
                        ? 'bg-amber-400 text-oxford-950 shadow-md ring-2 ring-amber-300'
                        : 'bg-black/60 text-white/90 hover:text-white'
                    }`}
                    title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On (Anti-Glare)'}
                  >
                    {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Targeting Reticle & Scan Laser */}
              {scannerActive && !scannedToken && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-44 h-44 rounded-xl border-2 border-dashed border-teal-brand/80 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-teal-brand" />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-teal-brand" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-teal-brand" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-teal-brand" />

                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_8px_#14b8a6] animate-pulse top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {/* Status pulse */}
              {scannerActive && !scannedToken && (
                <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                  <span className="bg-black/70 backdrop-blur-sm text-teal-300 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border border-teal-brand/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                    {scanStatus}
                  </span>
                </div>
              )}

              {!scannerActive && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                  <RefreshCw className="w-6 h-6 text-teal-brand animate-spin" />
                  <p className="text-xs text-slate-300">Activating camera scanner...</p>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-1.5 p-4 text-center">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                  <p className="text-xs text-amber-200">{cameraError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Snap Photo Fallback */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
            <button
              type="button"
              disabled={isProcessingFile}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-teal-brand/10 hover:bg-teal-brand/20 text-teal-dark text-xs font-bold border border-teal-brand/30 transition shadow-2xs disabled:opacity-50"
            >
              {isProcessingFile ? (
                <RefreshCw className="w-4 h-4 animate-spin text-teal-brand" />
              ) : (
                <Camera className="w-4 h-4 text-teal-brand" />
              )}
              <span>
                {isProcessingFile
                  ? 'Processing Card Photo...'
                  : 'Snap with Phone Camera / Upload Photo'}
              </span>
            </button>
          </div>

          {/* Manual Input or Scanned Result Display */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-4 h-4 text-teal-brand" />
                Scanned Card Token (or enter/paste manually):
              </span>
              {activeInput && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                  {activeInput.trim().length} Characters
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. paste or type exact card characters..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 text-xs font-mono font-bold px-3 py-2.5 border border-slate-300 rounded-xl focus:border-teal-brand focus:ring-1 focus:ring-teal-brand outline-none bg-white"
              />
              <button
                type="button"
                onClick={() => handleConfirmBind(manualInput)}
                disabled={!manualInput.trim() || isBinding}
                className="bg-oxford-800 hover:bg-oxford-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {isBinding ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-brand" />
                ) : (
                  <Check className="w-4 h-4 text-teal-brand" />
                )}
                <span>Bind Card</span>
              </button>
            </div>
          </div>

          {/* Result Banner */}
          {bindResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs transition animate-fade-in ${
                bindResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {bindResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  {bindResult.success ? 'Binding Successful' : 'Binding Error'}
                </p>
                <p>{bindResult.message}</p>
              </div>
            </div>
          )}

          {/* Explanation Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-brand mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-oxford-800">Card Verification Security:</p>
              <p className="text-slate-500 leading-relaxed">
                Once bound, the student presents their physical card in class. The Course Representative's scanner instantly recognises their exact embedded code and records attendance!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {currentQr ? 'Card linked' : 'No card linked yet'}
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-xs bg-oxford-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-oxford-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
