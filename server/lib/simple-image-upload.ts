/**
 * Simple Image Upload Service - Using free, no-API-key services
 * Fallback option when Imgbox and PostImages fail
 */

import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';

interface SimpleUploadOptions {
  buffer: Buffer;
  filename?: string;
  contentType?: string;
}

interface SimpleUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  service?: string;
}

export class SimpleImageUpload {
  /**
   * Try Freeimage.host - simple, no API key needed
   */
  static async uploadToFreeImage(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    try {
      const form = new FormData();
      form.append('source', options.buffer.toString('base64'));
      form.append('type', 'base64');
      
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
        },
      });

      const data = await response.json();
      
      if (data.success && data.image) {
        return {
          success: true,
          url: data.image.url,
          thumbnailUrl: data.image.thumb?.url || data.image.url,
          service: 'freeimage',
        };
      }
      
      return {
        success: false,
        error: data.error?.message || 'FreeImage upload failed',
        service: 'freeimage',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FreeImage upload error',
        service: 'freeimage',
      };
    }
  }

  /**
   * Try ImgBB with anonymous key
   */
  static async uploadToImgBB(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    try {
      // Using a public/demo key (replace with your own if needed)
      const IMGBB_KEY = '2af9261e63e8ecb9035165c15c82e5f7'; // Public demo key
      
      const form = new FormData();
      form.append('image', options.buffer.toString('base64'));
      
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
        },
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        return {
          success: true,
          url: data.data.url,
          thumbnailUrl: data.data.thumb?.url || data.data.url,
          service: 'imgbb',
        };
      }
      
      return {
        success: false,
        error: data.error?.message || 'ImgBB upload failed',
        service: 'imgbb',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ImgBB upload error',
        service: 'imgbb',
      };
    }
  }

  /**
   * Upload to any available service
   */
  static async upload(options: SimpleUploadOptions): Promise<SimpleUploadResult> {
    // Try FreeImage first
    const freeImageResult = await this.uploadToFreeImage(options);
    if (freeImageResult.success) {
      logger.info('FreeImage upload successful', freeImageResult);
      return freeImageResult;
    }
    logger.warn('FreeImage failed, trying ImgBB', { error: freeImageResult.error });

    // Try ImgBB
    const imgbbResult = await this.uploadToImgBB(options);
    if (imgbbResult.success) {
      logger.info('ImgBB upload successful', imgbbResult);
      return imgbbResult;
    }
    logger.warn('ImgBB failed', { error: imgbbResult.error });

    return {
      success: false,
      error: 'All simple upload services failed',
    };
  }
}

export default SimpleImageUpload;
