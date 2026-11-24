import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, AlertCircle, Keyboard, ScanLine, Zap, ZapOff } from 'lucide-react';
import { parseScannedStudentQr, playSuccessChime } from '../lib/qrHelper';
import { decodeVideoFrame } from '../lib/fastScanner';
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setCameraError(null);
    setManualInput('');
    setShowManualInput(false);

    const timer = setTimeout(() => {
      startCamera();
    }, 100);

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
    const candidateMatric = (parsedQr.matricNumber || raw).trim().toUpperCase();
    const matricDetails = parseMatricNumber(candidateMatric);

    const result: ScannedIdCardResult = {
      rawCode: raw,
      matricNumber: parsedQr.matricNumber || candidateMatric,
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        }
      });

      mediaStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        setHasTorch(Boolean(caps.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      isScanningRef.current = true;
      setScannerActive(true);

      runScanLoop();
    } catch (err: any) {
      console.warn('Direct scanner camera initiation failed:', err);
      // Fallback: try basic video
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }
        isScanningRef.current = true;
        setScannerActive(true);
        runScanLoop();
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr.message ||
            'Camera access was denied or not supported. You can enter or paste the ID code manually below.'
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

      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        try {
          const result = await decodeVideoFrame(videoRef.current, canvasRef.current);
          if (result && result.text) {
            processDecodedText(result.text);
            return;
          }
        } catch {
          // Continue
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
          const next = !isTorchOn;
          await track.applyConstraints({ advanced: [{ torch: next }] as any });
          setIsTorchOn(next);
        } catch (e) {
          console.warn('Torch toggle failed:', e);
        }
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      processDecodedText(manualInput.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card w-full max-w-md rounded-2xl shadow-academic border border-surface-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-oxford-800 text-white px-5 py-4 flex items-center justify-between border-b border-oxford-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-sm text-white">{title}</h2>
              <p className="text-[11px] text-slate-300">Fast Hardware Scanning</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport & Controls */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">{subtitle}</p>

          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video sm:aspect-square max-h-64 mx-auto flex items-center justify-center border-2 border-teal-brand/40 shadow-inner">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Target Reticle */}
            {scannerActive && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-teal-brand rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-teal-brand rounded-tl" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-teal-brand rounded-tr" />
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-teal-brand rounded-bl" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-teal-brand rounded-br" />
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-brand to-transparent shadow-[0_0_8px_#26B9A8] animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-6 h-6 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Activating camera...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-5 text-center">
                <AlertCircle className="w-7 h-7 text-amber-400" />
                <p className="text-xs text-amber-200">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-1 text-xs bg-teal-brand text-oxford-900 font-semibold px-3 py-1 rounded-lg hover:bg-teal-400 transition"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Torch toggle if supported */}
          {hasTorch && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  isTorchOn
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {isTorchOn ? <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" /> : <ZapOff className="w-3.5 h-3.5" />}
                <span>{isTorchOn ? 'Torch On (Better for Plastic Cards)' : 'Turn On Torch'}</span>
              </button>
            </div>
          )}

          {/* Manual Input */}
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-slate-600 hover:text-oxford-800 font-medium flex items-center gap-1.5"
            >
              <Keyboard className="w-3.5 h-3.5 text-teal-brand" />
              {showManualInput ? 'Hide manual entry' : 'Type or paste ID card code / matric number'}
            </button>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. U24MTH1019 or card token"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase font-mono outline-none focus:ring-1 focus:ring-teal-brand"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="bg-oxford-800 text-white text-xs px-3.5 py-2 rounded-lg font-medium hover:bg-oxford-700 disabled:opacity-50"
                >
                  Verify
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
