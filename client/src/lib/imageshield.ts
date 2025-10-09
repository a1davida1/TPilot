/**
 * ImageShield client-side API
 * Wrapper around the Web Worker for easy image protection
 */

export interface ProtectionResult {
  blob: Blob;
  metrics: {
    ssim: number;
    phashDelta: number;
    processingTime: number;
    downscaled: boolean;
  };
}

export type ProtectionPreset = 'fast' | 'medium' | 'max';

/**
 * Protect an image using client-side ImageShield worker
 * @param file Image file to protect
 * @param preset Protection level (default: medium)
 * @returns Protected image blob with quality metrics
 */
export async function protectImage(
  file: File,
  preset: ProtectionPreset = 'medium'
): Promise<ProtectionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/imageShield.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent) => {
      if ('error' in event.data) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data as ProtectionResult);
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(new Error(`ImageShield worker error: ${error.message}`));
      worker.terminate();
    };

    worker.postMessage({ file, preset });
  });
}

/**
 * Create a low-resolution preview of an image for caption generation
 * @param file Image file
 * @param maxDimension Maximum width or height (default: 1024)
 * @returns Base64-encoded JPEG string
 */
export async function createLowResPreview(
  file: File,
  maxDimension: number = 1024
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  
  const scale = Math.min(maxDimension / bitmap.width, maxDimension / bitmap.height, 1);
  const width = Math.floor(bitmap.width * scale);
  const height = Math.floor(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(bitmap, 0, 0, width, height);

  // Convert to base64 JPEG
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  return base64;
}
