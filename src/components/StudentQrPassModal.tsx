import React, { useEffect, useState } from 'react';
import { X, QrCode, Download, RefreshCw, CheckCircle2, ShieldCheck, Sparkles, CreditCard } from 'lucide-react';
import { Student, UserProfile, Department } from '../types';
import { generateQrDataUrl, buildStudentQrPayload } from '../lib/qrHelper';
import { aegisStore } from '../lib/supabase';
import { BindIdCardModal } from './BindIdCardModal';

interface StudentQrPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  user?: UserProfile;
  department?: Department;
  onRegenerated?: (newQrId: string) => void;
}

export const StudentQrPassModal: React.FC<StudentQrPassModalProps> = ({
  isOpen,
  onClose,
  student,
  user,
  department,
  onRegenerated
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showBindCardModal, setShowBindCardModal] = useState(false);

  useEffect(() => {
    if (!isOpen || !student) return;

    let mounted = true;
    setIsGenerating(true);

    const payload = buildStudentQrPayload(student, user);
    generateQrDataUrl(payload, { width: 360 })
      .then((url) => {
        if (mounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
        if (mounted) setIsGenerating(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, student?.id, student?.qr_code_id, user?.full_name]);

  if (!isOpen) return null;

  const handleDownloadImage = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `AegisRoll_QR_Pass_${student.matric_number.replace(/[^A-Za-z0-9]/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyQrId = () => {
    if (student.qr_code_id) {
      navigator.clipboard.writeText(student.qr_code_id);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleRegenerate = () => {
    if (
      !confirm(
        'Regenerating your QR Pass will permanently invalidate any previously printed or saved copies. Do you wish to continue?'
      )
    ) {
      return;
    }

    setIsRegenerating(true);
    try {
      const newId = aegisStore.regenerateStudentQrCode(student.id);
      if (onRegenerated) onRegenerated(newId);
    } catch (e: any) {
      alert('Failed to regenerate: ' + e.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card w-full max-w-md rounded-2xl shadow-academic border border-surface-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-oxford-800 text-white px-6 py-4 flex items-center justify-between border-b border-oxford-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Digital Student QR Pass</h2>
              <p className="text-xs text-slate-300">Offline Academic Identification & Check-In</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-center">
          {/* Identity Card Header */}
          <div className="bg-oxford-50 border border-slate-200 rounded-xl p-4 text-left space-y-1 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Student Pass
              </span>
              <span className="text-xs font-mono text-slate-500">
                {department?.code || 'CSE'}
              </span>
            </div>
            <h3 className="font-serif font-bold text-lg text-oxford-800 pt-1">
              {user?.full_name || 'Enrolled Student'}
            </h3>
            <p className="text-sm font-mono font-semibold text-oxford-700">
              {student.matric_number}
            </p>
            <p className="text-xs text-slate-500">
              {department?.name || 'Department of Computer Science & Engineering'}
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative mx-auto w-64 h-64 p-3 bg-white rounded-2xl border-2 border-dashed border-teal-brand/50 shadow-inner flex items-center justify-center">
            {isGenerating || isRegenerating ? (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-brand" />
                <span className="text-xs">Generating secure vector QR...</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Pass for ${student.matric_number}`}
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <p className="text-xs text-red-500">Failed to render QR Code.</p>
            )}
          </div>

          {/* Unique QR ID badge with copy */}
          <div className="flex items-center justify-center gap-2">
            <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono font-medium text-slate-700">
              <span>Token:</span>
              <span className="text-oxford-800 font-bold truncate max-w-[180px]">
                {student.qr_code_id || 'AR-QR-UNKNOWN'}
              </span>
            </div>
            <button
              onClick={handleCopyQrId}
              className="text-xs text-teal-brand hover:text-teal-700 font-medium px-2 py-1.5 rounded hover:bg-teal-50 transition"
              title="Copy ID string"
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Physical ID Card Binding Card */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-left flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-brand shrink-0" />
              <div>
                <span className="text-xs font-bold text-oxford-800 block">
                  {student.qr_code_id && student.qr_code_id.length === 32
                    ? 'Physical Student ID Card Bound'
                    : 'Physical ID Card (32-Char QR)'}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  {student.qr_code_id && student.qr_code_id.length === 32
                    ? `✓ 32-Char Token: ${student.qr_code_id.substring(0, 10)}...`
                    : 'Have an ID card? Link the 32-char code'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBindCardModal(true)}
              className="px-2.5 py-1.5 bg-teal-brand hover:bg-teal-hover text-oxford-900 rounded-lg text-xs font-bold transition shadow-sm shrink-0"
            >
              {student.qr_code_id && student.qr_code_id.length === 32 ? 'Re-link' : 'Link Card'}
            </button>
          </div>

          {/* Offline & Geofence-Bypass Explanation */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-left text-xs text-amber-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">Zero-Geofence Backup Sign-In:</p>
              <p className="text-slate-600 leading-relaxed">
                If your device lacks GPS signal, phone battery is dying, or location services are disabled, show this screen to your Course Representative. They can scan it directly to record you as <strong>Present</strong> with 0m distance.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate ID
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={!qrDataUrl}
              className="inline-flex items-center gap-1.5 text-xs bg-white text-oxford-800 border border-slate-300 font-medium px-3.5 py-2 rounded-lg hover:bg-slate-100 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-teal-brand" />
              Save PNG Image
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs bg-oxford-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-oxford-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Bind Physical ID Card Submodal */}
      <BindIdCardModal
        isOpen={showBindCardModal}
        onClose={() => setShowBindCardModal(false)}
        student={student}
        user={user}
        department={department}
        onBoundSuccessfully={(newQr) => {
          if (onRegenerated) onRegenerated(newQr);
          setShowBindCardModal(false);
        }}
      />
    </div>
  );
};
