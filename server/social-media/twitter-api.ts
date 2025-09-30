import { z } from "zod";

// Twitter/X API v2 Integration
export class TwitterAPI {
  private accessToken: string;
  private accessTokenSecret: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor(config: {
    accessToken: string;
    accessTokenSecret: string;
    consumerKey: string;
    consumerSecret: string;
  }) {
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
  }

  // Generate OAuth 1.0a signature (simplified version)
  private generateAuthHeader(method: string, url: string, _params: Record<string, string> = {}) {
    // In production, use a proper OAuth 1.0a library like 'oauth-1.0a'
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2);
    
    return `OAuth oauth_consumer_key="${this.consumerKey}", oauth_token="${this.accessToken}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${timestamp}", oauth_nonce="${nonce}", oauth_version="1.0"`;
  }

  // Create a tweet
  async createTweet(content: {
    text: string;
    mediaIds?: string[];
    replyToTweetId?: string;
  }) {
    try {
      const requestBody = {
        text: content.text,
        ...(content.mediaIds && { media: { media_ids: content.mediaIds } }),
        ...(content.replyToTweetId && { reply: { in_reply_to_tweet_id: content.replyToTweetId } }),
      };

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.generateAuthHeader('POST', 'https://api.twitter.com/2/tweets'),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Twitter API Error: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        tweetId: data.data.id,
        platform: 'twitter' as const,
      };
    } catch (_error) {
      console.error('Twitter API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter' as const,
      };
    }
  }

  // Upload media for tweets
  async uploadMedia(mediaUrl: string, mediaType: 'image' | 'video') {
    try {
      // First, download the media
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        throw new Error('Failed to download media');
      }

      const mediaBuffer = await mediaResponse.arrayBuffer();
      const formData = new FormData();
      formData.append('media', new Blob([mediaBuffer]), 'media');
      formData.append('media_category', mediaType === 'video' ? 'tweet_video' : 'tweet_image');

      const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': this.generateAuthHeader('POST', 'https://upload.twitter.com/1.1/media/upload.json'),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload media: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        mediaId: data.media_id_string,
        platform: 'twitter' as const,
      };
    } catch (_error) {
      console.error('Twitter Media Upload Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter' as const,
      };
    }
  }

  // Get tweet metrics
  async getTweetMetrics(tweetId: string) {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
        {
          headers: {
            'Authorization': this.generateAuthHeader('GET', `https://api.twitter.com/2/tweets/${tweetId}`),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tweet metrics: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        metrics: data.data.public_metrics,
        platform: 'twitter' as const,
      };
    } catch (_error) {
      console.error('Twitter Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter' as const,
      };
    }
  }

  // Get user metrics
  async getUserMetrics(userId: string) {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`,
        {
          headers: {
            'Authorization': this.generateAuthHeader('GET', `https://api.twitter.com/2/users/${userId}`),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user metrics: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        metrics: data.data.public_metrics,
        platform: 'twitter' as const,
      };
    } catch (_error) {
      console.error('Twitter User Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter' as const,
      };
    }
  }
}

// Twitter API response schemas
export const TwitterTweetSchema = z.object({
  success: z.boolean(),
  tweetId: z.string().optional(),
  error: z.string().optional(),
  platform: z.literal('twitter'),
});

export const TwitterMetricsSchema = z.object({
  success: z.boolean(),
  metrics: z.object({
    retweet_count: z.number(),
    reply_count: z.number(),
    like_count: z.number(),
    quote_count: z.number(),
  }).optional(),
  error: z.string().optional(),
  platform: z.literal('twitter'),
});

export type TwitterTweetResponse = z.infer<typeof TwitterTweetSchema>;
export type TwitterMetricsResponse = z.infer<typeof TwitterMetricsSchema>;