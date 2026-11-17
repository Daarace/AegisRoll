import React from 'react';
import {
  MapPinOff,
  AlertTriangle,
  Compass,
  Wifi,
  Smartphone,
  ExternalLink,
  X,
  RefreshCw
} from 'lucide-react';
import { GeoErrorResult } from '../lib/geolocation';

interface GpsPermissionModalProps {
  error: GeoErrorResult | null;
  onRetry: () => void;
  onClose: () => void;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  error,
  onRetry,
  onClose
}) => {
  if (!error) return null;

  const isDenied = error.code === 1;
  const isAccuracyLow = error.code === 4;

  return (
    <div className="fixed inset-0 bg-oxford-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-card rounded-2xl max-w-md w-full p-6 shadow-academic-lg border border-red-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isAccuracyLow ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {isAccuracyLow ? <AlertTriangle className="w-6 h-6" /> : <MapPinOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-oxford-800">
              {isAccuracyLow ? 'Low GPS Accuracy' : 'Location Permission Required'}
            </h3>
            <p className="text-xs text-slate-500">
              Academic geofencing verification notice
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            <p className="font-medium text-slate-900 mb-1">{error.message}</p>
            <p className="text-slate-600">{error.userHint}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Steps to Resolve:
            </h4>
            <ul className="text-xs space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <Wifi className="w-4 h-4 text-teal-brand shrink-0 mt-0.5" />
                <span>
                  <strong>Turn ON Device Wi-Fi:</strong> Even without connecting to a network, Wi-Fi beacons drastically improve indoor positioning accuracy from ±150m down to ±10m.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Compass className="w-4 h-4 text-gold-dark shrink-0 mt-0.5" />
                <span>
                  <strong>Move near a window or open door:</strong> Thick reinforced concrete classroom ceilings can degrade direct satellite visibility.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-oxford-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Enable "Precise Location" in browser permissions:</strong> Check your browser URL bar or app settings and toggle Precise Location to ON.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onRetry}
              className="px-4 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Location Acquisition
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
