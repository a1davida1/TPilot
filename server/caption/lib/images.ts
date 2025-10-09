/**
 * Normalizes image input to a clean data URL or HTTPS URL for OpenAI API calls
 * Fixes issues with truncated/space-containing data URLs that cause invalid_base64 errors
 */import { logger } from './../../bootstrap/logger.js';
import { formatLogArgs } from './../../lib/logger-utils.js';

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
    logger.error(...formatLogArgs(`${prefix}Image URL is empty`));
    return;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    const protocol = imageUrl.startsWith('https:') ? 'https' : 'http';
    logger.error(...formatLogArgs(`${prefix}Using remote image URL (protocol: ${protocol}, length: ${imageUrl.length}))`);
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
      logger.error(...formatLogArgs(
        `${prefix}Using data URL (mime: ${mimeType}, approxBytes: ${approxBytes}))`
      );
    } else {
      logger.error(...formatLogArgs(`${prefix}Malformed data URL header`));
    }
    return;
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(imageUrl)) {
    logger.error(...formatLogArgs(`${prefix}Received raw base64 payload (length: ${imageUrl.length}))`);
    return;
  }

  logger.error(...formatLogArgs(`${prefix}Unrecognized image input (length: ${imageUrl.length}))`);
}