import { logger } from '../../bootstrap/logger.js';
import sharp from 'sharp';

/**
 * Maximum image size limits for OpenRouter/xAI Grok API
 * Based on observed 413 errors and API documentation
 */
export const IMAGE_SIZE_LIMITS = {
  // Maximum file size in bytes (5MB)
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,

  // Maximum dimension (width or height)
  MAX_DIMENSION_PX: 2048,

  // Target size for oversized images (3MB to leave buffer)
  TARGET_SIZE_BYTES: 3 * 1024 * 1024,

  // JPEG quality for compression
  JPEG_QUALITY: 85,
} as const;

/**
 * Checks if an image URL (remote or data URL) exceeds size limits
 */
export async function checkImageSize(imageUrl: string): Promise<{
  isOversized: boolean;
  sizeBytes: number;
  reason?: string;
}> {
  try {
    let buffer: Buffer;

    if (imageUrl.startsWith('data:')) {
      // Extract base64 from data URL
      const commaIndex = imageUrl.indexOf(',');
      if (commaIndex === -1) {
        return { isOversized: false, sizeBytes: 0, reason: 'Invalid data URL' };
      }
      const base64 = imageUrl.substring(commaIndex + 1);
      buffer = Buffer.from(base64, 'base64');
    } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Fetch remote image
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*'
        }
      });

      if (!response.ok) {
        return { isOversized: false, sizeBytes: 0, reason: `HTTP ${response.status}` };
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return { isOversized: false, sizeBytes: 0, reason: 'Unknown format' };
    }

    const sizeBytes = buffer.length;
    const isOversized = sizeBytes > IMAGE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES;

    return {
      isOversized,
      sizeBytes,
      reason: isOversized ? `Image size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds ${IMAGE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` : undefined
    };
  } catch (error) {
    logger.warn('[ImageResizer] Failed to check image size', {
      imageUrl: imageUrl.substring(0, 100),
      error: error instanceof Error ? error.message : String(error)
    });
    return { isOversized: false, sizeBytes: 0, reason: 'Check failed' };
  }
}

/**
 * Resizes and compresses an oversized image to meet API limits
 * Returns a data URL of the resized image
 */
export async function resizeImage(imageUrl: string): Promise<string> {
  try {
    logger.info('[ImageResizer] Starting image resize', {
      imageUrl: imageUrl.substring(0, 100)
    });

    let buffer: Buffer;
    let contentType = 'image/jpeg';

    // Get image buffer
    if (imageUrl.startsWith('data:')) {
      const commaIndex = imageUrl.indexOf(',');
      if (commaIndex === -1) {
        throw new Error('Invalid data URL format');
      }
      const header = imageUrl.substring(0, commaIndex);
      const mimeMatch = header.match(/^data:([^;]+)/i);
      if (mimeMatch) {
        contentType = mimeMatch[1];
      }
      const base64 = imageUrl.substring(commaIndex + 1);
      buffer = Buffer.from(base64, 'base64');
    } else {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const originalSize = buffer.length;
    logger.debug('[ImageResizer] Original image loaded', {
      sizeBytes: originalSize,
      sizeMB: (originalSize / 1024 / 1024).toFixed(2),
      contentType
    });

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const { width = 0, height = 0 } = metadata;

    logger.debug('[ImageResizer] Image dimensions', {
      width,
      height,
      format: metadata.format
    });

    // Calculate new dimensions while maintaining aspect ratio
    const maxDimension = IMAGE_SIZE_LIMITS.MAX_DIMENSION_PX;
    let newWidth = width;
    let newHeight = height;

    if (width > maxDimension || height > maxDimension) {
      const aspectRatio = width / height;
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.round(maxDimension / aspectRatio);
      } else {
        newHeight = maxDimension;
        newWidth = Math.round(maxDimension * aspectRatio);
      }
    }

    // Resize and compress
    let resizedBuffer = await sharp(buffer)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: IMAGE_SIZE_LIMITS.JPEG_QUALITY, progressive: true })
      .toBuffer();

    // If still too large, reduce quality iteratively
    let quality = IMAGE_SIZE_LIMITS.JPEG_QUALITY;
    while (resizedBuffer.length > IMAGE_SIZE_LIMITS.TARGET_SIZE_BYTES && quality > 60) {
      quality -= 5;
      logger.debug('[ImageResizer] Still too large, reducing quality', { quality });
      resizedBuffer = await sharp(buffer)
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();
    }

    const finalSize = resizedBuffer.length;
    const base64 = resizedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    logger.info('[ImageResizer] Image resized successfully', {
      originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
      finalSizeMB: (finalSize / 1024 / 1024).toFixed(2),
      reductionPercent: ((1 - finalSize / originalSize) * 100).toFixed(1),
      originalDimensions: `${width}x${height}`,
      newDimensions: `${newWidth}x${newHeight}`,
      finalQuality: quality
    });

    return dataUrl;
  } catch (error) {
    logger.error('[ImageResizer] Failed to resize image', {
      imageUrl: imageUrl.substring(0, 100),
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Image resize failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Prepares an image for OpenRouter API by checking size and resizing if needed
 * Returns the original or resized image as appropriate
 */
export async function prepareImageForAPI(imageUrl: string): Promise<{
  imageUrl: string;
  wasResized: boolean;
  originalSizeMB?: number;
  finalSizeMB?: number;
}> {
  const sizeCheck = await checkImageSize(imageUrl);

  if (!sizeCheck.isOversized) {
    logger.debug('[ImageResizer] Image within size limits, no resize needed', {
      sizeMB: (sizeCheck.sizeBytes / 1024 / 1024).toFixed(2)
    });
    return {
      imageUrl,
      wasResized: false,
      originalSizeMB: sizeCheck.sizeBytes / 1024 / 1024
    };
  }

  logger.warn('[ImageResizer] Image exceeds size limits, resizing required', {
    sizeMB: (sizeCheck.sizeBytes / 1024 / 1024).toFixed(2),
    reason: sizeCheck.reason
  });

  try {
    const resizedUrl = await resizeImage(imageUrl);
    const finalCheck = await checkImageSize(resizedUrl);

    return {
      imageUrl: resizedUrl,
      wasResized: true,
      originalSizeMB: sizeCheck.sizeBytes / 1024 / 1024,
      finalSizeMB: finalCheck.sizeBytes / 1024 / 1024
    };
  } catch (error) {
    logger.error('[ImageResizer] Failed to prepare image, using original', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Return original if resize fails - let API handle it
    return {
      imageUrl,
      wasResized: false,
      originalSizeMB: sizeCheck.sizeBytes / 1024 / 1024
    };
  }
}
