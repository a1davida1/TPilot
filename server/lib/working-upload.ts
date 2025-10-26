/**
 * WORKING upload service - using services that ACTUALLY work
 * We'll use file.io which is simple, free, and actually works
 */

import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface WorkingUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  service?: string;
}

export class WorkingUpload {
  /**
   * Upload to File.io - Simple, free, works immediately
   * Files expire after 14 days by default
   */
  static async uploadToFileIO(buffer: Buffer, filename?: string): Promise<WorkingUploadResult> {
    try {
      const form = new FormData();
      form.append('file', buffer, {
        filename: filename || 'image.jpg',
        contentType: 'application/octet-stream',
      });
      
      const response = await fetch('https://file.io', {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders(),
      });

      // Check content type first
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('json')) {
        const text = await response.text();
        logger.warn('File.io returned non-JSON:', { contentType, preview: text.substring(0, 200) });
        return {
          success: false,
          error: 'File.io returned HTML instead of JSON',
          service: 'fileio',
        };
      }

      const data = await response.json() as any;
      
      if (data.success && data.link) {
        logger.info('File.io upload successful', { url: data.link });
        return {
          success: true,
          url: data.link,
          thumbnailUrl: data.link, // No thumbnails but at least we have a URL
          service: 'fileio',
        };
      }
      
      return {
        success: false,
        error: data.message || 'File.io upload failed',
        service: 'fileio',
      };
    } catch (error) {
      logger.error('File.io upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File.io upload error',
        service: 'fileio',
      };
    }
  }

  /**
   * Upload to 0x0.st - Simple curl-based service
   */
  static async uploadTo0x0(buffer: Buffer, filename?: string): Promise<WorkingUploadResult> {
    try {
      const form = new FormData();
      form.append('file', buffer, {
        filename: filename || 'image.jpg',
        contentType: 'application/octet-stream',
      });
      
      // Add user agent to avoid being blocked as malware
      const headers = {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };
      
      const response = await fetch('https://0x0.st', {
        method: 'POST',
        body: form as any,
        headers,
      });

      const url = await response.text();
      
      // 0x0.st returns just the URL as plain text
      if (url && url.startsWith('https://')) {
        logger.info('0x0.st upload successful', { url: url.trim() });
        return {
          success: true,
          url: url.trim(),
          thumbnailUrl: url.trim(),
          service: '0x0st',
        };
      }
      
      return {
        success: false,
        error: url || '0x0.st upload failed',
        service: '0x0st',
      };
    } catch (error) {
      logger.error('0x0.st upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '0x0.st upload error',
        service: '0x0st',
      };
    }
  }

  /**
   * Upload to Uguu.se - Another simple service
   */
  static async uploadToUguu(buffer: Buffer, filename?: string): Promise<WorkingUploadResult> {
    try {
      const form = new FormData();
      form.append('files[]', buffer, {
        filename: filename || 'image.jpg',
        contentType: 'application/octet-stream',
      });
      
      const response = await fetch('https://uguu.se/upload.php', {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders(),
      });

      const data = await response.json() as any;
      
      if (data.success && data.files && data.files[0]) {
        const fileUrl = data.files[0].url;
        logger.info('Uguu upload successful', { url: fileUrl });
        return {
          success: true,
          url: fileUrl,
          thumbnailUrl: fileUrl,
          service: 'uguu',
        };
      }
      
      return {
        success: false,
        error: data.error?.message || 'Uguu upload failed',
        service: 'uguu',
      };
    } catch (error) {
      logger.error('Uguu upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Uguu upload error',
        service: 'uguu',
      };
    }
  }

  /**
   * Upload to Litterbox (Catbox's temporary service)
   * Files expire after 1 hour to 72 hours
   */
  static async uploadToLitterbox(buffer: Buffer, filename?: string): Promise<WorkingUploadResult> {
    try {
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('time', '24h'); // Keep for 24 hours
      form.append('fileToUpload', buffer, {
        filename: filename || 'image.jpg',
        contentType: 'application/octet-stream',
      });
      
      const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders(),
      });

      const url = await response.text();
      
      // Litterbox returns just the URL as plain text
      if (url && url.startsWith('https://')) {
        logger.info('Litterbox upload successful', { url: url.trim() });
        return {
          success: true,
          url: url.trim(),
          thumbnailUrl: url.trim(),
          service: 'litterbox',
        };
      }
      
      return {
        success: false,
        error: url || 'Litterbox upload failed',
        service: 'litterbox',
      };
    } catch (error) {
      logger.error('Litterbox upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Litterbox upload error',
        service: 'litterbox',
      };
    }
  }

  /**
   * Try all working services - Uguu first since it works!
   */
  static async upload(buffer: Buffer, filename?: string): Promise<WorkingUploadResult> {
    // Try Uguu FIRST - it's proven to work!
    const uguuResult = await this.uploadToUguu(buffer, filename);
    if (uguuResult.success) {
      return uguuResult;
    }
    logger.warn('Uguu failed, trying File.io', { error: uguuResult.error });

    // Try File.io as backup
    const fileioResult = await this.uploadToFileIO(buffer, filename);
    if (fileioResult.success) {
      return fileioResult;
    }
    logger.warn('File.io failed, trying 0x0.st', { error: fileioResult.error });

    // Try 0x0.st (might work from server)
    const zeroResult = await this.uploadTo0x0(buffer, filename);
    if (zeroResult.success) {
      return zeroResult;
    }
    logger.warn('0x0.st failed, trying Litterbox', { error: zeroResult.error });

    // Try Litterbox last
    const litterboxResult = await this.uploadToLitterbox(buffer, filename);
    if (litterboxResult.success) {
      return litterboxResult;
    }
    logger.warn('All working upload services failed', { 
      uguu: uguuResult.error,
      fileio: fileioResult.error,
      zero: zeroResult.error,
      litterbox: litterboxResult.error
    });

    return {
      success: false,
      error: 'All working upload services failed',
    };
  }
}

export default WorkingUpload;
