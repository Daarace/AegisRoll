import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, Keyboard, ScanLine } from 'lucide-react';
import { parseScannedStudentQr, playSuccessChime } from '../lib/qrHelper';
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

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const containerId = 'aegis-direct-card-scanner';

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    setManualInput('');
    setShowManualInput(false);

    const timer = setTimeout(() => {
      startCamera();
    }, 200);

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
      if (html5QrCodeRef.current && isScanningRef.current) return;

      const scanner = new Html5Qrcode(containerId, {
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
      html5QrCodeRef.current = scanner;

      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(Math.floor(edge * 0.85), 200);
          return { width: size, height: size };
        }
      };

      try {
        // Try rear/environment camera (smartphones/tablets)
        await scanner.start(
          { facingMode: 'environment' },
          scanConfig,
          (decodedText) => processDecodedText(decodedText),
          () => {}
        );
      } catch (backCamErr) {
        // Fallback to front camera or default webcam (laptops/desktops)
        await scanner.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => processDecodedText(decodedText),
          () => {}
        );
      }

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Direct scanner camera initiation failed:', err);
      setCameraError(
        err.message ||
          'Camera access was denied or not supported. You can enter or paste the ID code manually below.'
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
        console.warn('Error stopping direct scanner:', err);
      } finally {
        isScanningRef.current = false;
        setScannerActive(false);
        html5QrCodeRef.current = null;
      }
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
      <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-surface-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
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
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="my-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-72 mx-auto flex items-center justify-center border-2 border-teal-brand/40 shadow-inner">
            <div id={containerId} className="w-full h-full" />

            {!scannerActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-oxford-900 text-white gap-2 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-teal-brand animate-spin" />
                <p className="text-xs text-slate-300">Initializing live camera scanner...</p>
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

        {/* Guidance tip */}
        <p className="text-center text-[11px] text-slate-500">
          Point lens at a 1D barcode on a plastic ID card or digital 2D QR pass.
        </p>

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
          <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="e.g. U24MTH1019 or card token..."
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
        <div className="mt-5 pt-3 border-t border-surface-border flex justify-end">
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
