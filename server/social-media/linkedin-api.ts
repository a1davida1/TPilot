import fetch from 'node-fetch';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
export interface LinkedInPost {
  text: string;
  mediaUrls?: string[];
  hashtags?: string[];
}

export interface LinkedInMetrics {
  followers: number;
  engagementRate: number;
}

export class LinkedInAPI {
  constructor(private accessToken: string) {}

  async createPost(post: LinkedInPost): Promise<{ success: boolean; platform: 'linkedin'; postId?: string; error?: string }> {
    try {
      const res = await fetch('https://api.linkedin.com/v2/shares', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(post),
      });
      if (!res.ok) {
        return { success: false, platform: 'linkedin', error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, platform: 'linkedin', postId: data.id };
    } catch (error: unknown) {
      return {
        success: false,
        platform: 'linkedin',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAccountMetrics(): Promise<LinkedInMetrics> {
    try {
      const res = await fetch('https://api.linkedin.com/v2/me', {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        followers: data.followersCount ?? 0,
        engagementRate: data.engagementRate ?? 0,
      };
    } catch (error) {
      logger.error(...formatLogArgs('LinkedIn metrics error:', error));
      return { followers: 0, engagementRate: 0 };
    }
  }
}