# Design Document: Advanced Reddit Analytics

## Overview

This document defines the technical architecture, data models, APIs, and implementation strategy for ThottoPilot's advanced Reddit analytics system - the most comprehensive Reddit analytics platform for content creators.

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

### Phase 1: Core Analytics (2-3 weeks, 16-21h)

**Goal:** Build comprehensive analytics platform

**Tasks:**
1. Req 2: Subreddit Intelligence - 6-8h
2. Req 3: Posting Time Recommendations - 6-8h
3. Req 7: Advanced Filtering - 2-3h
4. Req 8: Export & Reporting - 3-4h

**Deliverables:**
- ✅ Deep subreddit insights
- ✅ Optimal posting times
- ✅ Power user filtering
- ✅ CSV/PDF exports

---

### Phase 2: Intelligence Layer (2-3 weeks, 14-18h)

**Goal:** Proactive insights and alerts

**Tasks:**
1. Req 5: Trend Detection & Alerts - 10-12h
2. MISSING-3: Crosspost Finder - 4-6h

**Deliverables:**
- ✅ Automated trend alerts
- ✅ Crosspost opportunities
- ✅ User retention features

---

### Phase 3: Premium Features (3-4 weeks, 16-22h)

**Goal:** Premium tier differentiation

**Tasks:**
1. Req 4: ML Performance Predictions - 12-16h
2. MISSING-2: Shadowban Detection - 4-5h
3. MISSING-4: Karma Velocity Tracker - 2-3h

**Deliverables:**
- ✅ ML-powered predictions
- ✅ Shadowban detection
- ✅ Real-time velocity tracking

---

### Phase 4: Security & Polish (1 week, 8-11h)

**Goal:** Production hardening

**Tasks:**
1. SECURITY-1: Token Encryption & Rate Limiting - 3-4h
2. MISSING-5: Saturation Monitor - 3-4h
3. MISSING-6: Flair Analysis - 3-4h

**Deliverables:**
- ✅ Encrypted Reddit tokens
- ✅ Rate limiting per user
- ✅ Production-ready security

---

### Phase 5: ML & Advanced (6-8 weeks, 70-92h) - Optional

**Goal:** GPU-accelerated features and advanced analytics

**Tasks:**
1. ML-2: NSFW Classification - 12-16h
2. ML-4: Viral Content Prediction - 18-24h
3. ML-1: Image Content Analysis - 16-20h
4. ML-3: Caption Quality Scoring - 10-14h
5. Req 6: Competitor Benchmarking - 14-18h
6. Req 10: Mobile Optimization - 5-7h

**Deliverables:**
- ✅ GPU-powered ML features
- ✅ Competitive moat
- ✅ $240-710/month cost savings

---

## Success Metrics

### Technical Metrics
- Quick sync: <30s (target: 10s)
- Deep sync: <3min (target: 2min)
- API latency: <200ms p95
- Cache hit rate: >70%
- Database query time: <100ms p95

### User Metrics
- 80%+ users connect Reddit within 24h
- 60%+ users view analytics weekly
- 40%+ users opt into deep sync
- 15-25% increase in post success rate
- 40%+ increase in 30-day retention
- 20%+ upgrade to Pro/Premium for analytics

### Business Metrics
- $90/mo infrastructure cost for 1K MAU
- 12-18 month competitive lead
- #1 in feature completeness (33 features vs 5-10 competitors)
- #1 in creator focus (adult content niche)

---

## Next Steps

1. ✅ Requirements approved
2. ✅ Design document complete
3. 🔄 Create tasks.md with implementation checklist
4. 🔄 Begin Phase -1 (Foundation)

**This design document is now complete and ready for implementation.**

