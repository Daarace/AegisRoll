import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  AlertCircle,
  Keyboard,
  ScanLine,
  Zap,
  ZapOff,
  ZoomIn,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { parseScannedStudentQr, playSuccessChime } from '../lib/qrHelper';
import { decodeVideoFrame, decodeImageFile } from '../lib/fastScanner';
import { parseMatricNumber } from '../lib/matricHelper';

export interface ScannedIdCardResult {
  rawCode: string;
  matricNumber?: string;
  studentName?: string;
  deptCode?: string;
}

interface DirectCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: ScannedIdCardResult) => void;
  title?: string;
  subtitle?: string;
}

export const DirectCardScannerModal: React.FC<DirectCardScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Student ID Card / Barcode',
  subtitle = 'Hold student plastic ID card barcode or digital pass in front of camera'
}) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('Align card inside box');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const isFrameBusyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setCameraError(null);
    setManualInput('');
    setShowManualInput(false);
    setScanStatus('Initializing camera...');

    const timer = setTimeout(() => {
      startCamera();
    }, 120);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen]);

  const processDecodedText = (decodedText: string) => {
    const raw = decodedText.trim();
    if (!raw) return;

    playSuccessChime();

    // 1. Try parsing structured AegisRoll QR pass JSON
    const parsedQr = parseScannedStudentQr(raw);

    // 2. Extract potential matriculation number
    const candidateMatric = parsedQr.matricNumber;
    const matricDetails = candidateMatric ? parseMatricNumber(candidateMatric) : null;

    const result: ScannedIdCardResult = {
      rawCode: raw,
      matricNumber: candidateMatric,
      studentName: parsedQr.name,
      deptCode: matricDetails?.deptCode
    };

    stopCamera();
    onScan(result);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      setScannerActive(false);
      setCameraError(null);

      // Safe constraints without strict minimums that break mobile portrait orientation
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

          // Apply hardware continuous autofocus and white balance for sharp plastic card detection
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
          console.warn('Could not apply advanced track constraints:', e);
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
          console.warn('video.play() failed:', playErr);
        }
      }

      isScanningRef.current = true;
      setScannerActive(true);
      setScanStatus('Scanning live video...');

      runScanLoop();
    } catch (err: any) {
      console.warn('Direct scanner camera initiation failed:', err);
      // Fallback: request basic environment camera
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
            'Camera access was denied or not supported. You can snap a photo or enter the code manually below.'
        );
        setScannerActive(false);
        setShowManualInput(true);
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
            processDecodedText(result.text);
            return;
          }
        } catch {
          // Continue scanning
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
          console.warn('Zoom toggle failed:', e);
        }
      }
    }
  };

  // Handle direct photo capture or image upload (100% fail-safe fallback)
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanStatus('Decoding photo...');

    try {
      const decodedText = await decodeImageFile(file);
      if (decodedText) {
        processDecodedText(decodedText);
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processDecodedText(manualInput);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-oxford-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface-card rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-academic-lg border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-oxford-800">{title}</h3>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="my-3.5">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-64 mx-auto flex items-center justify-center border-2 border-teal-brand/40 shadow-inner">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Quick Action Overlays (Torch & Zoom) */}
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
                  title={isTorchOn ? 'Flashlight On' : 'Flashlight Off (Anti-Glare)'}
                >
                  {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Reticle Target */}
            {scannerActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-48 h-48 rounded-xl border-2 border-dashed border-teal-brand/80 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-3 border-l-3 border-teal-brand" />
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-3 border-r-3 border-teal-brand" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-3 border-l-3 border-teal-brand" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-3 border-r-3 border-teal-brand" />

                  {/* Laser line pulse */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_10px_#14b8a6] animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Live scanning pulse badge */}
            {scannerActive && (
              <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                <span className="bg-black/70 backdrop-blur-sm text-teal-300 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border border-teal-brand/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                  {scanStatus}
                </span>
              </div>
            )}

            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Activating camera scanner...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs text-amber-200">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 text-xs bg-teal-brand text-oxford-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-teal-400 transition"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fail-Safe Native Camera Snapshot Option */}
        <div className="space-y-2">
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-brand/10 hover:bg-teal-brand/20 text-teal-dark text-xs font-bold border border-teal-brand/30 transition shadow-2xs disabled:opacity-50"
          >
            {isProcessingFile ? (
              <RefreshCw className="w-4 h-4 animate-spin text-teal-brand" />
            ) : (
              <Camera className="w-4 h-4 text-teal-brand" />
            )}
            <span>
              {isProcessingFile
                ? 'Processing Photo...'
                : 'Snap with Phone Camera / Upload Photo'}
            </span>
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Tip: Hold ID card 15–20cm flat. If glare reflects off the plastic, use the flashlight or snap a photo.
          </p>
        </div>

        {/* Manual Input Toggle */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs text-teal-dark hover:underline inline-flex items-center gap-1 font-medium"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showManualInput ? 'Hide manual entry' : 'Type or paste code manually'}</span>
          </button>
        </div>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2 animate-fade-in">
            <input
              type="text"
              placeholder="e.g. U24MTH1019 or paste raw card characters..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-teal-brand outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3.5 py-2 bg-oxford-800 hover:bg-oxford-700 text-white font-bold text-xs rounded-lg disabled:opacity-40"
            >
              Apply
            </button>
          </form>
        )}

        {/* Cancel Button */}
        <div className="mt-4 pt-3 border-t border-surface-border flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs text-slate-600 rounded-lg hover:bg-slate-100 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
