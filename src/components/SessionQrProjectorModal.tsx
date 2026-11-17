import React, { useEffect, useState } from 'react';
import { X, QrCode, Download, Sparkles, Maximize2, ShieldCheck } from 'lucide-react';
import { ClassSession, Course } from '../types';
import { generateQrDataUrl, buildSessionBackupQrPayload } from '../lib/qrHelper';

interface SessionQrProjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ClassSession;
  course?: Course;
}

export const SessionQrProjectorModal: React.FC<SessionQrProjectorModalProps> = ({
  isOpen,
  onClose,
  session,
  course
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return;

    const payload = buildSessionBackupQrPayload(session);
    generateQrDataUrl(payload, { width: 450 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating session QR code:', err));
  }, [isOpen, session?.id, session?.session_pin]);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `AegisRoll_Session_QR_${session.session_pin}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-card w-full max-w-lg rounded-3xl shadow-academic border border-surface-border overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-oxford-800 text-white px-6 py-4 flex items-center justify-between border-b border-oxford-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-brand/20 border border-teal-brand/40 flex items-center justify-center text-teal-brand">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Classroom Projection QR Code</h2>
              <p className="text-xs text-slate-300">Backup Sign-in for Students Without GPS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700 transition"
              title="Toggle Fullscreen Projection"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-oxford-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-center flex-1 flex flex-col justify-center">
          {/* Metadata pill */}
          <div className="inline-flex items-center justify-center gap-2 bg-oxford-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 font-medium">
            <span className="font-bold text-oxford-800">{course?.course_code || 'CSC 401'}</span>
            <span>•</span>
            <span className="truncate max-w-[200px]">{course?.title || 'Class Session'}</span>
            <span>•</span>
            <span className="text-teal-700 font-bold">{session.venue || 'Classroom'}</span>
          </div>

          {/* Large QR Display */}
          <div className="relative mx-auto w-72 h-72 p-4 bg-white rounded-3xl border-4 border-dashed border-teal-brand/40 shadow-xl flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Session Backup QR for PIN ${session.session_pin}`}
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <p className="text-xs text-slate-400">Rendering high-res QR...</p>
            )}
          </div>

          {/* 4-Digit PIN Callout */}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
              Alternative 4-Digit Session PIN
            </p>
            <div className="text-4xl font-mono font-extrabold tracking-widest text-oxford-800">
              {session.session_pin}
            </div>
          </div>

          {/* Instruction */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 text-xs text-teal-900 text-left flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Student Instructions:</p>
              <p className="text-slate-600 mt-0.5">
                Students can open AegisRoll, select <strong>"Scan Class Backup QR"</strong> on their dashboard, and point their camera at this screen to instantly mark their presence without needing GPS coordinates.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 text-xs bg-white text-oxford-800 border border-slate-300 font-medium px-3.5 py-2 rounded-lg hover:bg-slate-100 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-teal-brand" />
            Save QR Image
          </button>
          <button
            onClick={onClose}
            className="text-xs bg-oxford-800 text-white font-medium px-4 py-2 rounded-lg hover:bg-oxford-700 transition"
          >
            Close Projection
          </button>
        </div>
      </div>
    </div>
  );
};
