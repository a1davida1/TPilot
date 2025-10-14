/**
 * Catbox Service - Server-side API integration
 * Handles authenticated operations and user hash management
 */

import FormDataNode from 'form-data';
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

export class CatboxService {
  private static readonly API_URL = 'https://catbox.moe/user/api.php';
  private static readonly USER_AGENT =
    'Mozilla/5.0 (compatible; ThottoPilotBot/1.0; +https://thottopilot.com)';
  private static readonly ACCEPT_HEADER = 'text/plain, */*;q=0.1';

  private static async buildRequestHeaders(formData: FormDataNode): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...formData.getHeaders(),
      'User-Agent': this.USER_AGENT,
      Accept: this.ACCEPT_HEADER,
      Connection: 'keep-alive'
    };

    const contentLength = await new Promise<number | null>((resolve) => {
      formData.getLength((error: Error | null, length: number) => {
        if (error) {
          logger.warn('CatboxService: unable to determine multipart length', { error });
          resolve(null);
          return;
        }

        if (Number.isFinite(length) && length > 0) {
          resolve(length);
          return;
        }

        resolve(null);
      });
    });

    if (contentLength !== null) {
      headers['Content-Length'] = contentLength.toString();
    }

    return headers;
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
  static async upload(options: CatboxUploadOptions): Promise<{ success: boolean; url?: string; error?: string; status?: number }> {
    try {
      const formData = new FormDataNode();
      
      formData.append('reqtype', options.reqtype);
      
      // Add userhash if available
      const sanitizedUserhash = options.userhash?.trim();
      if (sanitizedUserhash) {
        formData.append('userhash', sanitizedUserhash);
      }
      
      // Add file or URL based on request type
      if (options.reqtype === 'fileupload' && options.file) {
        const fileOptions: FormDataNode.AppendOptions = {
          filename: options.filename || 'upload.bin',
          contentType: options.mimeType || 'application/octet-stream'
        };
        formData.append('fileToUpload', options.file, fileOptions);
      } else if (options.reqtype === 'urlupload' && options.url) {
        formData.append('url', options.url);
      } else {
        return { success: false, error: 'Invalid upload parameters', status: 400 };
      }

      const headers = await this.buildRequestHeaders(formData);

      let response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
        headers
      });

      // If Catbox returns 412 (Precondition Failed), try Litterbox as fallback
      if (response.status === 412 && options.reqtype === 'fileupload' && options.file) {
        logger.warn('Catbox returned 412, trying Litterbox as fallback');
        
        const litterboxForm = new FormDataNode();
        litterboxForm.append('reqtype', 'fileupload');
        litterboxForm.append('time', '1h'); // 1 hour expiry
        litterboxForm.append('fileToUpload', options.file, {
          filename: options.filename || 'upload.jpg'
        });

        response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
          method: 'POST',
          body: litterboxForm as unknown as BodyInit,
          headers: {
            ...litterboxForm.getHeaders(),
            'User-Agent': 'ThottoPilot/1.0'
          }
        });
      }

      const rawText = await response.text();
      const responseText = rawText.trim();
      const normalizedResponse = responseText.toLowerCase();
      const isErrorResponse = normalizedResponse.includes('error');

      // Check for errors
      if (!response.ok || isErrorResponse) {
        const statusCode = response.ok
          ? normalizedResponse.includes('userhash') || normalizedResponse.includes('precondition')
            ? 412
            : 400
          : response.status;
        
        logger.error('Catbox upload failed', { 
          status: statusCode,
          response: responseText,
          upstreamStatus: response.status
        });
        return { 
          success: false, 
          error: responseText || `Upload failed: ${response.statusText}`,
          status: statusCode
        };
      }

      // Validate response is a URL
      const url = responseText;
      if (!/^https?:\/\//u.test(url)) {
        logger.error('Catbox upload returned invalid URL', { response: responseText });
        return {
          success: false,
          error: 'Catbox returned an invalid response',
          status: 502
        };
      }

      logger.info('Catbox upload successful', { url });
      
      return { success: true, url };
      
    } catch (error) {
      logger.error('Catbox upload error', { error });
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
      const formData = new FormDataNode();
      
      formData.append('reqtype', 'deletefiles');
      formData.append('userhash', userhash.trim());
      formData.append('files', files.join(' '));

      const headers = await this.buildRequestHeaders(formData);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
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
      const formData = new FormDataNode();
      
      formData.append('reqtype', 'createalbum');
      if (userhash) {
        formData.append('userhash', userhash.trim());
      }
      formData.append('title', title);
      formData.append('desc', description);
      formData.append('files', files.join(' '));

      const headers = await this.buildRequestHeaders(formData);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
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
