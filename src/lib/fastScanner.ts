import jsQR from 'jsqr';
import {
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader
} from '@zxing/library';

export interface DecodedCodeResult {
  text: string;
  format?: string;
}

// 1. Reusable ZXing MultiFormatReader configured with TRY_HARDER and ID card formats
const zxingHints = new Map<DecodeHintType, any>();
zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A
]);
zxingHints.set(DecodeHintType.TRY_HARDER, true);

const zxingReader = new MultiFormatReader();
zxingReader.setHints(zxingHints);

// 2. Persistent off-screen canvases (never attached to DOM, immune to CSS display:none)
let macroCanvas: HTMLCanvasElement | null = null;
let fullCanvas: HTMLCanvasElement | null = null;

function getMacroCanvas(): HTMLCanvasElement {
  if (!macroCanvas && typeof document !== 'undefined') {
    macroCanvas = document.createElement('canvas');
  }
  return macroCanvas!;
}

function getFullCanvas(): HTMLCanvasElement {
  if (!fullCanvas && typeof document !== 'undefined') {
    fullCanvas = document.createElement('canvas');
  }
  return fullCanvas!;
}

// 3. Cached native BarcodeDetector instance (initialized once with supported formats)
let cachedDetector: any = null;
let detectorInitAttempted = false;

async function getBarcodeDetector(): Promise<any | null> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  if (cachedDetector) return cachedDetector;
  if (detectorInitAttempted) return null;
  detectorInitAttempted = true;

  try {
    const BD = (window as any).BarcodeDetector;
    const desired = ['qr_code', 'data_matrix', 'code_128', 'code_39', 'ean_13', 'ean_8'];
    let formats = ['qr_code'];
    if (typeof BD.getSupportedFormats === 'function') {
      const supported: string[] = await BD.getSupportedFormats();
      const filtered = desired.filter((f) => supported.includes(f));
      if (filtered.length > 0) formats = filtered;
    }
    cachedDetector = new BD({ formats });
    return cachedDetector;
  } catch {
    return null;
  }
}

/**
 * Fast in-place luminance contrast stretch for low-contrast, dim, or glare-washed plastic cards.
 */
function stretchContrastInPlace(data: Uint8ClampedArray): void {
  let min = 255;
  let max = 0;
  // Sample every 4th pixel for speed
  for (let i = 0; i < data.length; i += 16) {
    const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = max - min;
  if (range < 10 || range > 215) return; // Already high contrast or blank

  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    let v = (lum - min) * scale;
    if (v < 0) v = 0;
    else if (v > 255) v = 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

let frameCounter = 0;

/**
 * Proactive, High-Sensitivity Multi-Engine Video Frame Decoder:
 * - Interleaves passes across frames so the camera loop runs at 25-30+ FPS on mobile.
 * - Crops directly from native video resolution (zero downscale blur on small ID card QRs).
 * - Applies adaptive contrast stretching on alternating frames to defeat plastic glare.
 */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
  _externalCanvas?: HTMLCanvasElement | null
): Promise<DecodedCodeResult | null> {
  if (!video || video.readyState < 2) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  frameCounter = (frameCounter + 1) % 100000;

  // ENGINE 1: Hardware BarcodeDetector (runs every frame on native NPU/GPU in <8ms)
  const detector = await getBarcodeDetector();
  if (detector) {
    try {
      const barcodes = await detector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return {
          text: barcodes[0].rawValue.trim(),
          format: barcodes[0].format || 'qr_code'
        };
      }
    } catch {
      // Continue to software engines
    }
  }

  // ENGINE 2: Native-Resolution Center Macro Crop + jsQR (runs every frame)
  // Extracts center 58% directly from raw video pixels so tiny ID card QRs remain razor sharp
  try {
    const minDim = Math.min(vw, vh);
    const cropSrcSize = Math.round(minDim * 0.58);
    const sx = Math.round((vw - cropSrcSize) / 2);
    const sy = Math.round((vh - cropSrcSize) / 2);

    const macroSize = Math.min(460, cropSrcSize);
    const mCanvas = getMacroCanvas();
    if (mCanvas.width !== macroSize || mCanvas.height !== macroSize) {
      mCanvas.width = macroSize;
      mCanvas.height = macroSize;
    }

    const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
    if (mCtx) {
      mCtx.drawImage(video, sx, sy, cropSrcSize, cropSrcSize, 0, 0, macroSize, macroSize);
      const imgData = mCtx.getImageData(0, 0, macroSize, macroSize);

      // Direct jsQR pass
      const directCode = jsQR(imgData.data, macroSize, macroSize, {
        inversionAttempts: 'attemptBoth'
      });
      if (directCode && directCode.data && directCode.data.trim()) {
        return { text: directCode.data.trim(), format: 'qr_code' };
      }

      // On even frames: stretch contrast to defeat laminate glare & dim lighting, then retry jsQR
      if (frameCounter % 2 === 0) {
        stretchContrastInPlace(imgData.data);
        const boostedCode = jsQR(imgData.data, macroSize, macroSize, {
          inversionAttempts: 'attemptBoth'
        });
        if (boostedCode && boostedCode.data && boostedCode.data.trim()) {
          return { text: boostedCode.data.trim(), format: 'qr_code' };
        }
      }

      // On every 3rd frame: run ZXing MultiFormatReader on the sharp macro crop (catches 1D barcodes & angled QRs)
      if (frameCounter % 3 === 0) {
        try {
          const lum = new RGBLuminanceSource(imgData.data, macroSize, macroSize);
          const bmp = new BinaryBitmap(new HybridBinarizer(lum));
          const zx = zxingReader.decode(bmp);
          if (zx && zx.getText()) {
            return { text: zx.getText().trim(), format: zx.getBarcodeFormat().toString() };
          }
        } catch {
          // NotFoundException expected
        }
      }
    }
  } catch {
    // Continue
  }

  // ENGINE 3: Full-Frame Sweep on every 2nd frame (catches off-center cards or large screen QRs)
  if (frameCounter % 2 === 1) {
    try {
      const maxDim = 680;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const fw = Math.round(vw * scale);
      const fh = Math.round(vh * scale);

      const fCanvas = getFullCanvas();
      if (fCanvas.width !== fw || fCanvas.height !== fh) {
        fCanvas.width = fw;
        fCanvas.height = fh;
      }

      const fCtx = fCanvas.getContext('2d', { willReadFrequently: true });
      if (fCtx) {
        fCtx.drawImage(video, 0, 0, fw, fh);
        const fullData = fCtx.getImageData(0, 0, fw, fh);

        const fullCode = jsQR(fullData.data, fw, fh, {
          inversionAttempts: 'attemptBoth'
        });
        if (fullCode && fullCode.data && fullCode.data.trim()) {
          return { text: fullCode.data.trim(), format: 'qr_code' };
        }

        // Every 4th frame: ZXing full-frame sweep for wide 1D barcodes
        if (frameCounter % 4 === 1) {
          try {
            const lum = new RGBLuminanceSource(fullData.data, fw, fh);
            const bmp = new BinaryBitmap(new HybridBinarizer(lum));
            const zx = zxingReader.decode(bmp);
            if (zx && zx.getText()) {
              return { text: zx.getText().trim(), format: zx.getBarcodeFormat().toString() };
            }
          } catch {
            // NotFoundException expected
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Applies proactive autofocus, continuous exposure/white-balance, and optional macro zoom
 * to a live camera video track. Returns detected hardware capabilities.
 */
export async function applyOptimalCameraConstraints(
  track: MediaStreamTrack,
  preferredZoom: number = 1.5
): Promise<{ hasTorch: boolean; hasZoom: boolean; appliedZoom: number }> {
  let hasTorch = false;
  let hasZoom = false;
  let appliedZoom = 1;

  try {
    const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    hasTorch = Boolean(caps.torch);
    hasZoom = Boolean(caps.zoom);

    const adv: any = {};
    if (caps.focusMode && Array.isArray(caps.focusMode)) {
      if (caps.focusMode.includes('continuous')) adv.focusMode = 'continuous';
      else if (caps.focusMode.includes('auto')) adv.focusMode = 'auto';
    }
    if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      adv.exposureMode = 'continuous';
    }
    if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      adv.whiteBalanceMode = 'continuous';
    }
    if (hasZoom && preferredZoom > 1 && caps.zoom) {
      const minZ = caps.zoom.min || 1;
      const maxZ = caps.zoom.max || 1;
      const targetZ = Math.min(maxZ, Math.max(minZ, preferredZoom));
      if (targetZ > 1) {
        adv.zoom = targetZ;
        appliedZoom = targetZ;
      }
    }

    if (Object.keys(adv).length > 0 && track.applyConstraints) {
      await track.applyConstraints({ advanced: [adv] as any });
    }
  } catch (e) {
    console.warn('Could not apply optimal camera constraints:', e);
  }

  return { hasTorch, hasZoom, appliedZoom };
}

/**
 * Pulses autofocus on the active video track when the user taps the viewfinder.
 */
export async function triggerTapToFocus(stream: MediaStream | null): Promise<void> {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;

  try {
    const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
    if (!caps.focusMode || !Array.isArray(caps.focusMode)) return;

    if (caps.focusMode.includes('single-shot')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] as any });
      setTimeout(() => {
        if (caps.focusMode.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }).catch(() => {});
        }
      }, 600);
    } else if (caps.focusMode.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any });
    }
  } catch {
    // Ignore unsupported focus pulse
  }
}

/**
 * Decodes an image file or photo blob using all engines (including contrast stretch).
 */
export async function decodeImageFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      // 1. Try native BarcodeDetector if available
      const detector = await getBarcodeDetector();
      if (detector) {
        try {
          const barcodes = await detector.detect(img);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            resolve(barcodes[0].rawValue.trim());
            return;
          }
        } catch {
          // Continue to software decoders
        }
      }

      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Try jsQR directly
        const code = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code && code.data && code.data.trim()) {
          resolve(code.data.trim());
          return;
        }

        // Try ZXing
        try {
          const luminanceSource = new RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          const zxResult = zxingReader.decode(binaryBitmap);
          if (zxResult && zxResult.getText()) {
            resolve(zxResult.getText().trim());
            return;
          }
        } catch {
          // Not found
        }

        // Try contrast-stretched jsQR
        stretchContrastInPlace(imageData.data);
        const boostedCode = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (boostedCode && boostedCode.data && boostedCode.data.trim()) {
          resolve(boostedCode.data.trim());
          return;
        }

        resolve(null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image file.'));
    img.src = URL.createObjectURL(file);
  });
}
