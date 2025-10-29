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

function normalizeContentType(contentType: string | undefined): string {
  if (!contentType) {
    return 'image/jpeg';
  }

  // Normalize common MIME types to what Imgbox accepts
  const normalized = contentType.toLowerCase().trim();

  // Map of accepted types
  const acceptedTypes: Record<string, string> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
    'image/bmp': 'image/bmp',
  };

  // Return normalized type or default to jpeg
  return acceptedTypes[normalized] || 'image/jpeg';
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

    // Imgbox returns HTML on success! Parse it for URLs
    if (payload.includes('<!DOCTYPE') || payload.includes('<html')) {
      logger.debug('Imgbox returned HTML response, parsing for URLs...');
      
      // Extract the full-size image URL from HTML
      // Format: https://images2.imgbox.com/XX/XX/XXXXXX_o.jpeg
      const fullImageMatch = payload.match(/https:\/\/images\d*\.imgbox\.com\/[a-f0-9]+\/[a-f0-9]+\/[^'"<>\s]+_o\.[a-z]+/i);
      
      // Extract thumbnail URL 
      // Format: https://thumbs2.imgbox.com/XX/XX/XXXXXX_t.jpeg
      const thumbMatch = payload.match(/https:\/\/thumbs\d*\.imgbox\.com\/[a-f0-9]+\/[a-f0-9]+\/[^'"<>\s]+_t\.[a-z]+/i);
      
      // Extract the main Imgbox URL
      // Format: https://imgbox.com/XXXXXXXX
      const mainUrlMatch = payload.match(/https:\/\/imgbox\.com\/[A-Za-z0-9]+/);
      
      if (fullImageMatch || mainUrlMatch) {
        const result = {
          success: true,
          url: fullImageMatch ? fullImageMatch[0] : mainUrlMatch![0],
          thumbnailUrl: thumbMatch ? thumbMatch[0] : undefined,
          mainUrl: mainUrlMatch ? mainUrlMatch[0] : undefined,
        };
        
        logger.info('Successfully extracted URLs from Imgbox HTML', result);
        return result;
      }
      
      // Check if it's an error page
      if (payload.includes('error') || payload.includes('failed')) {
        logger.error('Imgbox returned error in HTML');
        return {
          success: false,
          error: 'Imgbox upload failed (HTML error page)',
          status: response.status,
        };
      }
      
      logger.error('Could not find image URLs in Imgbox HTML', {
        htmlPreview: payload.substring(0, 1000),
      });
      
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

    // Imgbox doesn't always return a 'success' field - if we have files, it worked!
    if (parsed.files && parsed.files.length > 0) {
      // SUCCESS! We have files
      logger.debug('Imgbox has files in response', {
        filesCount: parsed.files.length,
        firstFile: parsed.files[0],
      });
    } else if (!parsed.success) {
      // No files and no success flag = failure
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

    // Handle the case where there's no files array (shouldn't happen but be safe)
    if (!parsed.files || parsed.files.length === 0) {
      return {
        success: false,
        error: 'No files in Imgbox response',
        status: response.status,
      };
    }
    
    const file = parsed.files[0];
    
    // Check if URLs are actually present and not empty
    if (!file.original_url || file.original_url === '') {
      logger.error('Imgbox file object missing URLs', {
        file: JSON.stringify(file),
        fileKeys: Object.keys(file),
      });
      
      // Try different possible field names (use 'as any' to check dynamic properties)
      const fileAny = file as any;
      const possibleUrl = fileAny.url || fileAny.image_url || fileAny.link || fileAny.direct_url;
      if (possibleUrl) {
        logger.info('Found URL in alternate field', { field: possibleUrl });
        return {
          success: true,
          url: possibleUrl,
          thumbnailUrl: fileAny.thumb_url || fileAny.thumbnail || possibleUrl,
        };
      }
      
      return {
        success: false,
        error: 'Imgbox returned file without URLs',
        status: response.status,
      };
    }
    
    return {
      success: true,
      url: file.original_url,
      thumbnailUrl: file.thumbnail_url || file.original_url,
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
      
      // STEP 1: Upload the file first
      logger.debug('Step 1: Uploading file to Imgbox...');
      const normalizedContentType = normalizeContentType(options.contentType);
      logger.debug('Normalized content type', {
        original: options.contentType,
        normalized: normalizedContentType
      });

      const fileForm = new FormData();
      fileForm.append('utf8', '✓');
      fileForm.append('authenticity_token', token.token);
      fileForm.append('files[]', options.buffer, {
        filename,
        contentType: normalizedContentType,
      });
      
      const { body: fileBody, headers: fileHeaders } = this.prepareRequest(fileForm);
      
      const fileResponse = await this.postWithRetry(
        IMGBOX_UPLOAD_URL, 
        fileBody, 
        fileHeaders, 
        token.cookies
      );
      
      const fileResult = await fileResponse.text();
      
      // Check if file upload succeeded (might return JSON with file ID)
      logger.debug('File upload response preview:', fileResult.substring(0, 500));
      
      // For now, just parse the response from step 1 as the final result
      // In reality, Imgbox might need us to submit step 2 to a different endpoint
      // But based on user's testing, the HTML response already contains the URLs
      
      logger.debug('Imgbox raw response', {
        status: fileResponse.status,
        contentType: fileResponse.headers.get('content-type'),
        contentLength: fileResponse.headers.get('content-length'),
        payloadLength: fileResult.length,
        payloadStart: fileResult.substring(0, 200),
        isHTML: fileResult.includes('<!DOCTYPE') || fileResult.includes('<html'),
        isJSON: fileResult.trim().startsWith('{') || fileResult.trim().startsWith('['),
      });

      const result = this.parseResponse(fileResponse, fileResult);
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
