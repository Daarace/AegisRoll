import jsQR from 'jsqr';

export interface DecodedCodeResult {
  text: string;
  format?: string;
}

/**
 * High-speed dual QR decoding engine:
 * 1. Checks native hardware BarcodeDetector (GPU/NPU hardware acceleration, sub-10ms).
 * 2. Runs jsQR on canvas ImageData with 'attemptBoth' (supports normal & inverted contrast).
 */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<DecodedCodeResult | null> {
  if (!video || video.readyState < 2) {
    return null;
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  // 1. Hardware-Accelerated BarcodeDetector (Native Mobile Browser API)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector =
        (window as any)._aegisBarcodeDetector ||
        new (window as any).BarcodeDetector({
          formats: ['qr_code', 'data_matrix', 'code_128', 'code_39', 'ean_13', 'ean_8']
        });
      (window as any)._aegisBarcodeDetector = detector;

      const barcodes = await detector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return {
          text: barcodes[0].rawValue,
          format: barcodes[0].format || 'qr_code'
        };
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // 2. High-Performance jsQR on canvas
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });

    if (code && code.data && code.data.trim()) {
      return {
        text: code.data.trim(),
        format: 'qr_code'
      };
    }
  } catch {
    // Canvas read error
  }

  return null;
}

/**
 * Decodes an image file or blob directly using jsQR
 */
export async function decodeImageFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
      resolve(code ? code.data : null);
    };
    img.onerror = () => reject(new Error('Failed to load image file.'));
    img.src = URL.createObjectURL(file);
  });
}
