import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  CreditCard,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Keyboard,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Student, UserProfile, Department } from '../types';
import { aegisStore } from '../lib/supabase';
import { playSuccessChime } from '../lib/qrHelper';

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

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const containerId = 'aegis-id-card-scanner-container';

  useEffect(() => {
    if (!isOpen) return;

    setScannedToken('');
    setManualInput('');
    setBindResult(null);
    setCameraError(null);

    const timer = setTimeout(() => {
      startCamera();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, student?.id]);

  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current && isScanningRef.current) return;

      const qrScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        verbose: false
      });
      html5QrCodeRef.current = qrScanner;

      const scanConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      const onScanSuccess = (decodedText: string) => {
        const trimmed = decodedText.trim();
        setScannedToken(trimmed);
        setManualInput(trimmed);
        playSuccessChime();
      };

      try {
        await qrScanner.start(
          { facingMode: 'environment' },
          scanConfig,
          onScanSuccess,
          () => {}
        );
      } catch (backCamErr) {
        await qrScanner.start(
          { facingMode: 'user' },
          scanConfig,
          onScanSuccess,
          () => {}
        );
      }

      isScanningRef.current = true;
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Card scanner camera initiation failed:', err);
      setCameraError(
        err.message ||
          'Camera access was denied or not supported. You can enter or paste the 32-character QR code manually below.'
      );
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping card camera:', err);
      } finally {
        isScanningRef.current = false;
        setScannerActive(false);
        html5QrCodeRef.current = null;
      }
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
  const isInput32Chars = activeInput.trim().length === 32;

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
                Link Existing 32-Character QR Codes to Student Account
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Student Target Summary */}
          <div className="bg-oxford-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
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
                  isCurrently32Chars
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
              <div id={containerId} className="w-full h-full" />

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

          {/* Manual Input or Scanned Result Display */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-4 h-4 text-teal-brand" />
                Scanned QR Code Token (or enter/paste manually):
              </span>
              {activeInput && (
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                    isInput32Chars
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {activeInput.trim().length} Characters {isInput32Chars && '✓ 32-char Match'}
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. a7f9c2d4e8b10f3a6e5d8c7b9a0f1e2d"
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
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-brand mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-oxford-800">Card Verification Security:</p>
              <p className="text-slate-500 leading-relaxed">
                Once bound, the student can simply present their existing physical ID card in class. The Course Representative's scanner will instantly recognise their 32-character token and verify attendance without requiring GPS coordinates or a mobile phone!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isCurrently32Chars ? 'Card already bound' : 'Unbound / Default ID'}
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
