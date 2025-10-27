/**
 * Reddit User Data Service
 * Fetches extended user data from Reddit API for validation and community discovery
 */

import { logger } from '../bootstrap/logger.js';

export interface RedditUserData {
  username: string;
  id: string;
  totalKarma: number;
  accountCreatedUtc: number; // Unix timestamp
  iconImg?: string;
}

export interface RedditSubredditInfo {
  name: string;
  displayName: string;
  subscribers: number;
  over18: boolean;
  description: string;
  publicDescription: string;
  activeUsers?: number;
  allowImages: boolean;
  allowVideos: boolean;
  submissionType: 'any' | 'link' | 'self';
}

export interface UserPostStats {
  subreddit: string;
  postCount: number;
}

/**
 * Fetch extended user data from Reddit /api/v1/me
 */
export async function fetchRedditUserData(accessToken: string): Promise<RedditUserData> {
  try {
    const response = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'ThottoPilot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      name: string;
      id: string;
      total_karma?: number;
      link_karma?: number;
      comment_karma?: number;
      created_utc: number;
      icon_img?: string;
    };

    return {
      username: data.name,
      id: data.id,
      totalKarma: data.total_karma ?? (data.link_karma ?? 0) + (data.comment_karma ?? 0),
      accountCreatedUtc: data.created_utc,
      iconImg: data.icon_img,
    };
  } catch (error) {
    logger.error('Failed to fetch Reddit user data', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Fetch user's post history and calculate top subreddits by activity
 */
export async function fetchUserTopSubreddits(
  accessToken: string,
  username: string,
  limit: number = 100
): Promise<UserPostStats[]> {
  try {
    const response = await fetch(
      `https://oauth.reddit.com/user/${username}/submitted?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'ThottoPilot/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      data: {
        children: Array<{
          data: {
            subreddit: string;
          };
        }>;
      };
    };

    // Count posts per subreddit
    const subredditCounts = new Map<string, number>();

    for (const post of data.data.children) {
      const subreddit = post.data.subreddit;
      subredditCounts.set(subreddit, (subredditCounts.get(subreddit) || 0) + 1);
    }

    // Convert to array and sort by post count
    const sorted = Array.from(subredditCounts.entries())
      .map(([subreddit, postCount]) => ({ subreddit, postCount }))
      .sort((a, b) => b.postCount - a.postCount);

    return sorted;
  } catch (error) {
    logger.error('Failed to fetch user post history', {
      username,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Fetch detailed information about a subreddit
 */
export async function fetchSubredditDetails(
  accessToken: string,
  subreddit: string
): Promise<RedditSubredditInfo> {
  try {
    const response = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/about`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'ThottoPilot/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      data: {
        display_name: string;
        display_name_prefixed: string;
        subscribers: number;
        over18: boolean;
        description: string;
        public_description: string;
        active_user_count?: number;
        allow_images?: boolean;
        allow_videos?: boolean;
        submission_type?: 'any' | 'link' | 'self';
      };
    };

    const data = json.data;

    return {
      name: data.display_name,
      displayName: data.display_name_prefixed,
      subscribers: data.subscribers,
      over18: data.over18,
      description: data.description || '',
      publicDescription: data.public_description || '',
      activeUsers: data.active_user_count,
      allowImages: data.allow_images ?? true,
      allowVideos: data.allow_videos ?? true,
      submissionType: data.submission_type ?? 'any',
    };
  } catch (error) {
    logger.error('Failed to fetch subreddit details', {
      subreddit,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get user's top N active subreddits with full details
 */
export async function getUserTopCommunitiesWithDetails(
  accessToken: string,
  username: string,
  topN: number = 5
): Promise<RedditSubredditInfo[]> {
  try {
    // Get top subreddits by post activity
    const topSubreddits = await fetchUserTopSubreddits(accessToken, username, 100);

    // Get top N
    const topNSubreddits = topSubreddits.slice(0, topN);

    // Fetch full details for each
    const details = await Promise.allSettled(
      topNSubreddits.map(({ subreddit }) =>
        fetchSubredditDetails(accessToken, subreddit)
      )
    );

    // Filter out failed fetches and return successful ones
    return details
      .filter((result): result is PromiseFulfilledResult<RedditSubredditInfo> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  } catch (error) {
    logger.error('Failed to fetch top communities', {
      username,
      error: error instanceof Error ? error.message : String(error)
    });
    return []; // Return empty array on error rather than throwing
  }
}
