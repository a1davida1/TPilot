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

