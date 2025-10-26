/**
 * Direct upload to services that actually work
 * Using the simplest possible approach
 */

import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface DirectUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  service?: string;
}

export class DirectUpload {
  /**
   * Upload to Imgur anonymously (no account needed)
   */
  static async uploadToImgur(buffer: Buffer, filename?: string): Promise<DirectUploadResult> {
    try {
      const form = new FormData();
      form.append('image', buffer.toString('base64'));
      form.append('type', 'base64');
      
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Client-ID 546c25a59c58ad7', // Public Imgur client ID for anonymous uploads
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('json')) {
        const text = await response.text();
        logger.error('Imgur returned non-JSON:', { 
          status: response.status,
          contentType, 
          preview: text.substring(0, 200) 
        });
        return {
          success: false,
          error: `Imgur returned ${contentType}: ${text.substring(0, 100)}`,
          service: 'imgur',
        };
      }

      const data = await response.json() as any;
      
      if (data.success && data.data) {
        logger.info('Imgur upload successful', { url: data.data.link });
        return {
          success: true,
          url: data.data.link,
          thumbnailUrl: data.data.link.replace('.jpg', 'm.jpg')
                                     .replace('.png', 'm.png')
                                     .replace('.gif', 'm.gif'),
          service: 'imgur',
        };
      }
      
      return {
        success: false,
        error: data.data?.error || 'Imgur upload failed',
        service: 'imgur',
      };
    } catch (error) {
      logger.error('Imgur upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Imgur upload error',
        service: 'imgur',
      };
    }
  }

  /**
   * Upload to Cloudinary (free tier, no account association)
   */
  static async uploadToCloudinary(buffer: Buffer, filename?: string): Promise<DirectUploadResult> {
    try {
      const CLOUD_NAME = 'demo'; // Cloudinary demo cloud
      const UPLOAD_PRESET = 'ml_default'; // Public preset
      
      const form = new FormData();
      form.append('file', `data:image/jpeg;base64,${buffer.toString('base64')}`);
      form.append('upload_preset', UPLOAD_PRESET);
      
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders(),
      });

      const data = await response.json() as any;
      
      if (data.secure_url) {
        logger.info('Cloudinary upload successful', { url: data.secure_url });
        return {
          success: true,
          url: data.secure_url,
          thumbnailUrl: data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_thumb/'),
          service: 'cloudinary',
        };
      }
      
      return {
        success: false,
        error: data.error?.message || 'Cloudinary upload failed',
        service: 'cloudinary',
      };
    } catch (error) {
      logger.error('Cloudinary upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cloudinary upload error',
        service: 'cloudinary',
      };
    }
  }

  /**
   * Try all services until one works
   */
  static async upload(buffer: Buffer, filename?: string): Promise<DirectUploadResult> {
    // Try Imgur first (most reliable)
    const imgurResult = await this.uploadToImgur(buffer, filename);
    if (imgurResult.success) {
      return imgurResult;
    }
    logger.warn('Imgur failed, trying Cloudinary', { error: imgurResult.error });

    // Try Cloudinary
    const cloudinaryResult = await this.uploadToCloudinary(buffer, filename);
    if (cloudinaryResult.success) {
      return cloudinaryResult;
    }
    logger.warn('Cloudinary failed', { error: cloudinaryResult.error });

    return {
      success: false,
      error: 'All direct upload services failed',
    };
  }
}

export default DirectUpload;
