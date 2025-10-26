import { setTimeout as delay } from 'node:timers/promises';
import FormData from 'form-data';

import { logger } from '../bootstrap/logger.js';

interface ImgboxUploadOptions {
  buffer: Buffer;
  filename?: string;
  contentType?: string;
  nsfw?: boolean;
  expirationDays?: number;
}

interface ImgboxUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  deleteUrl?: string;
  id?: string;
  error?: string;
  status?: number;
}

interface ImgboxToken {
  token: string;
  cookies: string;
  expiresAt: number;
}

interface ImgboxApiResponse {
  success: boolean;
  error?: string;
  files?: Array<{
    id: string;
    title: string;
    original_url: string;
    thumbnail_url: string;
    delete_url?: string;
  }>;
}

const IMGBOX_BASE_URL = 'https://imgbox.com';
const IMGBOX_UPLOAD_URL = 'https://imgbox.com/upload/process';  // Updated endpoint
const IMGBOX_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const IMGBOX_ACCEPT = 'application/json, text/javascript, */*;q=0.01';
const TOKEN_TTL_MS = 5 * 60 * 1000; // Cache token for 5 minutes
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024; // 32MB practical limit for Imgbox

function joinSetCookie(headers: Headers): string {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) {
    return '';
  }

  const cookies = setCookie
    .split(/,(?=[^;]+?=)/u)
    .map(cookie => cookie.split(';', 1)[0]?.trim())
    .filter(Boolean);

  return cookies.join('; ');
}

function sanitizeFilename(filename: string | undefined): string {
  if (!filename) {
    return `upload-${Date.now()}.jpg`;
  }

  const normalized = filename.replace(/[^A-Za-z0-9_.-]+/gu, '-');
  return normalized.length > 0 ? normalized.slice(-128) : `upload-${Date.now()}.jpg`;
}

function isLikelyJson(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return /json|javascript|text\/plain/i.test(contentType);
}

export class ImgboxService {
  private static tokenCache: ImgboxToken | null = null;

  private static async fetchToken(): Promise<ImgboxToken> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache;
    }

    logger.debug('Fetching Imgbox upload token');
    const response = await fetch(IMGBOX_BASE_URL, {
      method: 'GET',
      headers: {
        'User-Agent': IMGBOX_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Imgbox token request failed with status ${response.status}`);
    }

    const html = await response.text();
    
    // Try multiple token patterns (Imgbox changed to use meta tag)
    const tokenPatterns = [
      // Current pattern (October 2025) - meta tag
      /<meta\s+content="([^"]+)"\s+name="csrf-token"/u,
      /<meta\s+name="csrf-token"\s+content="([^"]+)"/u,
      
      // Legacy patterns (keeping for fallback)
      /var\s+token\s*=\s*'([^']+)'/u,
      /var\s+token\s*=\s*"([^"]+)"/u,
      /authenticity_token['"]\s+type="hidden"\s+value="([^"]+)"/u,
    ];
    
    let tokenMatch = null;
    for (const pattern of tokenPatterns) {
      tokenMatch = html.match(pattern);
      if (tokenMatch) {
        logger.debug(`Found Imgbox token with pattern: ${pattern.source}`);
        break;
      }
    }
    
    if (!tokenMatch) {
      // Log first 500 chars of HTML for debugging
      logger.error('Imgbox token not found. HTML preview:', {
        htmlPreview: html.substring(0, 500),
        htmlLength: html.length,
      });
      throw new Error('Imgbox token not found in response - HTML structure may have changed');
    }

    const token = tokenMatch[1];
    const cookies = joinSetCookie(response.headers);

    if (!cookies) {
      logger.warn('Imgbox token response did not include cookies');
    }

    const expiresAt = Date.now() + TOKEN_TTL_MS;
    this.tokenCache = { token, cookies, expiresAt };
    return this.tokenCache;
  }

  private static prepareRequest(form: FormData): { body: Buffer; headers: Record<string, string> } {
    const boundary = form.getBoundary();
    const buffer = form.getBuffer();
    return {
      body: buffer,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(buffer.length),
        'Accept': 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': IMGBOX_BASE_URL,
        'Referer': `${IMGBOX_BASE_URL}/`,
      },
    };
  }

  private static calculateRetryDelay(attempt: number): number {
    return RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  }

  private static async postWithRetry(
    url: string,
    body: Buffer,
    headers: Record<string, string>,
    cookies: string,
    attempt = 1,
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: body as any, // FormData type issue with node-fetch
        headers: {
          ...headers,
          Cookie: cookies,
        },
      });

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const delayMs = this.calculateRetryDelay(attempt);
        logger.warn('Imgbox upload transient failure, retrying', {
          status: response.status,
          attempt,
          delayMs,
        });
        await delay(delayMs);
        return this.postWithRetry(url, body, headers, cookies, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delayMs = this.calculateRetryDelay(attempt);
        logger.warn('Imgbox upload network error, retrying', {
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
        await delay(delayMs);
        return this.postWithRetry(url, body, headers, cookies, attempt + 1);
      }

      throw error;
    }
  }

  private static parseResponse(response: Response, payload: string): ImgboxUploadResult {
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      if (isLikelyJson(contentType)) {
        try {
          const parsed = JSON.parse(payload) as ImgboxApiResponse;
          const error = parsed.error || 'Imgbox upload failed';
          return { success: false, error, status: response.status };
        } catch {
          // fallthrough
        }
      }
      return {
        success: false,
        error: `Imgbox upload failed with status ${response.status}`,
        status: response.status,
      };
    }

    // First check if it's HTML (common when form submission fails)
    if (payload.includes('<!DOCTYPE') || payload.includes('<html')) {
      logger.error('Imgbox returned HTML instead of JSON', {
        htmlPreview: payload.substring(0, 500),
      });
      
      // Try to extract image URL from HTML if upload succeeded
      const urlMatch = payload.match(/https:\/\/images\.imgbox\.com\/[^'"<>\s]+/);
      const thumbMatch = payload.match(/https:\/\/thumbs\.imgbox\.com\/[^'"<>\s]+/);
      
      if (urlMatch) {
        logger.info('Found Imgbox URL in HTML response', { url: urlMatch[0] });
        return {
          success: true,
          url: urlMatch[0],
          thumbnailUrl: thumbMatch ? thumbMatch[0] : urlMatch[0],
        };
      }
      
      return {
        success: false,
        error: 'Imgbox returned HTML without image URLs',
        status: response.status,
      };
    }

    let parsed: ImgboxApiResponse;
    try {
      parsed = JSON.parse(payload) as ImgboxApiResponse;
    } catch (error) {
      logger.error('Imgbox upload returned invalid JSON', {
        error: error instanceof Error ? error.message : String(error),
        payloadPreview: payload.substring(0, 200),
      });
      return {
        success: false,
        error: 'Imgbox upload response was not valid JSON',
        status: response.status,
      };
    }

    if (!parsed.success || !parsed.files || parsed.files.length === 0) {
      logger.warn('Imgbox response missing expected data', {
        hasSuccess: 'success' in parsed,
        successValue: parsed.success,
        hasFiles: 'files' in parsed,
        filesLength: parsed.files?.length,
        responseKeys: Object.keys(parsed),
      });
      return {
        success: false,
        error: parsed.error || 'Imgbox upload failed without file data',
        status: response.status,
      };
    }

    const file = parsed.files[0];
    return {
      success: true,
      url: file.original_url,
      thumbnailUrl: file.thumbnail_url,
      deleteUrl: file.delete_url,
      id: file.id,
    };
  }

  static async upload(options: ImgboxUploadOptions): Promise<ImgboxUploadResult> {
    if (!options.buffer || options.buffer.length === 0) {
      return {
        success: false,
        error: 'No file provided for Imgbox upload',
      };
    }

    if (options.buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: 'File exceeds Imgbox 32MB limit',
      };
    }

    const filename = options.filename ?? 'image.jpg';

    try {
      const token = await this.fetchToken();
      const form = new FormData();
      
      // Imgbox Rails form fields (as of October 2025)
      form.append('utf8', '✓'); // Required by Rails
      form.append('authenticity_token', token.token);
      form.append('files[]', options.buffer, {
        filename,
        contentType: options.contentType ?? 'image/jpeg',
      });
      // Optional: Add gallery title if needed
      // form.append('gallery-title', '');

      const { body, headers } = this.prepareRequest(form);
      const response = await this.postWithRetry(IMGBOX_UPLOAD_URL, body, headers, token.cookies);
      const payload = await response.text();

      const result = this.parseResponse(response, payload);
      if (result.success) {
        logger.info('Imgbox upload successful', {
          filename,
          size: options.buffer.length,
          url: result.url,
        });
      } else {
        logger.warn('Imgbox upload failed', {
          filename,
          error: result.error,
          status: result.status,
        });
      }

      return result;
    } catch (error) {
      logger.error('Imgbox upload encountered an error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Imgbox error',
      };
    }
  }

  static async uploadFromUrl(imageUrl: string, options: Omit<ImgboxUploadOptions, 'buffer'> = {}): Promise<ImgboxUploadResult> {
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': IMGBOX_USER_AGENT,
          Accept: 'image/*',
          Referer: new URL(imageUrl).origin,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download image for Imgbox upload: HTTP ${response.status}`,
          status: response.status,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const inferredFilename = options.filename ?? imageUrl.split('/').pop() ?? `image-${Date.now()}.jpg`;

      return this.upload({
        buffer,
        filename: inferredFilename,
        contentType,
        nsfw: options.nsfw,
        expirationDays: options.expirationDays,
      });
    } catch (error) {
      logger.error('Failed to fetch image for Imgbox upload', {
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch image for Imgbox upload',
      };
    }
  }
}
