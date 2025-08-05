// Image protection utilities for preventing reverse image searches
// while maintaining visual quality for content creators

export interface ImageProcessingOptions {
  blurIntensity: 'subtle' | 'medium' | 'strong';
  addNoise: boolean;
  resizePercent: number; // 90-110% to slightly alter dimensions
  cropPercent: number; // 0-10% to crop edges
  quality: number; // 0.7-0.95 for JPEG compression
}

export const defaultProtectionSettings: ImageProcessingOptions = {
  blurIntensity: 'subtle',
  addNoise: true,
  resizePercent: 95,
  cropPercent: 5,
  quality: 0.85
};

/**
 * Applies anti-reverse-search processing to an image while maintaining visual appeal
 */
export async function protectImage(
  file: File, 
  options: ImageProcessingOptions = defaultProtectionSettings
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');

        // Calculate new dimensions with slight resize
        const originalWidth = img.width;
        const originalHeight = img.height;
        const resizeFactor = options.resizePercent / 100;
        const cropFactor = options.cropPercent / 100;
        
        const newWidth = Math.floor(originalWidth * resizeFactor);
        const newHeight = Math.floor(originalHeight * resizeFactor);
        
        // Apply crop by adjusting source dimensions
        const cropX = Math.floor(originalWidth * cropFactor / 2);
        const cropY = Math.floor(originalHeight * cropFactor / 2);
        const sourceWidth = originalWidth - (cropX * 2);
        const sourceHeight = originalHeight - (cropY * 2);

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw the cropped and resized image
        ctx.drawImage(
          img, 
          cropX, cropY, sourceWidth, sourceHeight,  // source
          0, 0, newWidth, newHeight                 // destination
        );

        // Apply blur effect using canvas filter
        const blurValues = {
          subtle: '1.5px',
          medium: '2.5px', 
          strong: '4px'
        };
        ctx.filter = `blur(${blurValues[options.blurIntensity]})`;
        
        // Redraw with blur
        const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
        ctx.filter = 'none';
        ctx.putImageData(imageData, 0, 0);

        // Add subtle noise if enabled
        if (options.addNoise) {
          const pixelData = ctx.getImageData(0, 0, newWidth, newHeight);
          const data = pixelData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            // Add random noise to RGB channels (skip alpha)
            const noise = (Math.random() - 0.5) * 8; // ±4 pixel value variation
            data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
          }
          
          ctx.putImageData(pixelData, 0, 0);
        }

        // Convert to blob with quality compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          options.quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Creates a download link for the protected image
 */
export function downloadProtectedImage(blob: Blob, originalFilename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Generate new filename with protection suffix
  const nameParts = originalFilename.split('.');
  const extension = nameParts.pop() || 'jpg';
  const baseName = nameParts.join('.');
  link.download = `${baseName}_protected.${extension}`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Preset configurations for different protection levels
 */
export const protectionPresets = {
  light: {
    blurIntensity: 'subtle' as const,
    addNoise: true,
    resizePercent: 98,
    cropPercent: 2,
    quality: 0.90
  },
  standard: {
    blurIntensity: 'medium' as const,
    addNoise: true,
    resizePercent: 95,
    cropPercent: 5,
    quality: 0.85
  },
  heavy: {
    blurIntensity: 'strong' as const,
    addNoise: true,
    resizePercent: 90,
    cropPercent: 8,
    quality: 0.80
  }
};