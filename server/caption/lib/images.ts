import { logger } from '../../bootstrap/logger.js';
import { ImgboxService } from '../../lib/imgbox-service.js';

/**
 * Fetches an image URL and converts it to a data URL (base64)
 * Used to bypass hotlinking protection or API blocking from image hosts
 */
export async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  try {
    logger.debug('[Images] Fetching image for data URL conversion', {
      imageUrl: imageUrl.substring(0, 100)
    });

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    const dataUrl = `data:${contentType};base64,${base64}`;

    logger.info('[Images] Image converted to data URL', {
      originalUrl: imageUrl.substring(0, 100),
      contentType,
      sizeBytes: buffer.length,
      dataUrlLength: dataUrl.length
    });

    return dataUrl;
  } catch (error) {
    logger.error('[Images] Failed to convert image URL to data URL', {
      imageUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    try {
      const fallbackUpload = await ImgboxService.uploadFromUrl(imageUrl, { nsfw: true });
      if (fallbackUpload.success && fallbackUpload.url) {
        logger.info('[Images] Imgbox fallback succeeded for caption workflow', {
          originalUrl: imageUrl.substring(0, 100),
          fallbackUrl: fallbackUpload.url,
        });
        return fallbackUpload.url;
      }

      logger.warn('[Images] Imgbox fallback did not provide a URL', {
        originalUrl: imageUrl.substring(0, 100),
        error: fallbackUpload.error,
        status: fallbackUpload.status,
      });
    } catch (fallbackError) {
      logger.error('[Images] Imgbox fallback failed for caption workflow', {
        imageUrl,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }

    // Return original URL as final fallback
    return imageUrl;
  }
}

/**
 * Normalizes image input to a clean data URL or HTTPS URL for OpenAI API calls
 * Fixes issues with truncated/space-containing data URLs that cause invalid_base64 errors
 */
export function toOpenAIImageUrl(input: string, fallbackMime = 'image/jpeg'): string {
  if (!input) return '';
  
  // If it's already an https URL, pass through
  if (/^https?:\/\//i.test(input)) return input;

  // If it's a data URL, strip whitespace from the base64 tail
  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) {
      // Invalid data URL format
      return '';
    }
    const head = input.substring(0, commaIndex);
    const data = input.substring(commaIndex + 1);
    // Remove all whitespace from the base64 portion
    const clean = data.replace(/\s+/g, '');
    const normalized = clean.replace(/-/g, '+').replace(/_/g, '/');
    return `${head},${normalized}`;
  }

  // If it's raw base64, wrap as a data URL
  if (/^[A-Za-z0-9+/=_-]+$/.test(input.replace(/\s+/g, ''))) {
    const cleanBase64 = input.replace(/\s+/g, '');
    const normalizedBase64 = cleanBase64.replace(/-/g, '+').replace(/_/g, '/');
    return `data:${fallbackMime};base64,${normalizedBase64}`;
  }

  // Anything else: return as-is (lets you spot bad inputs in logs)
  return input;
}

/**
 * Validates that a base64 string or data URL has sufficient length
 * @param input The image URL or data URL to validate
 * @param minLength Minimum length of base64 content (default 100 chars)
 */
export function validateImageUrl(input: string, minLength = 100): boolean {
  if (!input) return false;
  
  // HTTPS URLs are always valid
  if (/^https?:\/\//i.test(input)) return true;
  
  // Extract base64 content from data URL
  let base64Content = input;
  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) return false;
    base64Content = input.substring(commaIndex + 1);
  }
  
  // Remove whitespace and check length
  const cleanBase64 = base64Content.replace(/\s+/g, '');
  return cleanBase64.length >= minLength;
}

/**
 * Logs image info for debugging while keeping sensitive data safe
 * @param imageUrl The image URL to log
 * @param requestId Optional request ID for tracking
 */
export function logImageInfo(imageUrl: string, requestId?: string): void {
  const prefix = requestId ? `[${requestId}] ` : '';

  if (!imageUrl) {
    logger.error(`${prefix}Image URL is empty`);
    return;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    const protocol = imageUrl.startsWith('https:') ? 'https' : 'http';
    logger.error(`${prefix}Using remote image URL (protocol: ${protocol}, length: ${imageUrl.length})`);
    return;
  }

  if (imageUrl.startsWith('data:')) {
    const commaIndex = imageUrl.indexOf(',');
    if (commaIndex !== -1) {
      const header = imageUrl.substring(0, commaIndex);
      const mimeMatch = header.match(/^data:([^;]+)/i);
      const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
      const base64Length = imageUrl.length - (commaIndex + 1);
      const approxBytes = Math.floor((base64Length * 3) / 4);
      logger.error(
        `${prefix}Using data URL (mime: ${mimeType}, approxBytes: ${approxBytes})`
      );
    } else {
      logger.error(`${prefix}Malformed data URL header`);
    }
    return;
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(imageUrl)) {
    logger.error(`${prefix}Received raw base64 payload (length: ${imageUrl.length})`);
    return;
  }

  logger.error(`${prefix}Unrecognized image input (length: ${imageUrl.length})`);
}