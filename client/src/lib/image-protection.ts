// Image protection utilities for preventing reverse image searches

export interface ProtectionSettings {
  level: 'light' | 'standard' | 'heavy';
  blur?: number;
  noise?: number;
  resize?: number;
  quality?: number;
}

export interface ImageProcessingOptions extends ProtectionSettings {
  blurIntensity?: number;
  addNoise?: boolean;
  resizePercent?: number;
  cropPercent?: number;
}

export const protectionPresets: Record<string, ProtectionSettings> = {
  light: {
    level: 'light',
    blur: 0.5,
    noise: 5,
    resize: 95,
    quality: 92
  },
  standard: {
    level: 'standard',
    blur: 1.0,
    noise: 10,
    resize: 90,
    quality: 88
  },
  heavy: {
    level: 'heavy',
    blur: 1.5,
    noise: 15,
    resize: 85,
    quality: 85
  }
};

export async function protectImage(
  imageFile: File,
  settingsOrLevel: ProtectionSettings | 'light' | 'standard' | 'heavy' = 'standard',
  addWatermark: boolean = false
): Promise<Blob> {
  const settings = typeof settingsOrLevel === 'string' 
    ? protectionPresets[settingsOrLevel] 
    : settingsOrLevel;
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions
        const scaleFactor = settings.resize! / 100;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        // Apply blur filter
        ctx.filter = `blur(${settings.blur}px)`;
        
        // Draw the resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add noise
        if (settings.noise && settings.noise > 0) {
          addNoise(ctx, canvas.width, canvas.height, settings.noise);
        }
        
        // Add watermark for free users
        if (addWatermark) {
          // Reset any filters for watermark
          ctx.filter = 'none';
          
          // Set up watermark style
          const fontSize = Math.max(16, canvas.width * 0.03);
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 2;
          
          // Watermark text
          const watermarkText = 'Protected by ThottoPilot™';
          
          // Calculate position (bottom right corner)
          const textMetrics = ctx.measureText(watermarkText);
          const padding = fontSize;
          const x = canvas.width - textMetrics.width - padding;
          const y = canvas.height - padding;
          
          // Draw text with outline for better visibility
          ctx.strokeText(watermarkText, x, y);
          ctx.fillText(watermarkText, x, y);
          
          // Add subtle shield icon before text
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          const iconSize = fontSize * 0.8;
          const iconX = x - iconSize - 5;
          const iconY = y - fontSize + 5;
          
          // Draw simple shield icon
          ctx.beginPath();
          ctx.moveTo(iconX, iconY);
          ctx.lineTo(iconX + iconSize, iconY);
          ctx.lineTo(iconX + iconSize, iconY + iconSize * 0.6);
          ctx.lineTo(iconX + iconSize * 0.5, iconY + iconSize);
          ctx.lineTo(iconX, iconY + iconSize * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          (settings.quality || 85) / 100
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageFile);
  });
}

function addNoise(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Add random noise to RGB channels
    const noise = (Math.random() - 0.5) * intensity * 2;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));     // Red
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // Green
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // Blue
    // Alpha channel (data[i + 3]) remains unchanged
  }
  
  ctx.putImageData(imageData, 0, 0);
}

export function downloadProtectedImage(blob: Blob, originalFileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `protected_${originalFileName}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getProtectionPreview(level: 'light' | 'standard' | 'heavy'): string {
  const settings = protectionPresets[level];
  return `Blur: ${settings.blur}px, Noise: ${settings.noise}%, Resize: ${settings.resize}%, Quality: ${settings.quality}%`;
}

// Removed duplicate export - interface is now defined above