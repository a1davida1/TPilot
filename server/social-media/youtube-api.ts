import { z } from "zod";

// YouTube Data API Integration
export class YouTubeAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Upload video to YouTube
  async createPost(content: {
    videoUrl: string;
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string;
    privacy?: 'public' | 'unlisted' | 'private';
    thumbnailUrl?: string;
  }) {
    try {
      // Step 1: Get video data
      const videoResponse = await fetch(content.videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to fetch video data');
      }
      const videoBlob = await videoResponse.blob();

      // Step 2: Upload video metadata and content
      const metadata = {
        snippet: {
          title: content.title,
          description: content.description,
          tags: content.tags || [],
          categoryId: content.categoryId || '22', // Default to People & Blogs
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        },
        status: {
          privacyStatus: content.privacy || 'public',
          embeddable: true,
          license: 'youtube'
        }
      };

      // Step 3: Create form data for upload
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('media', videoBlob, 'video.mp4');

      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload video: ${errorText}`);
      }

      const uploadData = await uploadResponse.json();

      // Step 4: Set thumbnail if provided
      if (content.thumbnailUrl && uploadData.id) {
        await this.setThumbnail(uploadData.id, content.thumbnailUrl);
      }

      return {
        success: true,
        videoId: uploadData.id,
        platform: 'youtube' as const,
      };
    } catch (_error) {
      console.error('YouTube API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'youtube' as const,
      };
    }
  }

  // Set video thumbnail
  private async setThumbnail(videoId: string, thumbnailUrl: string) {
    try {
      const thumbnailResponse = await fetch(thumbnailUrl);
      const thumbnailBlob = await thumbnailResponse.blob();

      const formData = new FormData();
      formData.append('media', thumbnailBlob, 'thumbnail.jpg');

      const response = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: formData,
        }
      );

      return response.ok;
    } catch (_error) {
      console.error('YouTube Thumbnail Error:', error);
      return false;
    }
  }

  // Get video statistics
  async getVideoMetrics(videoId: string) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=statistics,snippet&key=${this.accessToken}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch video metrics: ${response.statusText}`);
      }

      const data = await response.json();
      const video = data.items[0];

      return {
        success: true,
        metrics: {
          viewCount: parseInt(video.statistics.viewCount || '0'),
          likeCount: parseInt(video.statistics.likeCount || '0'),
          commentCount: parseInt(video.statistics.commentCount || '0'),
          shareCount: parseInt(video.statistics.shareCount || '0'),
          title: video.snippet.title,
          publishedAt: video.snippet.publishedAt,
        },
        platform: 'youtube' as const,
      };
    } catch (_error) {
      console.error('YouTube Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'youtube' as const,
      };
    }
  }

  // Get channel statistics
  async getChannelMetrics(channelId?: string) {
    try {
      // If no channelId provided, get current user's channel
      const channelQuery = channelId ? `id=${channelId}` : 'mine=true';
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?${channelQuery}&part=statistics,snippet`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch channel metrics: ${response.statusText}`);
      }

      const data = await response.json();
      const channel = data.items[0];

      return {
        success: true,
        metrics: {
          subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
          videoCount: parseInt(channel.statistics.videoCount || '0'),
          viewCount: parseInt(channel.statistics.viewCount || '0'),
          title: channel.snippet.title,
          description: channel.snippet.description,
          publishedAt: channel.snippet.publishedAt,
        },
        platform: 'youtube' as const,
      };
    } catch (_error) {
      console.error('YouTube Channel Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'youtube' as const,
      };
    }
  }

  // Search for videos
  async searchVideos(query: string, maxResults: number = 25) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search videos: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        videos: data.items,
        platform: 'youtube' as const,
      };
    } catch (_error) {
      console.error('YouTube Search Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'youtube' as const,
      };
    }
  }
}

// YouTube API response schemas
export const YouTubePostSchema = z.object({
  success: z.boolean(),
  videoId: z.string().optional(),
  error: z.string().optional(),
  platform: z.literal('youtube'),
});

export const YouTubeMetricsSchema = z.object({
  success: z.boolean(),
  metrics: z.object({
    viewCount: z.number(),
    likeCount: z.number(),
    commentCount: z.number(),
    shareCount: z.number(),
    title: z.string(),
    publishedAt: z.string(),
  }).optional(),
  error: z.string().optional(),
  platform: z.literal('youtube'),
});

export const YouTubeChannelMetricsSchema = z.object({
  success: z.boolean(),
  metrics: z.object({
    subscriberCount: z.number(),
    videoCount: z.number(),
    viewCount: z.number(),
    title: z.string(),
    description: z.string(),
    publishedAt: z.string(),
  }).optional(),
  error: z.string().optional(),
  platform: z.literal('youtube'),
});

export type YouTubePostResponse = z.infer<typeof YouTubePostSchema>;
export type YouTubeMetricsResponse = z.infer<typeof YouTubeMetricsSchema>;
export type YouTubeChannelMetricsResponse = z.infer<typeof YouTubeChannelMetricsSchema>;