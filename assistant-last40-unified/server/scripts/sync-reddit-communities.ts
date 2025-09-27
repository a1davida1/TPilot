import snoowrap from 'snoowrap';
import { z } from 'zod';
import { db } from '../db.js';
import { redditCommunities, insertRedditCommunitySchema, InsertRedditCommunity } from '@shared/schema';
import { logger } from '../lib/logger.js';

// Environment validation schema
const envSchema = z.object({
  REDDIT_CLIENT_ID: z.string().min(1, 'REDDIT_CLIENT_ID is required'),
  REDDIT_CLIENT_SECRET: z.string().min(1, 'REDDIT_CLIENT_SECRET is required'),
  REDDIT_USER_AGENT: z.string().min(1, 'REDDIT_USER_AGENT is required'),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  REDDIT_REFRESH_TOKEN: z.string().optional(),
}).refine(
  (data) => data.REDDIT_REFRESH_TOKEN || (data.REDDIT_USERNAME && data.REDDIT_PASSWORD),
  {
    message: 'Either REDDIT_REFRESH_TOKEN or both REDDIT_USERNAME and REDDIT_PASSWORD are required',
  }
);

// Sync configuration schema
const syncConfigSchema = z.object({
  subreddits: z.array(z.string()).optional(),
  runId: z.string().optional(),
});

// Default subreddits to sync if none provided - configurable via environment
const DEFAULT_SUBREDDITS = process.env.DEFAULT_SYNC_SUBREDDITS?.split(',') || [
  'photography',
  'earthporn',
  'naturephotography',
  'art',
  'drawing',
  'digitalart',
  'itookapicture',
  'pics',
  'mildlyinteresting'
];

interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

interface SubredditData {
  display_name?: string;
  public_description?: string;
  description?: string;
  subscribers?: number;
  active_user_count?: number;
  subreddit_type?: string;
}

interface EngagementMetrics {
  avgUpvotes: number;
  avgComments: number;
  postFrequency: number;
}

/**
 * Normalize subreddit data for database insertion
 */
function normalizeSubredditData(subreddit: SubredditData, engagementMetrics: EngagementMetrics) {
  const name = subreddit.display_name?.toLowerCase() || '';
  const displayName = subreddit.display_name || '';
  const description = subreddit.public_description || subreddit.description || '';
  
  // Calculate basic engagement score
  const subscribers = subreddit.subscribers || 0;
  const activeUsers = subreddit.active_user_count || 0;
  const engagementRate = subscribers > 0 ? Math.min((activeUsers / subscribers) * 100, 100) : 0;
  
  // Determine promotion rules based on subreddit settings
  let promotionAllowed: 'yes' | 'no' | 'limited' = 'limited';
  if (subreddit.subreddit_type === 'private' || subreddit.subreddit_type === 'restricted') {
    promotionAllowed = 'no';
  } else if (description.toLowerCase().includes('no selling') || description.toLowerCase().includes('no promotion')) {
    promotionAllowed = 'no';
  } else if (description.toLowerCase().includes('sellers welcome') || description.toLowerCase().includes('promotion allowed')) {
    promotionAllowed = 'yes';
  }

  // Determine verification requirements
  const verificationRequired = description.toLowerCase().includes('verified') || 
                               description.toLowerCase().includes('verification') ||
                               name.includes('verified');

  // Calculate success probability heuristic
  let successProbability = 50; // Base probability
  if (engagementRate > 10) successProbability += 20;
  if (subscribers > 100000) successProbability += 10;
  if (subscribers < 10000) successProbability -= 10;
  if (promotionAllowed === 'yes') successProbability += 15;
  if (promotionAllowed === 'no') successProbability -= 25;
  if (verificationRequired) successProbability -= 10;
  successProbability = Math.max(0, Math.min(100, successProbability));

  // Determine competition level
  let competitionLevel: 'low' | 'medium' | 'high' = 'medium';
  if (subscribers < 50000) competitionLevel = 'low';
  else if (subscribers > 500000) competitionLevel = 'high';

  // Growth trend (simplified - in reality would compare historical data)
  const growthTrend: 'up' | 'down' | 'stable' = 'stable';

  return {
    id: name, // Use name as primary key
    name,
    displayName,
    description,
    members: subscribers,
    category: subreddit.subreddit_type || 'public',
    rules: [], // Rules would be fetched separately
    engagementRate: Math.round(engagementRate),
    successProbability: Math.round(successProbability),
    competitionLevel,
    growthTrend,
    verificationRequired,
    promotionAllowed,
    averageUpvotes: engagementMetrics.avgUpvotes,
    postingLimits: null,
    bestPostingTimes: null,
    modActivity: null,
    tags: null,
  };
}

/**
 * Calculate engagement metrics for a subreddit
 */
async function calculateEngagementMetrics(reddit: snoowrap, subredditName: string): Promise<EngagementMetrics> {
  try {
    // Fetch recent posts to calculate engagement metrics
    const subreddit = reddit.getSubreddit(subredditName);
    const hotPosts = await subreddit.getHot({ limit: 25 });
    
    if (hotPosts.length === 0) {
      return {
        avgUpvotes: 0,
        avgComments: 0,
        postFrequency: 0,
      };
    }

    const totalUpvotes = hotPosts.reduce((sum, post) => sum + (post.ups || 0), 0);
    const totalComments = hotPosts.reduce((sum, post) => sum + (post.num_comments || 0), 0);
    
    return {
      avgUpvotes: Math.round(totalUpvotes / hotPosts.length),
      avgComments: Math.round(totalComments / hotPosts.length),
      postFrequency: hotPosts.length, // Simplified metric
    };
  } catch (error) {
    logger.warn(`Failed to calculate engagement metrics for r/${subredditName}:`, error);
    return {
      avgUpvotes: 0,
      avgComments: 0,
      postFrequency: 0,
    };
  }
}

/**
 * Sync a single subreddit's data with retry logic
 */
async function syncSubreddit(reddit: snoowrap, subredditName: string, retryCount = 0): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  try {
    logger.info(`Syncing r/${subredditName}...`);
    
    // Fetch subreddit info
    const subreddit = await new Promise<SubredditData>((resolve, reject) => {
      reddit.getSubreddit(subredditName).fetch()
        .then(resolve)
        .catch(reject);
    });
    
    // Calculate engagement metrics
    const engagementMetrics = await calculateEngagementMetrics(reddit, subredditName);
    
    // Normalize data for insertion
    const normalizedData = normalizeSubredditData(subreddit, engagementMetrics);
    
    // Validate against schema
    const validatedData = insertRedditCommunitySchema.parse(normalizedData) as InsertRedditCommunity;
    
    // Upsert to database
    await db.insert(redditCommunities)
      .values(validatedData)
      .onConflictDoUpdate({
        target: redditCommunities.name,
        set: {
          displayName: validatedData.displayName,
          description: validatedData.description,
          members: validatedData.members,
          category: validatedData.category,
          engagementRate: validatedData.engagementRate,
          successProbability: validatedData.successProbability,
          competitionLevel: validatedData.competitionLevel,
          growthTrend: validatedData.growthTrend,
          verificationRequired: validatedData.verificationRequired,
          promotionAllowed: validatedData.promotionAllowed,
          averageUpvotes: validatedData.averageUpvotes,
        },
      });
    
    logger.info(`✅ Successfully synced r/${subredditName} (${subreddit.subscribers} members)`);
  } catch (error: unknown) {
    // Handle rate limiting and authentication errors
    const errorObj = error as { statusCode?: number };
    if (errorObj.statusCode === 429 || errorObj.statusCode === 401 || errorObj.statusCode === 403) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Exponential backoff with jitter
        logger.warn(`Rate limited or auth error for r/${subredditName}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return syncSubreddit(reddit, subredditName, retryCount + 1);
      }
    }
    
    logger.error(`❌ Failed to sync r/${subredditName}:`, error);
    throw error;
  }
}

/**
 * Main sync function
 */
export async function syncRedditCommunities(config?: { subreddits?: string[]; runId?: string; }): Promise<SyncResult> {
  const { subreddits = DEFAULT_SUBREDDITS, runId } = syncConfigSchema.parse(config || {});
  
  logger.info(`🔄 Starting Reddit communities sync`, { 
    runId, 
    subredditCount: subreddits.length,
    subreddits: subreddits.slice(0, 5).join(', ') + (subreddits.length > 5 ? '...' : '')
  });
  
  // Validate environment variables
  const env = envSchema.parse({
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT || 'ThottoPilot/1.0 (Community sync bot)',
    REDDIT_USERNAME: process.env.REDDIT_USERNAME,
    REDDIT_PASSWORD: process.env.REDDIT_PASSWORD,
    REDDIT_REFRESH_TOKEN: process.env.REDDIT_REFRESH_TOKEN,
  });
  
  // Initialize Reddit client with proper authentication
  const redditConfig: {
    userAgent: string;
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
    username?: string;
    password?: string;
  } = {
    userAgent: env.REDDIT_USER_AGENT,
    clientId: env.REDDIT_CLIENT_ID,
    clientSecret: env.REDDIT_CLIENT_SECRET,
  };

  if (env.REDDIT_REFRESH_TOKEN) {
    redditConfig.refreshToken = env.REDDIT_REFRESH_TOKEN;
  } else if (env.REDDIT_USERNAME && env.REDDIT_PASSWORD) {
    redditConfig.username = env.REDDIT_USERNAME;
    redditConfig.password = env.REDDIT_PASSWORD;
  }

  const reddit = new snoowrap(redditConfig);

  const result: SyncResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  // Process each subreddit
  for (const subredditName of subreddits) {
    result.processed++;
    
    try {
      await syncSubreddit(reddit, subredditName);
      result.succeeded++;
    } catch (error) {
      result.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`r/${subredditName}: ${errorMessage}`);
    }
    
    // Rate limiting - wait between requests with jitter
    const delay = 1000 + Math.random() * 500; // 1-1.5s delay with jitter
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  logger.info(`✅ Reddit communities sync completed`, {
    runId,
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    errorCount: result.errors.length,
  });
  
  if (result.errors.length > 0) {
    logger.warn('Sync completed with errors:', result.errors);
  }
  
  return result;
}

/**
 * CLI entry point for manual runs
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncRedditCommunities()
    .then((result) => {
      console.error('✅ Sync completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    });
}