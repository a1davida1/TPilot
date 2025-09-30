import { z } from "zod";

// TikTok Creator API Integration
export class TikTokAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Upload video to TikTok
  async createPost(content: {
    videoUrl: string;
    caption: string;
    hashtags?: string[];
    privacy?: 'public' | 'friends' | 'private';
  }) {
    const caption = content.hashtags 
      ? `${content.caption}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`
      : content.caption;

    try {
      // Step 1: Initialize video upload
      const initResponse = await fetch('https://open-api.tiktok.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: await this.getVideoSize(content.videoUrl),
            chunk_size: 10485760, // 10MB chunks
            total_chunk_count: 1,
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
      }

      const initData = await initResponse.json();
      const uploadUrl = initData.data.upload_url;

      // Step 2: Upload video content
      const videoResponse = await fetch(content.videoUrl);
      const videoBuffer = await videoResponse.arrayBuffer();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: videoBuffer,
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload video: ${uploadResponse.statusText}`);
      }

      // Step 3: Publish the post
      const publishResponse = await fetch('https://open-api.tiktok.com/v2/post/publish/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: caption,
            privacy_level: content.privacy?.toUpperCase() || 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_url: uploadUrl,
          },
        }),
      });

      if (!publishResponse.ok) {
        throw new Error(`Failed to publish post: ${publishResponse.statusText}`);
      }

      const publishData = await publishResponse.json();
      return {
        success: true,
        postId: publishData.data.publish_id,
        platform: 'tiktok' as const,
      };
    } catch (_error) {
      console.error('TikTok API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'tiktok' as const,
      };
    }
  }

  // Get video size helper
  private async getVideoSize(videoUrl: string): Promise<number> {
    try {
      const response = await fetch(videoUrl, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch {
      return 0;
    }
  }

  // Get post metrics
  async getPostMetrics(postId: string) {
    try {
      const response = await fetch(
        `https://open-api.tiktok.com/v2/research/video/query/?fields=id,like_count,comment_count,share_count,view_count`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              video_ids: [postId],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        metrics: data.data.videos[0],
        platform: 'tiktok' as const,
      };
    } catch (_error) {
      console.error('TikTok Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'tiktok' as const,
      };
    }
  }

  // Get user info and metrics
  async getUserInfo() {
    try {
      const response = await fetch(
        'https://open-api.tiktok.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        userInfo: data.data.user,
        platform: 'tiktok' as const,
      };
    } catch (_error) {
      console.error('TikTok User Info Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'tiktok' as const,
      };
    }
  }
}

// TikTok API response schemas
export const TikTokPostSchema = z.object({
  success: z.boolean(),
  postId: z.string().optional(),
  error: z.string().optional(),
  platform: z.literal('tiktok'),
});

export const TikTokMetricsSchema = z.object({
  success: z.boolean(),
  metrics: z.object({
    id: z.string(),
    like_count: z.number(),
    comment_count: z.number(),
    share_count: z.number(),
    view_count: z.number(),
  }).optional(),
  error: z.string().optional(),
  platform: z.literal('tiktok'),
});

export const TikTokUserInfoSchema = z.object({
  success: z.boolean(),
  userInfo: z.object({
    open_id: z.string(),
    display_name: z.string(),
    avatar_url: z.string(),
    follower_count: z.number(),
    following_count: z.number(),
    likes_count: z.number(),
    video_count: z.number(),
  }).optional(),
  error: z.string().optional(),
  platform: z.literal('tiktok'),
});

export type TikTokPostResponse = z.infer<typeof TikTokPostSchema>;
export type TikTokMetricsResponse = z.infer<typeof TikTokMetricsSchema>;
export type TikTokUserInfoResponse = z.infer<typeof TikTokUserInfoSchema>;