# Design Document: Advanced Reddit Analytics

## Overview

This document defines the technical architecture, data models, APIs, and implementation strategy for ThottoPilot's advanced Reddit analytics system - the most comprehensive Reddit analytics platform for content creators.

**Requirements Coverage:** This design implements all 21 requirements (Req 0-20) from the requirements document, organized into 4 implementation phases:
- **Phase -1 (Foundation):** Requirement 0 - Reddit Post History Synchronization
- **Phase 0 (Quick Wins):** Requirements 1-10 - High-impact, low-effort features
- **Phase 1 (Core Analytics):** Requirements 11-16 - Comprehensive analytics platform
- **Phase 2 (Intelligence Layer):** Requirements 17-20 - Advanced intelligence features

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  React 18 + Vite + Wouter + shadcn/ui + TanStack Query         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│              Express.js REST API + JWT Auth                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Analytics       │ │   Reddit     │ │   Queue      │
│  Services        │ │   Client     │ │   Workers    │
│                  │ │   (Hybrid)   │ │   (Bull)     │
└──────────────────┘ └──────────────┘ └──────────────┘
        │                    │                │
        └────────────────────┼────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  PostgreSQL + Drizzle ORM + Redis Cache + Materialized Views   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Wouter (routing)
- TanStack Query v5 (state management)
- shadcn/ui + Tailwind CSS (UI)
- Recharts (analytics visualizations)

**Backend:**
- Node.js 20+ + TypeScript
- Express.js (REST API)
- Drizzle ORM (database)
- Bull + Valkey/Redis (job queue)
- Winston (logging)

**External Services:**
- Reddit API (via Snoowrap + Axios hybrid)
- OpenRouter (AI/ML predictions)

**Infrastructure:**
- PostgreSQL 15+ (Render)
- Redis/Valkey (caching + queues)
- Render.com (deployment)



## Core Components

### 1. Hybrid Reddit Client (TECH-1)

**Purpose:** Optimize Reddit API performance by combining Snoowrap (OAuth + writes) with Axios (fast reads)

**Performance Gains:**
- Get 500 posts: 120s → 8s (15x faster)
- Subreddit info: 3s → 0.5s (6x faster)
- Auto-sync: 120s → 10s (12x faster)

**Implementation:**

```typescript
// server/lib/reddit/hybrid-client.ts
import Snoowrap from 'snoowrap';
import axios, { AxiosInstance } from 'axios';
import { Redis } from 'ioredis';

export class HybridRedditClient {
  private snoowrap: Snoowrap;
  private axios: AxiosInstance;
  private redis: Redis;
  
  constructor(userId: number, refreshToken: string) {
    // Snoowrap for OAuth + posting
    this.snoowrap = new Snoowrap({
      userAgent: 'ThottoPilot/1.0.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      refreshToken
    });
    
    // Axios for fast reads
    this.axios = axios.create({
      baseURL: 'https://oauth.reddit.com',
      headers: { 'User-Agent': 'ThottoPilot/1.0.0' }
    });
    
    // Auto-refresh token interceptor
    this.axios.interceptors.request.use(async (config) => {
      let token = await redis.get(`reddit:token:${userId}`);
      if (!token) {
        await this.snoowrap.getMe();
        token = this.snoowrap.accessToken;
        await redis.setex(`reddit:token:${userId}`, 3600, token);
      }
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }
  
  // Fast reads via Axios
  async getUserPosts(username: string, limit: number): Promise<RedditPost[]> {
    const cacheKey = `posts:${username}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    const posts = [];
    let after;
    
    while (posts.length < limit) {
      const { data } = await this.axios.get(`/user/${username}/submitted`, {
        params: { limit: Math.min(100, limit - posts.length), after }
      });
      posts.push(...data.data.children.map(c => c.data));
      after = data.data.after;
      if (!after) break;
    }
    
    await redis.setex(cacheKey, 300, JSON.stringify(posts));
    return posts;
  }
  
  // Robust writes via Snoowrap
  async submitPost(options: PostOptions): Promise<string> {
    const submission = await this.snoowrap.submitLink(options);
    return submission.id;
  }
}
```



### 2. Auto-Sync Service (MISSING-0)

**Purpose:** Automatically sync user's Reddit posting history on account connection

**Sync Tiers:**
- **Quick Sync:** 100 posts, top 10 subreddits (~30s)
- **Deep Sync:** 500 posts, all subreddits (~2-3min)
- **Full Sync:** 1000 posts, all subreddits (~5-10min, Premium only)

**Implementation:**

```typescript
// server/services/reddit-sync-service.ts
export class RedditSyncService {
  async quickSync(userId: number, redditUsername: string): Promise<SyncResult> {
    const reddit = await getHybridClient(userId);
    const posts = await reddit.getUserPosts(redditUsername, 100);
    
    // Extract top 10 subreddits
    const subredditCounts = posts.reduce((acc, post) => {
      acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
      return acc;
    }, {});
    
    const topSubreddits = Object.entries(subredditCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name]) => name);
    
    // Sync subreddits to library
    await Promise.all(topSubreddits.map(sub => 
      this.syncSubredditToLibrary(sub, 'user_history', userId)
    ));
    
    // Backfill posts
    await this.backfillPosts(userId, posts);
    
    return {
      postsSynced: posts.length,
      subredditsFound: topSubreddits.length,
      canDeepSync: true
    };
  }
  
  async deepSync(userId: number, redditUsername: string): Promise<SyncResult> {
    // Queue as background job
    await syncQueue.add('deep-sync', { userId, redditUsername }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
    
    return { jobId: job.id, status: 'queued' };
  }
}
```

**Bull Worker:**

```typescript
// server/workers/sync-worker.ts
const worker = new Worker('reddit-sync', async (job) => {
  const { userId, redditUsername, tier } = job.data;
  const reddit = await getHybridClient(userId);
  
  const limit = tier === 'deep' ? 500 : 1000;
  const posts = [];
  
  for (let i = 0; i < limit / 100; i++) {
    const batch = await reddit.getUserPosts(redditUsername, 100, posts[posts.length - 1]?.name);
    posts.push(...batch);
    
    // Update progress
    await job.updateProgress((posts.length / limit) * 100);
  }
  
  // Process all posts
  await syncService.backfillPosts(userId, posts);
  
  return { postsSynced: posts.length };
}, { connection: redis, concurrency: 5 });
```



## Database Schema

### New Tables

```sql
-- Subreddit metrics history (for trending detection)
CREATE TABLE subreddit_metrics_history (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  members INTEGER NOT NULL,
  active_users INTEGER,
  posts_per_day FLOAT,
  avg_upvotes FLOAT,
  recorded_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_subreddit_time (subreddit, recorded_at)
);

-- Anonymous profiles (GDPR compliance)
CREATE TABLE anonymous_creator_profiles (
  id SERIAL PRIMARY KEY,
  anonymous_id UUID UNIQUE NOT NULL,
  account_age_days INTEGER,
  total_posts INTEGER,
  avg_score FLOAT,
  primary_categories JSONB,
  success_rate FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subreddit relationships (network graph)
CREATE TABLE subreddit_relationships (
  id SERIAL PRIMARY KEY,
  source_subreddit VARCHAR(100) NOT NULL,
  related_subreddit VARCHAR(100) NOT NULL,
  relationship_strength FLOAT,
  common_users INTEGER,
  avg_crosspost_success FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_subreddit, related_subreddit)
);

-- User subreddit preferences
CREATE TABLE user_subreddit_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  subreddit VARCHAR(100) NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  custom_notes TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subreddit)
);

-- Reddit sync status
CREATE TABLE reddit_sync_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  last_sync_at TIMESTAMP,
  posts_synced INTEGER DEFAULT 0,
  subreddits_discovered INTEGER DEFAULT 0,
  sync_tier VARCHAR(20) DEFAULT 'quick',
  sync_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mod activity tracking
CREATE TABLE subreddit_mod_activity (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  mod_username VARCHAR(100),
  activity_type VARCHAR(50),
  detected_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_subreddit_time (subreddit, detected_at)
);

-- User rule violations
CREATE TABLE user_rule_violations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  subreddit VARCHAR(100) NOT NULL,
  rule_category VARCHAR(50),
  rule_field VARCHAR(100),
  violation_description TEXT,
  post_id INTEGER REFERENCES reddit_post_outcomes(id),
  occurred_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_subreddit (user_id, subreddit)
);

-- Karma velocity snapshots (Requirement 20)
CREATE TABLE post_velocity_snapshots (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES reddit_post_outcomes(id),
  snapshot_at VARCHAR(10) NOT NULL, -- '15min', '1hr', '3hr', '6hr', '24hr'
  upvotes INTEGER NOT NULL,
  comments INTEGER DEFAULT 0,
  velocity_score FLOAT NOT NULL, -- upvotes per hour
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_post_velocity (post_id, snapshot_at)
);

-- Analytics alerts (Requirement 13)
CREATE TABLE analytics_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  alert_type VARCHAR(50) NOT NULL, -- 'trend_decline', 'trend_improve', 'shadowban', 'removal_pattern'
  severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  metadata JSONB, -- Additional context
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_alerts (user_id, is_read, created_at DESC)
);
```

### Schema Extensions

```sql
-- Extend reddit_communities
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMP DEFAULT NOW();
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS discovered_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE;
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS trend_score FLOAT;
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS last_mod_activity_at TIMESTAMP;
ALTER TABLE reddit_communities ADD COLUMN IF NOT EXISTS mod_activity_level VARCHAR(20) DEFAULT 'unknown';

-- Extend reddit_post_outcomes
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS removal_type VARCHAR(50);
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS reddit_post_id VARCHAR(100);
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS detected_at TIMESTAMP;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS time_until_removal_minutes INTEGER;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS avg_comment_length INTEGER;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS user_replied BOOLEAN DEFAULT FALSE;
ALTER TABLE reddit_post_outcomes ADD COLUMN IF NOT EXISTS anonymous_profile_id UUID REFERENCES anonymous_creator_profiles(anonymous_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trending ON reddit_communities(is_trending, trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_source ON reddit_communities(discovery_source);
CREATE INDEX IF NOT EXISTS idx_post_reddit_id ON reddit_post_outcomes(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_post_removal ON reddit_post_outcomes(user_id, removal_type) WHERE removal_type IS NOT NULL;
```

### Materialized Views

```sql
-- User subreddit performance (refreshed hourly)
CREATE MATERIALIZED VIEW user_subreddit_performance AS
SELECT 
  user_id,
  subreddit,
  COUNT(*) as total_posts,
  AVG(upvotes) as avg_upvotes,
  AVG(views) as avg_views,
  AVG(comment_count) as avg_comments,
  COUNT(CASE WHEN success = true THEN 1 END)::float / COUNT(*) as success_rate,
  COUNT(CASE WHEN removal_type IS NOT NULL THEN 1 END) as removal_count,
  MAX(occurred_at) as last_post_at
FROM reddit_post_outcomes
GROUP BY user_id, subreddit;

CREATE INDEX idx_user_subreddit_perf ON user_subreddit_performance(user_id, subreddit);

-- Refresh schedule (cron job)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_subreddit_performance;
```



## API Endpoints

### Analytics Endpoints

```typescript
// GET /api/analytics/overview
// Returns: User's overall analytics summary
interface AnalyticsOverview {
  totalPosts: number;
  totalViews: number;
  totalUpvotes: number;
  averageEngagement: number;
  successRate: number;
  growthRate: number;
  topSubreddits: SubredditSummary[];
  recentActivity: Activity[];
}

// GET /api/analytics/subreddit-health
// Returns: Health scores for all user's subreddits
interface SubredditHealth {
  subreddit: string;
  healthScore: number; // 0-100
  successRate: number;
  avgUpvotes: number;
  removalRate: number;
  trend: 'improving' | 'stable' | 'declining';
}

// GET /api/analytics/posting-times
// Returns: Optimal posting times with confidence scores
interface PostingTimeRecommendation {
  dayOfWeek: number;
  hourOfDay: number;
  avgEngagement: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

// POST /api/analytics/predict-performance
// Body: { subreddit, title, scheduledTime }
// Returns: Performance prediction
interface PerformancePrediction {
  level: 'low' | 'medium' | 'high' | 'viral';
  score: number; // 0-100
  confidence: 'low' | 'medium' | 'high';
  suggestions: string[];
  factors: {
    titleLength: number;
    postingTime: number;
    subredditHealth: number;
    userSuccessRate: number;
  };
}

// GET /api/analytics/trending-subreddits
// Returns: Hot, rising, and hidden gem subreddits
interface TrendingSubreddit {
  subreddit: string;
  trendType: 'hot' | 'rising' | 'hidden_gem';
  memberGrowth: number;
  opportunityScore: number;
  reason: string;
  compatibilityScore: number;
}

// GET /api/analytics/removal-history
// Returns: User's post removal history
interface RemovalHistory {
  postId: number;
  subreddit: string;
  title: string;
  removalReason: string;
  removalType: string;
  occurredAt: Date;
  timeUntilRemoval: number; // minutes
}

// GET /api/analytics/subreddit-recommendations
// Returns: Personalized subreddit recommendations
interface SubredditRecommendation {
  subreddit: string;
  compatibilityScore: number;
  reason: string;
  estimatedSuccessRate: number;
  memberCount: number;
  competitionLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

// GET /api/analytics/comment-engagement
// Returns: Comment engagement metrics and posts needing responses
interface CommentEngagementResponse {
  totalComments: number;
  avgCommentsPerPost: number;
  avgCommentToUpvoteRatio: number;
  highDiscussionPosts: Post[];
  needsResponsePosts: Post[];
  responseRate: number;
}

// GET /api/analytics/shadowban-check/:postId
// Returns: Shadowban detection results
interface ShadowbanCheckResponse {
  isShadowbanned: boolean;
  reason: string;
  recommendations: string[];
  subredditHistory: {
    subreddit: string;
    shadowbanCount: number;
    lastIncident: Date;
  }[];
}

// GET /api/analytics/crosspost-opportunities
// Returns: Crosspost opportunities for successful posts (Premium only)
interface CrosspostOpportunity {
  originalPost: Post;
  targetSubreddits: string[];
  suggestedTiming: Date;
  titleVariations: string[];
  estimatedReach: number;
  successProbability: number;
}

// POST /api/analytics/schedule-crosspost
// Body: { originalPostId, targetSubreddit, title, scheduledTime }
// Returns: Scheduled crosspost confirmation

// GET /api/analytics/karma-velocity/:postId
// Returns: Karma velocity tracking and predictions
interface KarmaVelocityResponse {
  snapshots: VelocitySnapshot[];
  prediction: {
    predictedUpvotes: number;
    confidence: 'low' | 'medium' | 'high';
    currentVelocity: number;
  };
  status: 'underperforming' | 'normal' | 'trending';
  recommendation: string;
  comparisonToAverage: {
    userAverage: number;
    percentDifference: number;
  };
}
```

### Sync Endpoints

```typescript
// POST /api/sync/quick
// Triggers quick sync (100 posts, 10 subreddits)
interface SyncRequest {
  userId: number;
}

interface SyncResponse {
  jobId?: string;
  status: 'complete' | 'queued';
  postsSynced: number;
  subredditsFound: number;
  canDeepSync: boolean;
}

// POST /api/sync/deep
// Triggers deep sync (500 posts, all subreddits)
// Returns: Job ID for progress tracking

// GET /api/sync/status/:jobId
// Returns: Sync job progress
interface SyncStatus {
  jobId: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  progress: number; // 0-100
  postsSynced: number;
  subredditsFound: number;
  error?: string;
}
```

### Subreddit Management Endpoints

```typescript
// POST /api/subreddits/add
// Body: { subreddit, source }
// Adds subreddit to library

// GET /api/subreddits/search?q=gonewild
// Searches Reddit for subreddits

// POST /api/subreddits/bulk-import
// Body: { subreddits: string[] }
// Bulk import subreddits

// GET /api/subreddits/:name/rules
// Returns: Subreddit rules and validation info

// GET /api/subreddits/:name/mod-activity
// Returns: Current mod activity level
```



## Service Layer Architecture

### Analytics Services

```typescript
// server/services/analytics-query-service.ts
export class AnalyticsQueryService {
  // Centralized analytics queries
  async getUserOverview(userId: number, daysBack: number): Promise<AnalyticsOverview> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const [overview, topSubs, activity] = await Promise.all([
      this.getOverviewMetrics(userId, startDate),
      this.getTopSubreddits(userId, startDate),
      this.getRecentActivity(userId, 20)
    ]);
    
    return { ...overview, topSubreddits: topSubs, recentActivity: activity };
  }
  
  async getSubredditHealth(userId: number): Promise<SubredditHealth[]> {
    // Use materialized view for performance
    const results = await db.select().from(userSubredditPerformance)
      .where(eq(userSubredditPerformance.userId, userId));
    
    return results.map(r => ({
      subreddit: r.subreddit,
      healthScore: this.calculateHealthScore(r),
      successRate: r.successRate * 100,
      avgUpvotes: r.avgUpvotes,
      removalRate: (r.removalCount / r.totalPosts) * 100,
      trend: this.calculateTrend(r)
    }));
  }
  
  private calculateHealthScore(metrics: SubredditMetrics): number {
    return (
      (metrics.successRate * 0.4) +
      (Math.min(metrics.avgUpvotes / 200, 1) * 0.3) +
      ((1 - metrics.removalCount / metrics.totalPosts) * 0.3)
    ) * 100;
  }
}
```

```typescript
// server/services/prediction-service.ts
export class PredictionService {
  async predictPerformance(
    userId: number,
    subreddit: string,
    title: string,
    scheduledTime: Date
  ): Promise<PerformancePrediction> {
    // Rule-based prediction (Phase 0)
    const factors = await this.gatherPredictionFactors(userId, subreddit, title, scheduledTime);
    
    let score = 50; // Start neutral
    
    // Title length (±15 points)
    if (title.length >= 40 && title.length <= 80) {
      score += 15;
    } else if (title.length < 20 || title.length > 120) {
      score -= 15;
    }
    
    // Posting time (±20 points)
    const optimalHours = await this.getOptimalHours(userId, subreddit);
    const hour = scheduledTime.getHours();
    if (optimalHours.includes(hour)) {
      score += 20;
    }
    
    // Subreddit health (±25 points)
    const health = await this.getSubredditHealth(userId, subreddit);
    score += (health.healthScore - 50) * 0.5;
    
    // User success rate (±20 points)
    const userRate = await this.getUserSuccessRate(userId, subreddit);
    score += (userRate - 50) * 0.4;
    
    // Classify
    const level = score >= 80 ? 'viral' : score >= 65 ? 'high' : score >= 45 ? 'medium' : 'low';
    const confidence = score >= 70 || score <= 30 ? 'high' : score >= 55 || score <= 45 ? 'medium' : 'low';
    
    return {
      level,
      score: Math.round(score),
      confidence,
      suggestions: this.generateSuggestions(factors, score),
      factors
    };
  }
}
```

```typescript
// server/services/trending-service.ts
export class TrendingService {
  async identifyTrendingSubreddits(): Promise<TrendingSubreddit[]> {
    const subreddits = await db.select().from(redditCommunities);
    const trending: TrendingSubreddit[] = [];
    
    for (const sub of subreddits) {
      const history = await this.getSubredditHistory(sub.name, 30);
      if (history.length < 2) continue;
      
      const oldest = history[0];
      const newest = history[history.length - 1];
      const memberGrowth = ((newest.members - oldest.members) / oldest.members) * 100;
      
      // Hot: >20% growth in 30 days
      if (memberGrowth > 20) {
        trending.push({
          subreddit: sub.name,
          trendType: 'hot',
          memberGrowth,
          opportunityScore: this.calculateOpportunityScore(sub, memberGrowth),
          reason: `Growing ${memberGrowth.toFixed(1)}% in last 30 days`,
          compatibilityScore: await this.calculateCompatibility(sub)
        });
      }
      
      // Rising: 5-20% growth, low competition
      if (memberGrowth > 5 && memberGrowth <= 20 && sub.competitionLevel === 'low') {
        trending.push({
          subreddit: sub.name,
          trendType: 'rising',
          memberGrowth,
          opportunityScore: this.calculateOpportunityScore(sub, memberGrowth),
          reason: 'Steady growth with low competition',
          compatibilityScore: await this.calculateCompatibility(sub)
        });
      }
    }
    
    return trending.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }
}
```

```typescript
// server/services/recommendation-service.ts
export class RecommendationService {
  async generateRecommendations(userId: number): Promise<SubredditRecommendation[]> {
    // Get user's successful subreddits
    const successfulSubs = await this.getUserSuccessfulSubreddits(userId);
    
    // Find similar subreddits
    const similarSubs = await this.findSimilarSubreddits(successfulSubs);
    
    // Score each candidate
    const recommendations = await Promise.all(
      similarSubs.map(async sub => ({
        subreddit: sub.name,
        compatibilityScore: await this.calculateCompatibility(userId, sub),
        reason: this.generateReason(userId, sub),
        estimatedSuccessRate: await this.estimateSuccessRate(userId, sub),
        memberCount: sub.members,
        competitionLevel: sub.competitionLevel,
        warnings: await this.checkWarnings(userId, sub)
      }))
    );
    
    return recommendations
      .filter(r => r.compatibilityScore >= 50)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);
  }
}
```



## Frontend Components

### Page Components

```typescript
// client/src/pages/analytics-dashboard.tsx
export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('7d');
  
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics/overview', timeRange],
    queryFn: () => apiRequest('GET', `/api/analytics/overview?range=${timeRange}`),
    enabled: !!user && ['pro', 'premium'].includes(user.tier)
  });
  
  if (!['pro', 'premium'].includes(user?.tier)) {
    return <UpgradePrompt feature="Analytics" requiredTier="pro" />;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <DashboardHeader timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <OverviewCards data={analytics?.overview} />
      <ChartsSection data={analytics} />
      <SubredditPerformanceTable data={analytics?.topSubreddits} />
    </div>
  );
}
```

```typescript
// client/src/pages/subreddit-discovery.tsx
export function SubredditDiscovery() {
  const { data: trending } = useQuery({
    queryKey: ['/api/analytics/trending-subreddits'],
    queryFn: () => apiRequest('GET', '/api/analytics/trending-subreddits')
  });
  
  const { data: recommendations } = useQuery({
    queryKey: ['/api/analytics/subreddit-recommendations'],
    queryFn: () => apiRequest('GET', '/api/analytics/subreddit-recommendations')
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue="trending">
        <TabsList>
          <TabsTrigger value="trending">🔥 Trending</TabsTrigger>
          <TabsTrigger value="recommended">✨ For You</TabsTrigger>
          <TabsTrigger value="search">🔍 Search</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trending">
          <TrendingSubreddits data={trending} />
        </TabsContent>
        
        <TabsContent value="recommended">
          <RecommendedSubreddits data={recommendations} />
        </TabsContent>
        
        <TabsContent value="search">
          <SubredditSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Reusable Components

```typescript
// client/src/components/analytics/SubredditHealthBadge.tsx
export function SubredditHealthBadge({ 
  score, 
  breakdown 
}: { 
  score: number; 
  breakdown: HealthBreakdown 
}) {
  const variant = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'destructive';
  const label = score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs Attention';
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant}>
          {score} {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-sm">
          <div>✓ Success Rate: {breakdown.successRate}% (34/40 points)</div>
          <div>↑ Engagement: {breakdown.engagement}% (22.5/30 points)</div>
          <div>🛡️ Removal Rate: {breakdown.removalRate}% (27/30 points)</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

```typescript
// client/src/components/analytics/PerformancePrediction.tsx
export function PerformancePrediction({ 
  subreddit, 
  title, 
  scheduledTime 
}: PredictionProps) {
  const { data: prediction, isLoading } = useQuery({
    queryKey: ['predict-performance', subreddit, title, scheduledTime],
    queryFn: () => apiRequest('POST', '/api/analytics/predict-performance', {
      subreddit, title, scheduledTime
    }),
    enabled: !!subreddit && !!title
  });
  
  if (isLoading) return <Skeleton className="h-32" />;
  if (!prediction) return null;
  
  return (
    <Card className={cn(
      "border-l-4",
      prediction.level === 'viral' && "border-l-green-500",
      prediction.level === 'high' && "border-l-blue-500",
      prediction.level === 'medium' && "border-l-yellow-500",
      prediction.level === 'low' && "border-l-red-500"
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Prediction
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-bold capitalize">{prediction.level}</div>
            <div className="text-sm text-muted-foreground">
              Score: {prediction.score}/100
            </div>
          </div>
          <Badge variant={prediction.confidence === 'high' ? 'default' : 'secondary'}>
            {prediction.confidence} confidence
          </Badge>
        </div>
        
        {prediction.suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Suggestions:</div>
            {prediction.suggestions.map((s, i) => (
              <div key={i} className="text-sm text-muted-foreground">• {s}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

```typescript
// client/src/components/analytics/EngagementHeatmap.tsx
import { HeatMapGrid } from 'react-grid-heatmap';

export function EngagementHeatmap({ data }: { data: HeatmapCell[] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const heatmapData = days.map((_, dayIndex) =>
    hours.map(hour => {
      const cell = data.find(d => d.day === dayIndex && d.hour === hour);
      return cell?.engagement || 0;
    })
  );
  
  const maxEngagement = Math.max(...data.map(d => d.engagement));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Heatmap</CardTitle>
        <CardDescription>
          Best posting times based on your historical performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HeatMapGrid
          data={heatmapData}
          xLabels={hours.map(h => `${h}:00`)}
          yLabels={days}
          cellRender={(x, y, value) => (
            <div
              className="w-full h-full flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: getHeatmapColor(value, maxEngagement) }}
              onClick={() => handleCellClick(y, x)}
            >
              <Tooltip content={<CellTooltip day={y} hour={x} data={data} />}>
                <span className="text-xs font-medium">
                  {value > 0 ? Math.round(value) : ''}
                </span>
              </Tooltip>
            </div>
          )}
          cellHeight="40px"
        />
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 bg-red-100"></div>
            <span>Low</span>
            <div className="w-4 h-4 bg-yellow-300"></div>
            <span>Medium</span>
            <div className="w-4 h-4 bg-green-500"></div>
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```



## Caching Strategy

### Redis Cache Layers

```typescript
// server/lib/cache-manager.ts
export class CacheManager {
  private redis: Redis;
  
  // Cache tiers with different TTLs
  private readonly CACHE_TIERS = {
    // Hot data - 5 minutes
    HOT: {
      ttl: 300,
      keys: ['reddit:token:', 'posts:recent:', 'sync:progress:']
    },
    // Warm data - 1 hour
    WARM: {
      ttl: 3600,
      keys: ['subreddit:info:', 'user:analytics:', 'health:score:']
    },
    // Cold data - 24 hours
    COLD: {
      ttl: 86400,
      keys: ['subreddit:rules:', 'trending:', 'recommendations:']
    }
  };
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const tier = this.getTier(key);
    const finalTtl = ttl || tier.ttl;
    await this.redis.setex(key, finalTtl, JSON.stringify(value));
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // Stale-while-revalidate pattern
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;
    
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  }
}
```

### Cache Invalidation Strategy

```typescript
// Invalidate on data changes
export async function invalidateUserCache(userId: number) {
  await cache.invalidate(`user:${userId}:*`);
  await cache.invalidate(`analytics:${userId}:*`);
  await cache.invalidate(`health:${userId}:*`);
}

export async function invalidateSubredditCache(subreddit: string) {
  await cache.invalidate(`subreddit:${subreddit}:*`);
  await cache.invalidate(`trending:*`); // Trending may change
}

// Refresh materialized views (cron job every hour)
export async function refreshMaterializedViews() {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY user_subreddit_performance`);
  logger.info('Refreshed materialized views');
}
```



## Security Implementation (Phase 4)

### Token Encryption

```typescript
// server/lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Usage: Store Reddit tokens encrypted
await db.update(users).set({
  redditRefreshToken: encrypt(tokens.refreshToken)
}).where(eq(users.id, userId));
```

### Rate Limiting

```typescript
// server/middleware/rate-limit.ts
import { Redis } from 'ioredis';

export async function rateLimitMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;
  if (!userId) return next();
  
  const key = `ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(key);
  await redis.expire(key, 60);
  
  // 100 requests per minute per user
  if (count > 100) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: 60 
    });
  }
  
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', String(100 - count));
  
  next();
}
```

### GDPR Compliance

```typescript
// server/services/gdpr-service.ts
export class GDPRService {
  async anonymizeUserData(userId: number): Promise<{ anonymousId: string }> {
    const anonymousId = crypto.randomUUID();
    
    // Create anonymous profile
    await db.insert(anonymousCreatorProfiles).values({
      anonymousId,
      accountAgeDays: await this.calculateAccountAge(userId),
      totalPosts: await this.getTotalPosts(userId),
      avgScore: await this.getAvgScore(userId),
      primaryCategories: await this.getPrimaryCategories(userId),
      successRate: await this.getSuccessRate(userId)
    });
    
    // Anonymize post outcomes
    await db.update(redditPostOutcomes)
      .set({
        userId: null,
        anonymousProfileId: anonymousId,
        title: '[REDACTED]',
        redditPostId: null
      })
      .where(eq(redditPostOutcomes.userId, userId));
    
    // Delete PII
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(captionVariants).where(eq(captionVariants.userId, userId));
    
    return { anonymousId };
  }
  
  async exportUserData(userId: number): Promise<UserDataExport> {
    return {
      posts: await this.getUserPosts(userId),
      analytics: await this.getUserAnalytics(userId),
      subreddits: await this.getUserSubreddits(userId),
      exportedAt: new Date()
    };
  }
}
```



## Performance Optimizations

### Database Optimizations

```sql
-- Partial indexes for hot queries
CREATE INDEX idx_recent_posts ON reddit_post_outcomes(user_id, occurred_at DESC)
WHERE occurred_at >= NOW() - INTERVAL '90 days';

CREATE INDEX idx_successful_posts ON reddit_post_outcomes(user_id, subreddit)
WHERE success = true;

CREATE INDEX idx_removed_posts ON reddit_post_outcomes(user_id, subreddit, removal_type)
WHERE removal_type IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_user_subreddit_time ON reddit_post_outcomes(user_id, subreddit, occurred_at DESC);
CREATE INDEX idx_trending_subs ON reddit_communities(is_trending, trend_score DESC) WHERE is_trending = true;
```

### Query Optimization Patterns

```typescript
// Use materialized views for expensive aggregations
const performance = await db.select()
  .from(userSubredditPerformance)
  .where(eq(userSubredditPerformance.userId, userId));

// Batch queries instead of N+1
const subredditNames = posts.map(p => p.subreddit);
const subreddits = await db.select()
  .from(redditCommunities)
  .where(inArray(redditCommunities.name, subredditNames));

// Use EXPLAIN ANALYZE to identify slow queries
const result = await db.execute(sql`
  EXPLAIN ANALYZE
  SELECT * FROM reddit_post_outcomes
  WHERE user_id = ${userId}
  ORDER BY occurred_at DESC
  LIMIT 100
`);
```

### Frontend Performance

```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Lazy load heavy components
const EngagementHeatmap = lazy(() => import('@/components/analytics/EngagementHeatmap'));
const PerformanceChart = lazy(() => import('@/components/analytics/PerformanceChart'));

// Virtualize long lists
import { useVirtualizer } from '@tanstack/react-virtual';

function SubredditList({ subreddits }: { subreddits: Subreddit[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: subreddits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(item => (
          <SubredditCard key={item.key} subreddit={subreddits[item.index]} />
        ))}
      </div>
    </div>
  );
}
```



## Testing Strategy

### Unit Tests

```typescript
// server/services/__tests__/prediction-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionService } from '../prediction-service';

describe('PredictionService', () => {
  let service: PredictionService;
  
  beforeEach(() => {
    service = new PredictionService();
  });
  
  it('should predict high performance for optimal conditions', async () => {
    const prediction = await service.predictPerformance(
      1,
      'gonewild',
      'Perfect title length for engagement',
      new Date('2025-01-01T19:00:00Z') // Optimal time
    );
    
    expect(prediction.level).toBe('high');
    expect(prediction.score).toBeGreaterThan(65);
  });
  
  it('should predict low performance for poor conditions', async () => {
    const prediction = await service.predictPerformance(
      1,
      'gonewild',
      'Bad', // Too short
      new Date('2025-01-01T04:00:00Z') // Bad time
    );
    
    expect(prediction.level).toBe('low');
    expect(prediction.score).toBeLessThan(45);
  });
});
```

### Integration Tests

```typescript
// server/routes/__tests__/analytics.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Analytics API', () => {
  it('GET /api/analytics/overview returns analytics data', async () => {
    const token = await getTestUserToken();
    
    const response = await request(app)
      .get('/api/analytics/overview?range=7d')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('totalPosts');
    expect(response.body).toHaveProperty('successRate');
    expect(response.body.topSubreddits).toBeInstanceOf(Array);
  });
  
  it('POST /api/analytics/predict-performance returns prediction', async () => {
    const token = await getTestUserToken();
    
    const response = await request(app)
      .post('/api/analytics/predict-performance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subreddit: 'gonewild',
        title: 'Test post title',
        scheduledTime: new Date().toISOString()
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('level');
    expect(response.body).toHaveProperty('score');
    expect(['low', 'medium', 'high', 'viral']).toContain(response.body.level);
  });
});
```

### E2E Tests

```typescript
// e2e/analytics.spec.ts
import { test, expect } from '@playwright/test';

test('user can view analytics dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await page.goto('/analytics');
  
  // Check dashboard loads
  await expect(page.locator('h1')).toContainText('Analytics Dashboard');
  
  // Check overview cards
  await expect(page.locator('[data-testid="total-posts"]')).toBeVisible();
  await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
  
  // Check charts render
  await expect(page.locator('[data-testid="engagement-chart"]')).toBeVisible();
  
  // Test time range filter
  await page.click('[data-testid="time-range-30d"]');
  await expect(page.locator('[data-testid="total-posts"]')).not.toHaveText('0');
});

test('user can discover trending subreddits', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/discover');
  
  // Check trending tab
  await page.click('[data-testid="tab-trending"]');
  await expect(page.locator('[data-testid="trending-subreddit"]').first()).toBeVisible();
  
  // Add subreddit
  await page.click('[data-testid="add-subreddit-btn"]').first();
  await expect(page.locator('.toast')).toContainText('Added to your subreddits');
});
```



## Deployment Architecture

### Render Configuration

```yaml
# render.yaml
services:
  - type: web
    name: thottopilot-web
    env: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: RENDER
        value: true
      - key: DATABASE_URL
        fromDatabase:
          name: thottopilot-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: thottopilot-redis
          type: redis
          property: connectionString
    
  - type: worker
    name: thottopilot-worker
    env: node
    buildCommand: npm ci
    startCommand: node dist/server/workers/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: thottopilot-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: thottopilot-redis
          type: redis
          property: connectionString

databases:
  - name: thottopilot-db
    databaseName: thottopilot
    plan: standard

  - name: thottopilot-redis
    plan: standard
```

### Environment Variables

```bash
# Required for production
NODE_ENV=production
RENDER=true
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Authentication
JWT_SECRET=...
SESSION_SECRET=...
ENCRYPTION_KEY=... # 32 bytes hex

# Reddit API
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# OpenRouter (AI)
OPENROUTER_API_KEY=...

# Optional
SENTRY_DSN=...
LOG_LEVEL=info
```

### Scaling Strategy

**For 1,000 MAU:**

| Component | Render Plan | Cost | Capacity |
|-----------|-------------|------|----------|
| Web Service | Standard ($25/mo) | $25 | 50 req/s |
| Worker Service | Standard ($25/mo) | $25 | 10 sync jobs/min |
| PostgreSQL | Standard ($25/mo) | $25 | 10K posts/user |
| Redis | Standard ($15/mo) | $15 | 5GB cache |
| **Total** | | **$90/mo** | **1K MAU** |

**Bottlenecks:**
- Reddit API: 600 req/10min/user → Max 60 concurrent syncs
- Deep sync: 500 posts = 5 API calls → 10 users/min
- Mitigation: Queue with BullMQ, stagger syncs

**For 10,000 MAU:**
- Scale web to Pro ($85/mo) - 200 req/s
- Scale worker to Pro ($85/mo) - 50 sync jobs/min
- Scale PostgreSQL to Pro ($90/mo) - 100K posts/user
- Scale Redis to Pro ($50/mo) - 25GB cache
- **Total: $310/mo for 10K MAU**



## Monitoring & Observability

### Logging Strategy

```typescript
// server/lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Usage
logger.info('Sync started', { userId, tier: 'quick' });
logger.error('Sync failed', { userId, error: error.message, stack: error.stack });
```

### Performance Metrics

```typescript
// server/lib/metrics.ts
export class MetricsCollector {
  async trackApiLatency(endpoint: string, duration: number) {
    await redis.zadd('metrics:api:latency', Date.now(), `${endpoint}:${duration}`);
    
    if (duration > 1000) {
      logger.warn('Slow API endpoint', { endpoint, duration });
    }
  }
  
  async trackCacheHitRate(key: string, hit: boolean) {
    const metric = `metrics:cache:${hit ? 'hits' : 'misses'}`;
    await redis.incr(metric);
  }
  
  async getMetrics(): Promise<Metrics> {
    const [hits, misses, slowQueries] = await Promise.all([
      redis.get('metrics:cache:hits'),
      redis.get('metrics:cache:misses'),
      redis.zcount('metrics:api:latency', 1000, '+inf')
    ]);
    
    const hitRate = (parseInt(hits || '0') / (parseInt(hits || '0') + parseInt(misses || '1'))) * 100;
    
    return {
      cacheHitRate: hitRate,
      slowQueryCount: slowQueries,
      timestamp: new Date()
    };
  }
}
```

### Health Check Endpoint

```typescript
// server/routes/health.ts
router.get('/health', async (req, res) => {
  try {
    // Check database
    await db.execute(sql`SELECT 1`);
    
    // Check Redis
    await redis.ping();
    
    // Check queue
    const queueHealth = await syncQueue.getJobCounts();
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'up',
        redis: 'up',
        queue: queueHealth.active < 100 ? 'up' : 'degraded'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### Error Tracking (Sentry)

```typescript
// server/lib/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});

// Error handler middleware
export function sentryErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  Sentry.captureException(error, {
    user: { id: req.user?.id },
    tags: { endpoint: req.path }
  });
  
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  
  res.status(500).json({ error: 'Internal server error' });
}
```



## Core Analytics Features (Phase 1)

### Trend Detection and Alerts (Requirement 13)

**Purpose:** Automatically detect performance trends and send proactive alerts to users

**Implementation:**

```typescript
// server/services/trend-detection-service.ts
export class TrendDetectionService {
  async detectTrends(userId: number): Promise<TrendAlert[]> {
    const alerts: TrendAlert[] = [];
    
    // Compare last 7 days to previous 7 days
    const currentPeriod = await this.getEngagementMetrics(userId, 7);
    const previousPeriod = await this.getEngagementMetrics(userId, 14, 7);
    
    const engagementChange = ((currentPeriod.avgEngagement - previousPeriod.avgEngagement) / previousPeriod.avgEngagement) * 100;
    
    // Critical decline (>20% drop)
    if (engagementChange < -20) {
      alerts.push({
        type: 'trend_decline',
        severity: 'critical',
        message: `Your engagement has dropped ${Math.abs(engagementChange).toFixed(1)}% in the last week`,
        metadata: {
          currentEngagement: currentPeriod.avgEngagement,
          previousEngagement: previousPeriod.avgEngagement,
          change: engagementChange
        }
      });
    }
    // Warning decline (10-20% drop)
    else if (engagementChange < -10) {
      alerts.push({
        type: 'trend_decline',
        severity: 'warning',
        message: `Your engagement has decreased ${Math.abs(engagementChange).toFixed(1)}% recently`,
        metadata: {
          currentEngagement: currentPeriod.avgEngagement,
          previousEngagement: previousPeriod.avgEngagement,
          change: engagementChange
        }
      });
    }
    // Improvement (>20% increase)
    else if (engagementChange > 20) {
      alerts.push({
        type: 'trend_improve',
        severity: 'info',
        message: `Great work! Your engagement is up ${engagementChange.toFixed(1)}% 🎉`,
        metadata: {
          currentEngagement: currentPeriod.avgEngagement,
          previousEngagement: previousPeriod.avgEngagement,
          change: engagementChange
        }
      });
    }
    
    // Check for removal patterns
    const removalAlerts = await this.detectRemovalPatterns(userId);
    alerts.push(...removalAlerts);
    
    // Check for shadowban patterns
    const shadowbanAlerts = await this.detectShadowbanPatterns(userId);
    alerts.push(...shadowbanAlerts);
    
    // Store alerts in database
    for (const alert of alerts) {
      await db.insert(analyticsAlerts).values({
        userId,
        alertType: alert.type,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata,
        isRead: false
      });
    }
    
    // Send email for critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      await this.sendAlertEmail(userId, criticalAlerts);
    }
    
    return alerts;
  }
  
  private async getEngagementMetrics(
    userId: number,
    daysBack: number,
    offset: number = 0
  ): Promise<EngagementMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (daysBack + offset));
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offset);
    
    const posts = await db.select()
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate),
          lte(redditPostOutcomes.occurredAt, endDate)
        )
      );
    
    const totalEngagement = posts.reduce((sum, p) => sum + (p.upvotes || 0) + (p.commentCount || 0), 0);
    const avgEngagement = posts.length > 0 ? totalEngagement / posts.length : 0;
    
    return {
      totalPosts: posts.length,
      avgEngagement,
      totalUpvotes: posts.reduce((sum, p) => sum + (p.upvotes || 0), 0),
      totalComments: posts.reduce((sum, p) => sum + (p.commentCount || 0), 0)
    };
  }
  
  private async detectRemovalPatterns(userId: number): Promise<TrendAlert[]> {
    const alerts: TrendAlert[] = [];
    
    // Get removals by subreddit in last 7 days
    const removals = await db.select()
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          isNotNull(redditPostOutcomes.removalType),
          gte(redditPostOutcomes.occurredAt, sql`NOW() - INTERVAL '7 days'`)
        )
      );
    
    // Group by subreddit
    const removalsBySubreddit = removals.reduce((acc, post) => {
      acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Alert if 3+ removals in same subreddit
    for (const [subreddit, count] of Object.entries(removalsBySubreddit)) {
      if (count >= 3) {
        alerts.push({
          type: 'removal_pattern',
          severity: 'warning',
          message: `${count} posts removed from r/${subreddit} this week. Review subreddit rules.`,
          metadata: { subreddit, removalCount: count }
        });
      }
    }
    
    return alerts;
  }
  
  private async detectShadowbanPatterns(userId: number): Promise<TrendAlert[]> {
    const alerts: TrendAlert[] = [];
    
    // Get shadowbanned posts in last 7 days
    const shadowbans = await db.select()
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.removalType, 'shadowban'),
          gte(redditPostOutcomes.occurredAt, sql`NOW() - INTERVAL '7 days'`)
        )
      );
    
    // Group by subreddit
    const shadowbansBySubreddit = shadowbans.reduce((acc, post) => {
      acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Alert if 2+ consecutive shadowbans in same subreddit
    for (const [subreddit, count] of Object.entries(shadowbansBySubreddit)) {
      if (count >= 2) {
        alerts.push({
          type: 'shadowban',
          severity: 'critical',
          message: `Possible shadowban in r/${subreddit}. Contact moderators.`,
          metadata: { subreddit, shadowbanCount: count }
        });
      }
    }
    
    return alerts;
  }
}
```

**Cron Job:**

```typescript
// server/jobs/trend-detection-worker.ts
const worker = new Worker('trend-detection', async (job) => {
  const { userId } = job.data;
  const service = new TrendDetectionService();
  
  const alerts = await service.detectTrends(userId);
  
  logger.info('Trend detection complete', { userId, alertCount: alerts.length });
  
  return { alertCount: alerts.length };
}, { connection: redis });

// Schedule daily trend detection for all active users
export async function scheduleDailyTrendDetection() {
  const activeUsers = await db.select()
    .from(users)
    .where(
      and(
        inArray(users.tier, ['pro', 'premium']),
        isNotNull(users.redditAccessToken)
      )
    );
  
  for (const user of activeUsers) {
    await trendQueue.add('trend-detection', { userId: user.id }, {
      repeat: { cron: '0 9 * * *' } // Daily at 9 AM
    });
  }
}
```

**API Endpoints:**

```typescript
// GET /api/analytics/alerts
interface AlertsResponse {
  unreadCount: number;
  alerts: TrendAlert[];
}

// POST /api/analytics/alerts/:id/dismiss
// Marks alert as read

// GET /api/analytics/alerts/settings
// Returns user's alert preferences

// PUT /api/analytics/alerts/settings
// Updates alert preferences (email notifications, severity threshold)
```

---

### Advanced Analytics Filtering (Requirement 14)

**Purpose:** Enable power users to perform deep analysis with flexible filtering

**Implementation:**

```typescript
// server/services/analytics-filter-service.ts
export class AnalyticsFilterService {
  async applyFilters(userId: number, filters: AnalyticsFilters): Promise<FilteredAnalytics> {
    let query = db.select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, userId));
    
    // Subreddit filter
    if (filters.subreddits && filters.subreddits.length > 0) {
      query = query.where(inArray(redditPostOutcomes.subreddit, filters.subreddits));
    }
    
    // Date range filter
    if (filters.startDate) {
      query = query.where(gte(redditPostOutcomes.occurredAt, filters.startDate));
    }
    if (filters.endDate) {
      query = query.where(lte(redditPostOutcomes.occurredAt, filters.endDate));
    }
    
    // Performance tier filter
    if (filters.performanceTier) {
      const tierRanges = {
        viral: { min: 200, max: Infinity },
        high: { min: 100, max: 199 },
        medium: { min: 20, max: 99 },
        low: { min: 0, max: 19 }
      };
      
      const range = tierRanges[filters.performanceTier];
      query = query.where(
        and(
          gte(redditPostOutcomes.upvotes, range.min),
          range.max !== Infinity ? lte(redditPostOutcomes.upvotes, range.max) : undefined
        )
      );
    }
    
    // Status filter
    if (filters.status === 'success') {
      query = query.where(eq(redditPostOutcomes.success, true));
    } else if (filters.status === 'removed') {
      query = query.where(isNotNull(redditPostOutcomes.removalType));
    }
    
    const posts = await query;
    
    // Calculate filtered metrics
    const metrics = {
      totalPosts: posts.length,
      successRate: posts.filter(p => p.success).length / posts.length,
      avgUpvotes: posts.reduce((sum, p) => sum + (p.upvotes || 0), 0) / posts.length,
      avgViews: posts.reduce((sum, p) => sum + (p.views || 0), 0) / posts.length,
      uniqueSubreddits: new Set(posts.map(p => p.subreddit)).size
    };
    
    return {
      posts,
      metrics,
      appliedFilters: filters
    };
  }
}
```

**Frontend Component:**

```typescript
// client/src/components/analytics/AnalyticsFilters.tsx
export function AnalyticsFilters({ onFilterChange }: AnalyticsFiltersProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    subreddits: [],
    startDate: null,
    endDate: null,
    performanceTier: null,
    status: 'all'
  });
  
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subreddit multi-select */}
        <div>
          <Label>Subreddits</Label>
          <MultiSelect
            options={subreddits}
            value={filters.subreddits}
            onChange={(value) => handleFilterChange('subreddits', value)}
          />
        </div>
        
        {/* Date range picker */}
        <div>
          <Label>Date Range</Label>
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(start, end) => {
              handleFilterChange('startDate', start);
              handleFilterChange('endDate', end);
            }}
          />
        </div>
        
        {/* Performance tier */}
        <div>
          <Label>Performance</Label>
          <Select
            value={filters.performanceTier || 'all'}
            onValueChange={(value) => handleFilterChange('performanceTier', value === 'all' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="viral">Viral (200+)</SelectItem>
              <SelectItem value="high">High (100-199)</SelectItem>
              <SelectItem value="medium">Medium (20-99)</SelectItem>
              <SelectItem value="low">Low (0-19)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Status filter */}
        <div>
          <Label>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Successful</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Active filters badges */}
        {Object.entries(filters).some(([k, v]) => v && (Array.isArray(v) ? v.length > 0 : true)) && (
          <div className="flex flex-wrap gap-2">
            {filters.subreddits.map(sub => (
              <Badge key={sub} variant="secondary">
                {sub}
                <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => {
                  handleFilterChange('subreddits', filters.subreddits.filter(s => s !== sub));
                }} />
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={() => {
              setFilters({
                subreddits: [],
                startDate: null,
                endDate: null,
                performanceTier: null,
                status: 'all'
              });
              onFilterChange({});
            }}>
              Clear all
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Analytics Export and Reporting (Requirement 15)

**Purpose:** Allow Pro/Premium users to export analytics data for external analysis

**Implementation:**

```typescript
// server/services/export-service.ts
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';

export class ExportService {
  async exportCSV(userId: number, filters: AnalyticsFilters): Promise<string> {
    const filterService = new AnalyticsFilterService();
    const { posts } = await filterService.applyFilters(userId, filters);
    
    const csvData = posts.map(post => ({
      date: post.occurredAt.toISOString(),
      subreddit: post.subreddit,
      title: post.title,
      upvotes: post.upvotes,
      views: post.views,
      comments: post.commentCount,
      success: post.success,
      removed: post.removalType ? 'Yes' : 'No',
      removalReason: post.removalReason || ''
    }));
    
    return stringify(csvData, { header: true });
  }
  
  async exportJSON(userId: number, filters: AnalyticsFilters): Promise<object> {
    const filterService = new AnalyticsFilterService();
    const data = await filterService.applyFilters(userId, filters);
    
    return {
      exportedAt: new Date().toISOString(),
      userId,
      filters,
      metrics: data.metrics,
      posts: data.posts
    };
  }
  
  async exportPDF(userId: number, filters: AnalyticsFilters): Promise<Buffer> {
    const filterService = new AnalyticsFilterService();
    const { posts, metrics } = await filterService.applyFilters(userId, filters);
    
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Header
      doc.fontSize(20).text('Analytics Report', { align: 'center' });
      doc.fontSize(12).text(`User: ${user[0].username}`, { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();
      
      // Metrics summary
      doc.fontSize(16).text('Summary Metrics');
      doc.fontSize(12);
      doc.text(`Total Posts: ${metrics.totalPosts}`);
      doc.text(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
      doc.text(`Avg Upvotes: ${metrics.avgUpvotes.toFixed(1)}`);
      doc.text(`Avg Views: ${metrics.avgViews.toFixed(1)}`);
      doc.text(`Unique Subreddits: ${metrics.uniqueSubreddits}`);
      doc.moveDown();
      
      // Top posts table
      doc.fontSize(16).text('Top Posts');
      doc.fontSize(10);
      const topPosts = posts.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 10);
      topPosts.forEach((post, i) => {
        doc.text(`${i + 1}. r/${post.subreddit} - ${post.upvotes} upvotes`);
        doc.text(`   ${post.title}`, { indent: 20 });
      });
      
      doc.end();
    });
  }
}
```

**API Endpoints:**

```typescript
// POST /api/analytics/export/csv
// Returns CSV file download

// POST /api/analytics/export/json
// Returns JSON file download

// POST /api/analytics/export/pdf (Premium only)
// Returns PDF report download
```

---

### Trending Subreddit Discovery (Requirement 16)

**Purpose:** Help users discover growing subreddits before they become saturated

**Implementation:**

```typescript
// server/services/trending-service.ts
export class TrendingService {
  async identifyTrendingSubreddits(userId: number): Promise<TrendingSubreddit[]> {
    const subreddits = await db.select().from(redditCommunities);
    const trending: TrendingSubreddit[] = [];
    
    for (const sub of subreddits) {
      const history = await this.getSubredditHistory(sub.name, 30);
      if (history.length < 2) continue;
      
      const oldest = history[0];
      const newest = history[history.length - 1];
      const memberGrowth = ((newest.members - oldest.members) / oldest.members) * 100;
      
      let trendType: 'hot' | 'rising' | 'hidden_gem' | null = null;
      
      // Hot: >20% growth in 30 days
      if (memberGrowth > 20) {
        trendType = 'hot';
      }
      // Rising: 5-20% growth with low competition
      else if (memberGrowth > 5 && memberGrowth <= 20 && sub.competitionLevel === 'low') {
        trendType = 'rising';
      }
      // Hidden gems: steady growth, under 50k members
      else if (memberGrowth > 2 && sub.members < 50000) {
        trendType = 'hidden_gem';
      }
      
      if (trendType) {
        const opportunityScore = this.calculateOpportunityScore(sub, memberGrowth);
        const compatibilityScore = await this.calculateCompatibility(userId, sub);
        
        trending.push({
          subreddit: sub.name,
          trendType,
          memberGrowth,
          currentMembers: sub.members,
          opportunityScore,
          compatibilityScore,
          reason: this.generateTrendReason(trendType, memberGrowth, sub)
        });
      }
    }
    
    return trending.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }
  
  private calculateOpportunityScore(sub: RedditCommunity, growth: number): number {
    // Growth rate: 40%
    const growthScore = Math.min(growth / 50, 1) * 40;
    
    // Competition level: 30%
    const competitionScore = sub.competitionLevel === 'low' ? 30 : sub.competitionLevel === 'medium' ? 15 : 0;
    
    // Size (prefer medium-sized): 30%
    const sizeScore = sub.members > 10000 && sub.members < 100000 ? 30 : 15;
    
    return Math.round(growthScore + competitionScore + sizeScore);
  }
  
  private generateTrendReason(type: string, growth: number, sub: RedditCommunity): string {
    if (type === 'hot') {
      return `Growing ${growth.toFixed(1)}% in last 30 days - high momentum`;
    } else if (type === 'rising') {
      return `Steady ${growth.toFixed(1)}% growth with low competition`;
    } else {
      return `Hidden gem with ${sub.members.toLocaleString()} members and ${growth.toFixed(1)}% growth`;
    }
  }
}
```

**Cron Job:**

```typescript
// server/jobs/metrics-tracking-worker.ts
const worker = new Worker('metrics-tracking', async (job) => {
  const subreddits = await db.select().from(redditCommunities);
  
  for (const sub of subreddits) {
    const reddit = await getHybridClient();
    const subredditData = await reddit.getSubredditInfo(sub.name);
    
    await db.insert(subredditMetricsHistory).values({
      subreddit: sub.name,
      members: subredditData.subscribers,
      activeUsers: subredditData.active_user_count,
      postsPerDay: await calculatePostsPerDay(sub.name),
      avgUpvotes: await calculateAvgUpvotes(sub.name)
    });
  }
  
  logger.info('Metrics tracking complete', { subredditCount: subreddits.length });
}, { connection: redis });

// Schedule daily at midnight
export function scheduleDailyMetricsTracking() {
  metricsQueue.add('metrics-tracking', {}, {
    repeat: { cron: '0 0 * * *' }
  });
}
```

---

## Intelligence Layer Features (Phase 2)

### Comment Engagement Tracking (Requirement 17)

**Purpose:** Track comment engagement to identify high-discussion posts and posts needing responses

**Implementation:**

```typescript
// server/services/comment-engagement-service.ts
export class CommentEngagementService {
  async trackCommentEngagement(userId: number): Promise<CommentEngagementMetrics> {
    const posts = await db.select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, userId))
      .orderBy(desc(redditPostOutcomes.occurredAt))
      .limit(100);
    
    const metrics = {
      totalComments: 0,
      avgCommentsPerPost: 0,
      highDiscussionPosts: [] as Post[],
      needsResponsePosts: [] as Post[],
      responseRate: 0
    };
    
    for (const post of posts) {
      metrics.totalComments += post.commentCount || 0;
      
      // High discussion: comment-to-upvote ratio > 0.1
      const ratio = (post.commentCount || 0) / (post.upvotes || 1);
      if (ratio > 0.1) {
        metrics.highDiscussionPosts.push(post);
      }
      
      // Needs response: has comments but user hasn't replied
      if ((post.commentCount || 0) > 0 && !post.userReplied) {
        metrics.needsResponsePosts.push(post);
      }
    }
    
    metrics.avgCommentsPerPost = metrics.totalComments / posts.length;
    metrics.responseRate = posts.filter(p => p.userReplied).length / posts.length;
    
    return metrics;
  }
  
  async updateCommentData(postId: number): Promise<void> {
    const post = await db.select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.id, postId))
      .limit(1);
    
    if (!post[0]?.redditPostId) return;
    
    const reddit = await getHybridClient(post[0].userId);
    const submission = await reddit.getSubmission(post[0].redditPostId);
    
    const comments = await submission.comments.fetchAll();
    const userComments = comments.filter(c => c.author.name === post[0].redditUsername);
    
    await db.update(redditPostOutcomes)
      .set({
        commentCount: comments.length,
        avgCommentLength: comments.reduce((sum, c) => sum + c.body.length, 0) / comments.length,
        userReplied: userComments.length > 0
      })
      .where(eq(redditPostOutcomes.id, postId));
  }
}
```

**API Endpoints:**

```typescript
// GET /api/analytics/comment-engagement
interface CommentEngagementResponse {
  totalComments: number;
  avgCommentsPerPost: number;
  highDiscussionPosts: Post[];
  needsResponsePosts: Post[];
  responseRate: number;
}

// GET /api/analytics/comment-engagement/stats
interface CommentStatsResponse {
  avgCommentToUpvoteRatio: number;
  topDiscussionPosts: Post[];
  responseQueueCount: number;
}
```

---

### Shadowban and Spam Filter Detection (Requirement 18)

**Purpose:** Detect when users are shadowbanned or spam-filtered to prevent wasted posting efforts

**Implementation:**

```typescript
// server/services/shadowban-detection-service.ts
export class ShadowbanDetectionService {
  async detectShadowban(postId: number): Promise<ShadowbanResult> {
    const post = await db.select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.id, postId))
      .limit(1);
    
    if (!post[0]?.redditPostId) {
      return { isShadowbanned: false, reason: 'No Reddit post ID' };
    }
    
    const reddit = await getHybridClient(post[0].userId);
    const submission = await reddit.getSubmission(post[0].redditPostId);
    
    // Check if post is removed or marked as spam
    const isRemoved = submission.removed || submission.spam;
    
    // Check for zero engagement after 1 hour
    const postAge = Date.now() - (submission.created_utc * 1000);
    const hasZeroEngagement = submission.score === 1 && submission.num_comments === 0;
    const isOlderThan1Hour = postAge > 3600000;
    
    const isShadowbanned = isRemoved || (hasZeroEngagement && isOlderThan1Hour);
    
    if (isShadowbanned) {
      await db.update(redditPostOutcomes)
        .set({
          status: isRemoved ? 'spam_filtered' : 'shadowbanned',
          removalType: isRemoved ? 'spam' : 'shadowban',
          detectedAt: new Date()
        })
        .where(eq(redditPostOutcomes.id, postId));
      
      // Check for consecutive shadowbans
      const recentShadowbans = await this.getRecentShadowbans(
        post[0].userId,
        post[0].subreddit
      );
      
      if (recentShadowbans >= 2) {
        await this.generateShadowbanAlert(post[0].userId, post[0].subreddit);
      }
    }
    
    return {
      isShadowbanned,
      reason: isRemoved ? 'Spam filtered by Reddit' : 'Zero engagement after 1 hour',
      recommendations: this.getShadowbanRecommendations(post[0].subreddit)
    };
  }
  
  private getShadowbanRecommendations(subreddit: string): string[] {
    return [
      'Contact subreddit moderators to verify your account status',
      'Verify your email address on Reddit',
      'Build karma in other subreddits before posting here',
      'Review and follow all subreddit rules carefully',
      'Avoid posting too frequently to this subreddit'
    ];
  }
}
```

**Cron Job:**

```typescript
// server/jobs/shadowban-detection-worker.ts
const worker = new Worker('shadowban-detection', async (job) => {
  const { postId } = job.data;
  const service = new ShadowbanDetectionService();
  
  const result = await service.detectShadowban(postId);
  
  if (result.isShadowbanned) {
    logger.warn('Shadowban detected', { postId, reason: result.reason });
  }
  
  return result;
}, { connection: redis });

// Schedule checks for posts 1 hour after creation
export async function scheduleShadowbanCheck(postId: number, createdAt: Date) {
  const checkTime = new Date(createdAt.getTime() + 3600000); // 1 hour later
  
  await shadowbanQueue.add('shadowban-detection', { postId }, {
    delay: checkTime.getTime() - Date.now()
  });
}
```

---

### Crosspost Opportunity Finder (Requirement 19)

**Purpose:** Identify successful posts that can be crossposted to related subreddits for maximum reach

**Implementation:**

```typescript
// server/services/crosspost-service.ts
export class CrosspostService {
  async findCrosspostOpportunities(userId: number): Promise<CrosspostOpportunity[]> {
    // Find successful posts (>100 upvotes, <7 days old)
    const candidates = await db.select()
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gt(redditPostOutcomes.upvotes, 100),
          gt(redditPostOutcomes.occurredAt, sql`NOW() - INTERVAL '7 days'`)
        )
      );
    
    const opportunities: CrosspostOpportunity[] = [];
    
    for (const post of candidates) {
      // Find related subreddits
      const relatedSubs = await db.select()
        .from(subredditRelationships)
        .where(eq(subredditRelationships.sourceSubreddit, post.subreddit))
        .orderBy(desc(subredditRelationships.relationshipStrength))
        .limit(5);
      
      // Filter out subreddits where user already posted this content
      const alreadyPosted = await this.checkAlreadyPosted(userId, post.title);
      const targetSubs = relatedSubs.filter(s => !alreadyPosted.includes(s.relatedSubreddit));
      
      if (targetSubs.length > 0) {
        // Generate title variations using AI
        const titleVariations = await this.generateTitleVariations(post.title, targetSubs);
        
        // Calculate optimal timing (6-24 hours after original)
        const suggestedTime = new Date(post.occurredAt.getTime() + (12 * 3600000));
        
        opportunities.push({
          originalPost: post,
          targetSubreddits: targetSubs.map(s => s.relatedSubreddit),
          suggestedTiming: suggestedTime,
          titleVariations,
          estimatedReach: this.calculateEstimatedReach(targetSubs),
          successProbability: await this.calculateSuccessProbability(userId, targetSubs)
        });
      }
    }
    
    return opportunities.sort((a, b) => b.estimatedReach - a.estimatedReach);
  }
  
  private async generateTitleVariations(
    originalTitle: string,
    targetSubs: SubredditRelationship[]
  ): Promise<string[]> {
    const variations: string[] = [originalTitle];
    
    // Use AI to generate 2-3 variations tailored to different audiences
    for (const sub of targetSubs.slice(0, 2)) {
      const prompt = `Rewrite this Reddit post title for r/${sub.relatedSubreddit}: "${originalTitle}". Keep it engaging and appropriate for that community.`;
      
      const variation = await generateText({
        prompt,
        model: GROK_4_FAST,
        maxTokens: 100
      });
      
      variations.push(variation.trim());
    }
    
    return variations;
  }
}
```

**API Endpoints:**

```typescript
// GET /api/analytics/crosspost-opportunities
interface CrosspostOpportunity {
  originalPost: Post;
  targetSubreddits: string[];
  suggestedTiming: Date;
  titleVariations: string[];
  estimatedReach: number;
  successProbability: number;
}

// POST /api/analytics/schedule-crosspost
interface ScheduleCrosspostRequest {
  originalPostId: number;
  targetSubreddit: string;
  title: string;
  scheduledTime: Date;
}
```

---

### Karma Velocity Tracking (Requirement 20)

**Purpose:** Track early karma velocity to predict final performance and enable real-time optimization

**Implementation:**

```typescript
// server/services/karma-velocity-service.ts
export class KarmaVelocityService {
  private readonly SNAPSHOT_INTERVALS = [
    { name: '15min', minutes: 15 },
    { name: '1hr', minutes: 60 },
    { name: '3hr', minutes: 180 },
    { name: '6hr', minutes: 360 },
    { name: '24hr', minutes: 1440 }
  ];
  
  async scheduleVelocitySnapshots(postId: number, createdAt: Date): Promise<void> {
    for (const interval of this.SNAPSHOT_INTERVALS) {
      const snapshotTime = new Date(createdAt.getTime() + (interval.minutes * 60000));
      
      await velocityQueue.add('velocity-snapshot', { postId, interval: interval.name }, {
        delay: snapshotTime.getTime() - Date.now()
      });
    }
  }
  
  async takeVelocitySnapshot(postId: number, interval: string): Promise<VelocitySnapshot> {
    const post = await db.select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.id, postId))
      .limit(1);
    
    if (!post[0]?.redditPostId) {
      throw new Error('Post not found or missing Reddit ID');
    }
    
    const reddit = await getHybridClient(post[0].userId);
    const submission = await reddit.getSubmission(post[0].redditPostId);
    
    const upvotes = submission.score;
    const comments = submission.num_comments;
    const postAge = (Date.now() - (submission.created_utc * 1000)) / 3600000; // hours
    const velocityScore = upvotes / postAge; // upvotes per hour
    
    const snapshot = await db.insert(postVelocitySnapshots).values({
      postId,
      snapshotAt: interval,
      upvotes,
      comments,
      velocityScore,
      createdAt: new Date()
    }).returning();
    
    // Compare to user's average velocity
    const avgVelocity = await this.getUserAverageVelocity(
      post[0].userId,
      post[0].subreddit,
      interval
    );
    
    // Generate alerts if underperforming
    if (velocityScore < avgVelocity * 0.5) {
      await this.generateUnderperformanceAlert(postId, velocityScore, avgVelocity);
    } else if (velocityScore > avgVelocity * 2) {
      await this.generateTrendingAlert(postId, velocityScore, avgVelocity);
    }
    
    return snapshot[0];
  }
  
  async predictFinalUpvotes(postId: number): Promise<VelocityPrediction> {
    const snapshots = await db.select()
      .from(postVelocitySnapshots)
      .where(eq(postVelocitySnapshots.postId, postId))
      .orderBy(asc(postVelocitySnapshots.createdAt));
    
    if (snapshots.length < 2) {
      return { predictedUpvotes: null, confidence: 'low' };
    }
    
    // Use early velocity to predict final count
    const earlyVelocity = snapshots[0].velocityScore;
    const currentVelocity = snapshots[snapshots.length - 1].velocityScore;
    
    // Simple linear extrapolation (can be improved with ML)
    const decayFactor = currentVelocity / earlyVelocity;
    const predictedUpvotes = Math.round(currentVelocity * 24 * decayFactor);
    
    const confidence = snapshots.length >= 3 ? 'high' : 'medium';
    
    return {
      predictedUpvotes,
      confidence,
      currentVelocity,
      snapshots
    };
  }
}
```

**Database Schema:**

```sql
CREATE TABLE post_velocity_snapshots (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES reddit_post_outcomes(id),
  snapshot_at VARCHAR(10), -- '15min', '1hr', '3hr', '6hr', '24hr'
  upvotes INTEGER NOT NULL,
  comments INTEGER DEFAULT 0,
  velocity_score FLOAT NOT NULL, -- upvotes per hour
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_post_velocity (post_id, snapshot_at)
);
```

**API Endpoints:**

```typescript
// GET /api/analytics/karma-velocity/:postId
interface KarmaVelocityResponse {
  snapshots: VelocitySnapshot[];
  prediction: VelocityPrediction;
  status: 'underperforming' | 'normal' | 'trending';
  recommendation: string;
}

// GET /api/analytics/velocity-chart/:postId
// Returns data for velocity chart visualization
```

---

## Implementation Phases

### Phase -1: Foundation (Day 1, 6-9h)

**Goal:** Set up data foundation for all analytics features

**Tasks:**
1. Implement HybridRedditClient (Snoowrap + Axios) - 2-3h
2. Create RedditSyncService (quick/deep/full sync) - 2-3h
3. Set up Bull worker for background syncs - 1-2h
4. Add database schema extensions - 1h

**Deliverables:**
- ✅ Users can connect Reddit account
- ✅ Quick sync (100 posts, 30s) works
- ✅ Deep sync (500 posts, opt-in) works
- ✅ Data populates analytics tables

---

### Phase 0: Quick Wins (2-3 weekends, 16-20h)

**Goal:** Deliver immediate value with high-impact features

**Weekend 1 (8-10h):**
- Group A: QW-2 (Removal Tracker), QW-4 (Success Widget), QW-6 (Health Score)
- Group B: QW-9 (Heatmap), QW-10 (Stats Comparison), MISSING-1 (Comment Tracker)

**Weekend 2 (6-8h):**
- Group C: QW-1 (Mod Detection), QW-3 (Rule Validator), QW-7 (Predictor)

**Weekend 3 (2.5-3.5h):**
- Group D: QW-8 (Recommendations)

**Deliverables:**
- ✅ 9 user-facing features
- ✅ Analytics dashboard populated
- ✅ Users can see health scores, predictions, recommendations

---

### Phase 1: Core Analytics (2-3 weeks, 30-40h)

**Goal:** Build comprehensive analytics platform

**Tasks:**
1. Req 11: Subreddit Intelligence Dashboard - 6-8h
2. Req 12: Optimal Posting Time Recommendations - 6-8h
3. Req 13: Trend Detection & Alerts - 10-12h
4. Req 14: Advanced Analytics Filtering - 2-3h
5. Req 15: Analytics Export & Reporting - 3-4h
6. Req 16: Trending Subreddit Discovery - 3-4h

**Deliverables:**
- ✅ Deep subreddit intelligence with performance metrics
- ✅ Data-driven posting time recommendations
- ✅ Automated trend detection and proactive alerts
- ✅ Power user filtering capabilities
- ✅ CSV/JSON/PDF exports (PDF Premium only)
- ✅ Trending subreddit discovery engine

---

### Phase 2: Intelligence Layer (2-3 weeks, 20-28h)

**Goal:** Advanced intelligence features and Premium differentiation

**Tasks:**
1. Req 17: Comment Engagement Tracking - 3-4h
2. Req 18: Shadowban & Spam Filter Detection - 4-5h
3. Req 19: Crosspost Opportunity Finder (Premium) - 5-6h
4. Req 20: Karma Velocity Tracking - 2-3h

**Deliverables:**
- ✅ Comment engagement metrics and response tracking
- ✅ Shadowban detection and alerts
- ✅ Automated crosspost opportunity identification (Premium)
- ✅ Real-time karma velocity tracking and predictions
- ✅ User retention features

---

### Phase 3: Security & Polish (1 week, 8-11h)

**Goal:** Production hardening and security

**Tasks:**
1. Token Encryption & Rate Limiting - 3-4h
2. GDPR Compliance (anonymization, data export) - 3-4h
3. Performance Optimizations (indexes, caching) - 2-3h

**Deliverables:**
- ✅ Encrypted Reddit tokens (AES-256-GCM)
- ✅ Rate limiting per user (100 req/min)
- ✅ GDPR-compliant data handling
- ✅ Optimized database queries
- ✅ Production-ready security

---

### Phase 4: ML & Advanced (Optional, 6-8 weeks, 70-92h)

**Goal:** GPU-accelerated features and competitive moat

**Tasks:**
1. ML-powered performance predictions (beyond rule-based) - 18-24h
2. NSFW content classification - 12-16h
3. Image content analysis - 16-20h
4. Caption quality scoring - 10-14h
5. Competitor benchmarking - 14-18h

**Deliverables:**
- ✅ GPU-powered ML features
- ✅ Advanced competitive intelligence
- ✅ Significant cost savings ($240-710/month)

---

## Success Metrics

### Technical Metrics
- Quick sync: <30s (target: 10s) - Requirement 0
- Deep sync: <3min (target: 2min) - Requirement 0
- Performance prediction: <500ms - Requirement 3
- API latency: <200ms p95
- Cache hit rate: >70%
- Database query time: <100ms p95
- Heatmap generation: <1s - Requirement 7

### User Engagement Metrics (from Requirements)
- 80%+ of users connect Reddit within 24h of signup - Requirement 0
- 60%+ of Pro users view analytics weekly - Requirements 11-16
- 40%+ increase in 30-day retention for analytics users - Requirements 13, 17-20
- 70%+ of users complete Quick Sync on first connection - Requirement 0
- 30%+ opt for Deep Sync within first week - Requirement 0
- 50%+ of Pro users use performance predictions before posting - Requirement 3

### Feature Adoption Metrics
- 70%+ of users view health scores within first week - Requirement 2
- 40%+ of users act on removal tracking insights - Requirement 1
- 25%+ of users use subreddit recommendations - Requirement 6
- 15%+ of Premium users use crosspost finder - Requirement 19
- 30%+ of users respond to trend alerts - Requirement 13

### Business Impact Metrics (from Requirements)
- 20%+ conversion rate from Free to Pro for analytics access
- 15%+ improvement in user post success rates
- 25%+ reduction in post removals for active analytics users
- $90/mo infrastructure cost for 1K MAU
- 12-18 month competitive lead
- #1 in feature completeness (21 core features vs 5-10 competitors)

---

## Requirements Mapping

This design document addresses all 21 requirements from the requirements.md file:

### Foundation (Phase -1)
- **Requirement 0:** Reddit Post History Synchronization → HybridRedditClient + RedditSyncService (Quick/Deep/Full sync)

### Quick Wins (Phase 0)
- **Requirement 1:** Post Removal Detection → RemovalDetectionWorker + RemovalTrackerService
- **Requirement 2:** Subreddit Health Scoring → SubredditHealthService (0-100 score with breakdown)
- **Requirement 3:** Rule-Based Performance Prediction → PredictionService (weighted scoring algorithm)
- **Requirement 4:** Moderator Activity Detection → ModActivityService + cron job
- **Requirement 5:** Enhanced Rule Validation → RuleValidatorService (personal history integration)
- **Requirement 6:** Smart Subreddit Recommendations → RecommendationService (compatibility scoring)
- **Requirement 7:** Engagement Heatmap → HeatmapService (7x24 grid visualization)
- **Requirement 8:** Performance Comparison → Time period comparison in analytics API
- **Requirement 9:** Success Rate Widget → Success rate calculation API + dashboard widget
- **Requirement 10:** Posting Time Badges → Time slot performance badges

### Core Analytics (Phase 1)
- **Requirement 11:** Subreddit Intelligence Dashboard → SubredditIntelligenceService (detailed metrics per subreddit)
- **Requirement 12:** Optimal Posting Time Recommendations → Posting time analysis with confidence levels
- **Requirement 13:** Trend Detection & Alerts → TrendDetectionService + daily cron job + email notifications
- **Requirement 14:** Advanced Analytics Filtering → AnalyticsFilterService (multi-dimensional filtering)
- **Requirement 15:** Analytics Export & Reporting → ExportService (CSV/JSON/PDF formats)
- **Requirement 16:** Trending Subreddit Discovery → TrendingService (hot/rising/hidden gems classification)

### Intelligence Layer (Phase 2)
- **Requirement 17:** Comment Engagement Tracking → CommentEngagementService (response tracking + high-discussion detection)
- **Requirement 18:** Shadowban & Spam Filter Detection → ShadowbanDetectionService (zero-engagement detection + alerts)
- **Requirement 19:** Crosspost Opportunity Finder → CrosspostService (Premium feature, AI title variations)
- **Requirement 20:** Karma Velocity Tracking → KarmaVelocityService (5 snapshot intervals + predictions)

### Additional Design Elements
- **Security:** Token encryption (AES-256-GCM), rate limiting, GDPR compliance
- **Performance:** Materialized views, Redis caching, partial indexes, query optimization
- **Monitoring:** Winston logging, Sentry error tracking, health checks, metrics collection
- **Testing:** Unit tests, integration tests, E2E tests with Playwright
- **Deployment:** Render.com configuration, scaling strategy, environment variables

---

## Next Steps

1. ✅ Requirements approved (21 requirements defined)
2. ✅ Design document complete (all requirements mapped)
3. 🔄 Create tasks.md with implementation checklist
4. 🔄 Begin Phase -1 (Foundation - Requirement 0)

**This design document is now complete and ready for implementation. All 21 requirements from requirements.md are fully addressed with technical specifications, API designs, database schemas, and implementation strategies.**

