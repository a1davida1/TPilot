/**
 * Simplified Imgbox upload - single request approach
 * Since Imgbox's 2-step process is complex, let's try the simpler approach
 */

import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface SimpleImgboxResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

export class SimpleImgbox {
  /**
   * Direct upload to Imgbox - simplified approach
   */
  static async upload(buffer: Buffer, filename: string = 'image.jpg'): Promise<SimpleImgboxResult> {
    try {
      // Get token first
      const tokenResponse = await fetch('https://imgbox.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const html = await tokenResponse.text();
      const tokenMatch = html.match(/<meta\s+content="([^"]+)"\s+name="csrf-token"/);
      
      if (!tokenMatch) {
        return { success: false, error: 'Could not get Imgbox token' };
      }
      
      const token = tokenMatch[1];
      const cookies = tokenResponse.headers.get('set-cookie') || '';
      
      // Single upload request with all fields
      const form = new FormData();
      form.append('utf8', '✓');
      form.append('authenticity_token', token);
      form.append('files[]', buffer, {
        filename,
        contentType: 'image/jpeg',
      });
      // Add settings inline
      form.append('content_type', 'family'); // Safe content
      form.append('thumbnail_size', '100c');
      form.append('comments_enabled', 'false');
      form.append('gallery', 'false');
      
      const response = await fetch('https://imgbox.com/upload/process', {
        method: 'POST',
        body: form as any,
        headers: {
          ...form.getHeaders(),
          'Cookie': cookies,
          'Origin': 'https://imgbox.com',
          'Referer': 'https://imgbox.com/',
        },
      });
      
      const result = await response.text();
      
      // Parse HTML for URLs
      const fullImageMatch = result.match(/https:\/\/images\d*\.imgbox\.com\/[a-f0-9]+\/[a-f0-9]+\/[^'"<>\s]+_o\.[a-z]+/i);
      const thumbMatch = result.match(/https:\/\/thumbs\d*\.imgbox\.com\/[a-f0-9]+\/[a-f0-9]+\/[^'"<>\s]+_t\.[a-z]+/i);
      
      if (fullImageMatch) {
        return {
          success: true,
          url: fullImageMatch[0],
          thumbnailUrl: thumbMatch ? thumbMatch[0] : fullImageMatch[0],
        };
      }
      
      // Check for errors
      if (result.includes('error') || result.includes('failed')) {
        return { success: false, error: 'Imgbox upload failed' };
      }
      
      return { success: false, error: 'Could not parse Imgbox response' };
      
    } catch (error) {
      logger.error('Simple Imgbox upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }
}

export default SimpleImgbox;
