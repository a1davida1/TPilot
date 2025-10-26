/**
 * PostImages Service - Anonymous image hosting without API key
 * 
 * PostImages.org allows anonymous uploads without registration
 * Perfect for legal compliance - not "our" storage
 */

import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';

interface PostImagesUploadOptions {
  buffer: Buffer;
  filename?: string;
  contentType?: string;
  adult?: boolean;
  expiration?: 'never' | '1-day' | '1-week' | '1-month';
}

interface PostImagesUploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  deleteUrl?: string;
  error?: string;
}

const POSTIMAGES_UPLOAD_URL = 'https://postimages.org/json/rr';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024; // 24MB limit for PostImages

export class PostImagesService {
  /**
   * Upload image to PostImages anonymously
   */
  static async upload(options: PostImagesUploadOptions): Promise<PostImagesUploadResult> {
    if (!options.buffer || options.buffer.length === 0) {
      return {
        success: false,
        error: 'No file provided for PostImages upload',
      };
    }

    if (options.buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: 'File exceeds PostImages 24MB limit',
      };
    }

    const filename = options.filename ?? 'image.jpg';

    try {
      logger.debug('Uploading to PostImages', { 
        filename, 
        size: options.buffer.length,
        adult: options.adult 
      });

      // Create form data
      const form = new FormData();
      
      // Add the image file
      form.append('upload', options.buffer, {
        filename,
        contentType: options.contentType ?? 'image/jpeg',
      });
      
      // PostImages specific fields
      form.append('numfiles', '1');
      form.append('optsize', '0'); // 0 = don't resize
      form.append('expire', '0'); // 0 = never expire
      
      // Adult content flag
      if (options.adult) {
        form.append('adult', '1');
      }
      
      // Gallery options
      form.append('gallery', '');
      form.append('ui', '');
      form.append('session', '');

      // Make the request
      const response = await fetch(POSTIMAGES_UPLOAD_URL, {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Origin': 'https://postimages.org',
          'Referer': 'https://postimages.org/',
        },
      });

      if (!response.ok) {
        throw new Error(`PostImages upload failed with status ${response.status}`);
      }

      const text = await response.text();
      logger.debug('PostImages response:', { text: text.substring(0, 500) });

      // PostImages returns JSONP, we need to extract the JSON
      // Format: rr({ ... json ... })
      const jsonMatch = text.match(/rr\((.*)\)/s);
      if (!jsonMatch) {
        throw new Error('Invalid response format from PostImages');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      // Check for success
      if (data.status === 'OK' && data.url) {
        logger.info('PostImages upload successful', {
          filename,
          size: options.buffer.length,
          url: data.url,
        });

        return {
          success: true,
          url: data.url,
          thumbnailUrl: data.thumb_url || data.url,
          deleteUrl: data.delete_url,
        };
      }

      // Handle error response
      const errorMsg = data.error || data.message || 'Unknown error';
      logger.warn('PostImages upload failed', {
        filename,
        error: errorMsg,
        response: data,
      });

      return {
        success: false,
        error: `PostImages upload failed: ${errorMsg}`,
      };
      
    } catch (error) {
      logger.error('PostImages upload encountered an error', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PostImages upload failed',
      };
    }
  }

  /**
   * Alternative upload using their web form (more reliable but slower)
   */
  static async uploadViaWebForm(options: PostImagesUploadOptions): Promise<PostImagesUploadResult> {
    if (!options.buffer || options.buffer.length === 0) {
      return {
        success: false,
        error: 'No file provided for PostImages upload',
      };
    }

    const filename = options.filename ?? 'image.jpg';

    try {
      logger.debug('Uploading to PostImages via web form', { 
        filename, 
        size: options.buffer.length 
      });

      // First, get the upload page to extract session info
      const pageResponse = await fetch('https://postimages.org/', {
        headers: {
          'User-Agent': USER_AGENT,
        },
      });

      const pageHtml = await pageResponse.text();
      
      // Extract session token if needed
      const sessionMatch = pageHtml.match(/name="session"\s+value="([^"]+)"/);
      const session = sessionMatch ? sessionMatch[1] : '';
      
      // Extract UI token
      const uiMatch = pageHtml.match(/name="ui"\s+value="([^"]+)"/);
      const ui = uiMatch ? uiMatch[1] : '';

      // Create form data for web upload
      const form = new FormData();
      form.append('upload[]', options.buffer, {
        filename,
        contentType: options.contentType ?? 'image/jpeg',
      });
      form.append('session', session);
      form.append('ui', ui);
      form.append('optsize', '0');
      form.append('expire', '0');
      form.append('numfiles', '1');
      
      if (options.adult) {
        form.append('adult', '1');
      }

      // Submit to main upload endpoint
      const uploadResponse = await fetch('https://postimages.org/', {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
          'User-Agent': USER_AGENT,
          'Origin': 'https://postimages.org',
          'Referer': 'https://postimages.org/',
        },
        redirect: 'follow',
      });

      const resultHtml = await uploadResponse.text();
      
      // Extract direct link from result page
      const directLinkMatch = resultHtml.match(/Direct link[^>]*>\s*<input[^>]*value="([^"]+)"/i);
      if (directLinkMatch) {
        const url = directLinkMatch[1];
        
        logger.info('PostImages web upload successful', {
          filename,
          size: options.buffer.length,
          url,
        });

        return {
          success: true,
          url,
          thumbnailUrl: url.replace(/\.(jpg|png|gif|webp)$/i, '_thumb.$1'),
        };
      }

      // Try to find any image URL in response
      const imgMatch = resultHtml.match(/https:\/\/i\.postimg\.cc\/[^"'\s]+/);
      if (imgMatch) {
        return {
          success: true,
          url: imgMatch[0],
          thumbnailUrl: imgMatch[0],
        };
      }

      return {
        success: false,
        error: 'Could not extract image URL from PostImages response',
      };
      
    } catch (error) {
      logger.error('PostImages web upload encountered an error', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PostImages upload failed',
      };
    }
  }
}

export default PostImagesService;
