import FormData from 'form-data';
import fetch from 'node-fetch';
import { logger } from '../bootstrap/logger.js';

interface ImgurUploadResult {
  link: string;
  deleteHash: string;
  width: number;
  height: number;
}

interface ImgurResponse {
  success: boolean;
  status: number;
  data?: {
    link: string;
    deletehash: string;
    width: number;
    height: number;
    error?: string;
  };
}

// Track daily usage for rate limiting awareness
const dailyUsage = new Map<string, { count: number; resetAt: number }>();

function getDailyUsageKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `imgur-uploads-${today}`;
}

function incrementUsage(): number {
  const key = getDailyUsageKey();
  const now = Date.now();
  const existing = dailyUsage.get(key);
  
  if (!existing || now > existing.resetAt) {
    // Reset daily counter at midnight UTC
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    dailyUsage.set(key, { count: 1, resetAt: tomorrow.getTime() });
    return 1;
  }
  
  existing.count++;
  return existing.count;
}

export async function uploadAnonymousToImgur(
  buffer: Buffer, 
  filename: string,
  markMature = true
): Promise<ImgurUploadResult> {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) {
    throw new Error('IMGUR_CLIENT_ID not configured');
  }

  const currentUsage = incrementUsage();
  const rateWarnThreshold = parseInt(process.env.IMGUR_RATE_WARN_THRESHOLD || '1000', 10);
  
  if (currentUsage > rateWarnThreshold) {
    logger.warn('Approaching Imgur daily rate limit', { usage: currentUsage, threshold: rateWarnThreshold });
  }

  const form = new FormData();
  form.append('image', buffer, filename);
  form.append('type', 'file');
  form.append('title', filename);
  form.append('disable_audio', 'true');
  
  if (markMature) {
    form.append('mature', 'true'); // Reduce moderation flags for NSFW content
  }

  try {
    const res = await fetch('https://api.imgur.com/3/upload', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`
      },
      body: form
    });

    const payload = await res.json() as ImgurResponse;

    if (!res.ok || !payload?.data?.link) {
      const error = payload?.data?.error || `Upload failed with status ${res.status}`;
      
      // Check for rate limiting
      if (res.status === 429) {
        throw new Error('Imgur rate limit exceeded. Please paste a direct URL instead or try again later.');
      }
      
      throw new Error(error);
    }

    logger.info('Imgur upload successful', {
      link: payload.data.link,
      size: buffer.length,
      usage: currentUsage
    });

    return {
      link: payload.data.link,
      deleteHash: payload.data.deletehash,
      width: payload.data.width,
      height: payload.data.height
    };
  } catch (error) {
    logger.error('Imgur upload failed', { error, filename });
    throw error;
  }
}

export async function uploadAuthorizedToImgur(
  buffer: Buffer,
  filename: string,
  accessToken: string,
  albumId?: string
): Promise<ImgurUploadResult> {
  const form = new FormData();
  form.append('image', buffer, filename);
  form.append('type', 'file');
  form.append('title', filename);
  
  if (albumId) {
    form.append('album', albumId);
  }

  try {
    const res = await fetch('https://api.imgur.com/3/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    });

    const payload = await res.json() as ImgurResponse;

    if (!res.ok || !payload?.data?.link) {
      throw new Error(payload?.data?.error || 'Authorized upload failed');
    }

    return {
      link: payload.data.link,
      deleteHash: payload.data.deletehash,
      width: payload.data.width,
      height: payload.data.height
    };
  } catch (error) {
    logger.error('Imgur authorized upload failed', { error, filename });
    throw error;
  }
}

export async function deleteFromImgur(deleteHash: string): Promise<boolean> {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) {
    throw new Error('IMGUR_CLIENT_ID not configured');
  }

  try {
    const res = await fetch(`https://api.imgur.com/3/image/${deleteHash}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Client-ID ${clientId}`
      }
    });

    const payload = await res.json() as ImgurResponse;
    
    if (res.ok && payload.success) {
      logger.info('Imgur image deleted', { deleteHash });
      return true;
    }
    
    logger.warn('Imgur delete failed', { deleteHash, status: res.status });
    return false;
  } catch (error) {
    logger.error('Imgur delete request failed', { error, deleteHash });
    return false;
  }
}

export function getDailyUsageStats() {
  const key = getDailyUsageKey();
  const stats = dailyUsage.get(key);
  const limit = 1250; // Approximate Imgur anonymous daily limit
  
  return {
    used: stats?.count || 0,
    limit,
    remaining: Math.max(0, limit - (stats?.count || 0)),
    resetAt: stats?.resetAt || Date.now()
  };
}
