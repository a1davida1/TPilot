/**
 * Catbox Service - Server-side API integration
 * Handles authenticated operations and user hash management
 */

import { db } from '../db.js';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

interface CatboxUploadOptions {
  userhash?: string;
  reqtype: 'fileupload' | 'urlupload';
  file?: Buffer;
  filename?: string;
  url?: string;
}

export class CatboxService {
  private static readonly API_URL = 'https://catbox.moe/user/api.php';

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
  static async upload(options: CatboxUploadOptions): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('reqtype', options.reqtype);
      
      // Add userhash if available
      if (options.userhash) {
        formData.append('userhash', options.userhash);
      }
      
      // Add file or URL based on request type
      if (options.reqtype === 'fileupload' && options.file) {
        formData.append('fileToUpload', options.file, {
          filename: options.filename || 'upload.jpg'
        });
      } else if (options.reqtype === 'urlupload' && options.url) {
        formData.append('url', options.url);
      } else {
        return { success: false, error: 'Invalid upload parameters' };
      }

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
        headers: formData.getHeaders()
      });

      const text = await response.text();

      // Check for errors
      if (!response.ok || text.toLowerCase().includes('error')) {
        logger.error('Catbox upload failed', { 
          status: response.status,
          response: text 
        });
        return { 
          success: false, 
          error: text || `Upload failed: ${response.statusText}` 
        };
      }

      // Success - URL returned as plain text
      const url = text.trim();
      logger.info('Catbox upload successful', { url });
      
      return { success: true, url };
      
    } catch (error) {
      logger.error('Catbox upload error', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Delete files from Catbox (requires authentication)
   */
  static async deleteFiles(userhash: string, files: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('reqtype', 'deletefiles');
      formData.append('userhash', userhash);
      formData.append('files', files.join(' '));

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
        headers: formData.getHeaders()
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
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('reqtype', 'createalbum');
      if (userhash) {
        formData.append('userhash', userhash);
      }
      formData.append('title', title);
      formData.append('desc', description);
      formData.append('files', files.join(' '));

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
        headers: formData.getHeaders()
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
