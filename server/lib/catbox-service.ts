/**
 * Catbox Service - Server-side API integration
 * Handles authenticated operations and user hash management
 */

import { setTimeout as delay } from 'node:timers/promises';
import FormData from 'form-data';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

interface CatboxUploadOptions {
  userhash?: string;
  reqtype: 'fileupload' | 'urlupload';
  file?: Buffer;
  filename?: string;
  mimeType?: string;
  url?: string;
}

interface CatboxUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  status?: number;
}

type UploadLogMetadata = {
  reqtype: CatboxUploadOptions['reqtype'];
  hasUserhash: boolean;
  filename?: string;
  fileSize?: number | null;
  hasUrl?: boolean;
};

export class CatboxService {
  private static readonly API_URL = 'https://catbox.moe/user/api.php';
  private static readonly LITTERBOX_URL = 'https://litterbox.catbox.moe/resources/internals/api.php';
  private static readonly USER_AGENT =
    'Mozilla/5.0 (compatible; ThottoPilotBot/1.0; +https://thottopilot.com)';
  private static readonly ACCEPT_HEADER = 'text/plain, */*;q=0.1';
  private static readonly MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_BASE_DELAY_MS = 250;

  private static prepareRequestPayload(formData: FormData): { body: Buffer; headers: Record<string, string> } {
    const body = formData.getBuffer();
    const headerEntries = Object.entries(formData.getHeaders() as Record<string, string | number>);
    const headers: Record<string, string> = Object.fromEntries(
      headerEntries.map(([key, value]) => [key, String(value)])
    );

    headers['User-Agent'] = this.USER_AGENT;
    headers['Accept'] = this.ACCEPT_HEADER;
    headers['Connection'] = 'keep-alive';

    if (!headers['Content-Length']) {
      headers['Content-Length'] = body.length.toString();
    }

    return { body, headers };
  }

  private static validateUploadOptions(
    options: CatboxUploadOptions,
    sanitizedUserhash?: string
  ): string | null {
    if (options.reqtype !== 'fileupload' && options.reqtype !== 'urlupload') {
      return 'Unsupported Catbox request type';
    }

    if (sanitizedUserhash && !/^[A-Za-z0-9]{16,64}$/u.test(sanitizedUserhash)) {
      return 'Invalid Catbox user hash format';
    }

    if (options.reqtype === 'fileupload') {
      if (!options.file || options.file.length === 0) {
        return 'No file provided for Catbox upload';
      }

      if (options.file.length > this.MAX_UPLOAD_SIZE_BYTES) {
        return 'File exceeds Catbox 200MB limit';
      }

      if (options.filename && options.filename.length > 255) {
        return 'Filename exceeds 255 character limit';
      }
    }

    if (options.reqtype === 'urlupload') {
      if (!options.url) {
        return 'No URL provided for Catbox upload';
      }

      try {
        const parsed = new URL(options.url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return 'Catbox only accepts HTTP(S) URLs';
        }
      } catch {
        return 'Invalid URL provided for Catbox upload';
      }
    }

    return null;
  }

  private static calculateRetryDelay(attempt: number): number {
    return this.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  }

  private static shouldRetryResponse(response: Awaited<ReturnType<typeof fetch>>): boolean {
    return response.status >= 500 || response.status === 429;
  }

  private static async postWithRetry(
    url: string,
    body: Buffer,
    headers: Record<string, string>,
    metadata: UploadLogMetadata,
    attempt = 1
  ): Promise<Awaited<ReturnType<typeof fetch>>> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        headers
      });

      if (this.shouldRetryResponse(response) && attempt < this.MAX_RETRIES) {
        const delayMs = this.calculateRetryDelay(attempt);
        logger.warn('Catbox upload transient response, retrying', {
          url,
          attempt,
          delayMs,
          status: response.status,
          ...metadata
        });

        await delay(delayMs);
        return this.postWithRetry(url, body, headers, metadata, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        const delayMs = this.calculateRetryDelay(attempt);
        logger.warn('Catbox upload request failed, retrying', {
          url,
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
          ...metadata
        });

        await delay(delayMs);
        return this.postWithRetry(url, body, headers, metadata, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Get user's Catbox hash from database
   */
  static async getUserHash(userId: number): Promise<string | null> {
    try {
      const [user] = await db
        .select({ catboxUserhash: users.catboxUserhash })
        .from(users)
        .where(eq(users.id, userId));
      
      return user?.catboxUserhash || null;
    } catch (error) {
      logger.error('Failed to get user Catbox hash', { userId, error });
      return null;
    }
  }

  /**
   * Save user's Catbox hash
   */
  static async saveUserHash(userId: number, userhash: string): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({ catboxUserhash: userhash })
        .where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      logger.error('Failed to save user Catbox hash', { userId, error });
      return false;
    }
  }

  /**
   * Upload file to Catbox with optional authentication
   */
  static async upload(options: CatboxUploadOptions): Promise<CatboxUploadResult> {
    const sanitizedUserhash = options.userhash?.trim();
    const metadata: UploadLogMetadata = {
      reqtype: options.reqtype,
      hasUserhash: Boolean(sanitizedUserhash),
      filename: options.filename,
      fileSize: options.file?.length ?? null,
      hasUrl: Boolean(options.url)
    };

    const validationError = this.validateUploadOptions(options, sanitizedUserhash);
    if (validationError) {
      logger.warn('Catbox upload validation failed', {
        reason: validationError,
        ...metadata
      });

      return { success: false, error: validationError, status: 400 };
    }

    try {
      const formData = new FormData();
      formData.append('reqtype', options.reqtype);

      if (sanitizedUserhash) {
        formData.append('userhash', sanitizedUserhash);
      }

      if (options.reqtype === 'fileupload' && options.file) {
        const fileOptions: FormData.AppendOptions = {
          filename: options.filename || 'upload.bin',
          contentType: options.mimeType || 'application/octet-stream'
        };
        formData.append('fileToUpload', options.file, fileOptions);
      } else if (options.reqtype === 'urlupload' && options.url) {
        formData.append('url', options.url);
      } else {
        return { success: false, error: 'Invalid upload parameters', status: 400 };
      }

      const { body, headers } = this.prepareRequestPayload(formData);
      let response = await this.postWithRetry(this.API_URL, body, headers, metadata);

      // If Catbox returns 412 (Precondition Failed), try Litterbox as fallback
      if (response.status === 412 && options.reqtype === 'fileupload' && options.file) {
        logger.warn('Catbox returned 412, attempting Litterbox fallback', {
          ...metadata
        });

        const litterboxForm = new FormData();
        litterboxForm.append('reqtype', 'fileupload');
        litterboxForm.append('time', '1h');
        litterboxForm.append('fileToUpload', options.file, {
          filename: options.filename || 'upload.jpg'
        });

        const litterboxPayload = this.prepareRequestPayload(litterboxForm);
        response = await this.postWithRetry(
          this.LITTERBOX_URL,
          litterboxPayload.body,
          litterboxPayload.headers,
          metadata
        );
      }

      const rawText = await response.text();
      const responseText = rawText.trim();
      const normalizedResponse = responseText.toLowerCase();
      const isErrorResponse = normalizedResponse.includes('error');

      // Check for errors
      if (!response.ok || isErrorResponse) {
        const inferredStatus = normalizedResponse.includes('userhash') || normalizedResponse.includes('precondition')
          ? 412
          : normalizedResponse.includes('limit')
            ? 429
            : 400;
        const statusCode = response.ok ? inferredStatus : response.status;
        const truncatedResponse = responseText.length > 500 ? `${responseText.slice(0, 500)}…` : responseText;

        logger.error('Catbox upload failed', {
          status: statusCode,
          upstreamStatus: response.status,
          responseSnippet: truncatedResponse,
          ...metadata
        });

        const preconditionMessage = sanitizedUserhash
          ? 'Catbox rejected the upload. Please verify your Catbox user hash.'
          : 'Catbox rejected the upload because a Catbox user hash is required.';

        const errorMessage = statusCode === 412
          ? truncatedResponse || preconditionMessage
          : truncatedResponse || `Upload failed: ${response.statusText}`;

        return {
          success: false,
          error: errorMessage,
          status: statusCode
        };
      }

      // Validate response is a URL
      const url = responseText;
      if (!/^https?:\/\//u.test(url)) {
        logger.error('Catbox upload returned invalid URL', {
          responseSnippet: url.slice(0, 200),
          ...metadata
        });
        return {
          success: false,
          error: 'Catbox returned an invalid response',
          status: 502
        };
      }

      logger.info('Catbox upload successful', {
        url,
        ...metadata
      });

      return { success: true, url };

    } catch (error) {
      logger.error('Catbox upload error', {
        error: error instanceof Error ? error.message : error,
        ...metadata
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        status: 500
      };
    }
  }

  /**
   * Delete files from Catbox (requires authentication)
   */
  static async deleteFiles(userhash: string, files: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const formData = new FormData();
      
      formData.append('reqtype', 'deletefiles');
      formData.append('userhash', userhash.trim());
      formData.append('files', files.join(' '));

      const { body, headers } = this.prepareRequestPayload(formData);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body,
        headers
      });

      const text = await response.text();

      if (!response.ok || text.toLowerCase().includes('error')) {
        return { success: false, error: text || 'Delete failed' };
      }

      return { success: true };
      
    } catch (error) {
      logger.error('Catbox delete error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * Create album on Catbox
   */
  static async createAlbum(
    userhash: string | null,
    title: string,
    description: string,
    files: string[]
  ): Promise<{ success: boolean; url?: string; short?: string; error?: string }> {
    try {
      const formData = new FormData();
      
      formData.append('reqtype', 'createalbum');
      if (userhash) {
        formData.append('userhash', userhash.trim());
      }
      formData.append('title', title);
      formData.append('desc', description);
      formData.append('files', files.join(' '));

      const { body, headers } = this.prepareRequestPayload(formData);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body,
        headers
      });

      const text = await response.text();

      if (!response.ok || text.toLowerCase().includes('error')) {
        return { success: false, error: text || 'Album creation failed' };
      }

      // Extract short code from URL
      const match = text.match(/\/c\/([a-zA-Z0-9]{6})/);
      const short = match ? match[1] : undefined;

      return { success: true, url: text.trim(), short };
      
    } catch (error) {
      logger.error('Catbox album creation error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Album creation failed'
      };
    }
  }
}
