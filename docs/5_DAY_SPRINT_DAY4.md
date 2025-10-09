# Day 4: Reddit Intelligence Engine
**Time**: 8 hours human + 8 hours AI parallel  
**Goal**: Real-time trend detection, content suggestions, analytics dashboard

---

## ☀️ MORNING SESSION (4 hours)

### [ ] Task 4.1: Design Intelligence System (1.5 hours)

**Step 1: Define intelligence features**:

```markdown
# Reddit Intelligence Requirements

## Feature 1: Trend Detection
- Analyze which posts are getting high engagement
- Identify trending topics in target subreddits
- Suggest optimal posting times
- Track hashtag/keyword performance

## Feature 2: Content Suggestions
- Recommend content types that perform well
- Suggest titles based on successful patterns
- Identify engagement drivers (questions, stories, images)

## Feature 3: Subreddit Recommendations
- Suggest new subreddits based on user's niche
- Rank subreddits by growth potential
- Show competition levels

## Feature 4: Analytics Dashboard
- Post performance metrics
- Engagement trends over time
- Best/worst performing content
- Audience insights
```

**Step 2: Design data models**:

```sql
-- Post Metrics Table (already may exist)
CREATE TABLE post_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  reddit_post_id VARCHAR(255) UNIQUE,
  subreddit VARCHAR(255),
  title TEXT,
  
  -- Engagement
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  upvote_ratio DECIMAL(3,2),
  
  -- Performance
  posted_at TIMESTAMP,
  peak_engagement_at TIMESTAMP,
  hours_to_peak INTEGER,
  
  -- Analysis
  sentiment VARCHAR(20), -- positive, neutral, negative
  content_type VARCHAR(50), -- text, image, video, link
  
  -- Timestamps
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trending Topics Table
CREATE TABLE trending_topics (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(255),
  topic VARCHAR(255),
  mentions INTEGER DEFAULT 1,
  trend_score DECIMAL(5,2),
  detected_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(subreddit, topic, DATE(detected_at))
);

-- User Analytics Summary
CREATE TABLE user_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  period VARCHAR(20), -- daily, weekly, monthly
  period_start DATE,
  
  -- Aggregates
  total_posts INTEGER DEFAULT 0,
  total_upvotes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  avg_upvote_ratio DECIMAL(3,2),
  best_post_id VARCHAR(255),
  best_subreddit VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, period, period_start)
);
```

**Deliverable**: Intelligence system design document ✅

---

### [ ] Task 4.2: Fix Placeholder Code in Subreddit Recommender (2 hours)

**Current issue** (from audit): `server/lib/subreddit-recommender.ts` returns fake data.

**CRITICAL FIX - Replace placeholder implementation**:

```typescript
// server/lib/subreddit-recommender.ts

// ❌ OLD (Remove this):
// TODO: Replace with actual database query
return {
  avgUpvotes: 150,  // ← FAKE!
  avgComments: 25,
  successRate: 0.65
};

// ✅ NEW (Implement real queries):
export async function getSubredditMetrics(subreddit: string) {
  const metrics = await db
    .select({
      avgUpvotes: sql<number>`AVG(upvotes)`,
      avgComments: sql<number>`AVG(comments)`,
      totalPosts: sql<number>`COUNT(*)`,
      successRate: sql<number>`AVG(CASE WHEN score > 10 THEN 1.0 ELSE 0.0 END)`
    })
    .from(postMetrics)
    .where(and(
      eq(postMetrics.subreddit, subreddit),
      gte(postMetrics.postedAt, sql`NOW() - INTERVAL '30 days'`)
    ));

  return metrics[0] || {
    avgUpvotes: 0,
    avgComments: 0,
    totalPosts: 0,
    successRate: 0
  };
}

export async function getUserSubredditPerformance(userId: number) {
  const performance = await db
    .select({
      subreddit: postMetrics.subreddit,
      postCount: sql<number>`COUNT(*)`,
      avgScore: sql<number>`AVG(score)`,
      bestScore: sql<number>`MAX(score)`,
      totalUpvotes: sql<number>`SUM(upvotes)`
    })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId))
    .groupBy(postMetrics.subreddit)
    .orderBy(desc(sql`AVG(score)`));

  return performance;
}

export async function recommendSubreddits(userId: number, niche: string) {
  // Get user's current subreddits
  const userSubreddits = await db
    .select({ subreddit: postMetrics.subreddit })
    .from(postMetrics)
    .where(eq(postMetrics.userId, userId))
    .groupBy(postMetrics.subreddit);

  const currentSubs = new Set(userSubreddits.map(s => s.subreddit));

  // Find similar subreddits with good metrics
  const recommendations = await db
    .select({
      subreddit: redditCommunities.name,
      members: redditCommunities.members,
      growthTrend: redditCommunities.growthTrend,
      avgEngagement: sql<number>`AVG(pm.score)`,
      competitionLevel: redditCommunities.competitionLevel
    })
    .from(redditCommunities)
    .leftJoin(postMetrics, eq(postMetrics.subreddit, redditCommunities.name))
    .where(and(
      eq(redditCommunities.category, niche),
      sql`${redditCommunities.name} NOT IN ${currentSubs}`
    ))
    .groupBy(redditCommunities.name, redditCommunities.members, 
             redditCommunities.growthTrend, redditCommunities.competitionLevel)
    .orderBy(desc(sql`AVG(pm.score)`))
    .limit(10);

  return recommendations;
}
```

**Test the fixes**:
```bash
# Verify no more fake data
grep -n "TODO.*Replace with actual" server/lib/subreddit-recommender.ts
# Should return 0 results

npm run build
npm test -- subreddit-recommender
```

---

## 🤖 PARALLEL: Codex Task 4.A - Implement Trend Detection (3h AI time)

**Copy this to Codex**:

```
TASK: Build trend detection system for Reddit content

CONTEXT:
Analyze post performance to identify trending topics and patterns.

CREATE FILE: server/services/trend-detection.ts

IMPLEMENTATION:

import { db } from '../db.js';
import { postMetrics, trendingTopics } from '@shared/schema';
import { gte, desc, and, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { formatLogArgs } from '../lib/logger-utils.js';

export class TrendDetectionService {
  /**
   * Detect trending topics in a subreddit
   */
  async detectTrendingTopics(subreddit: string, hours: number = 24) {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get recent high-performing posts
      const recentPosts = await db
        .select({
          title: postMetrics.title,
          score: postMetrics.score,
          comments: postMetrics.comments
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, cutoff),
          gte(postMetrics.score, 10) // Minimum threshold
        ))
        .orderBy(desc(postMetrics.score));

      // Extract keywords from titles
      const keywords = new Map<string, number>();
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can']);

      for (const post of recentPosts) {
        const words = post.title
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.has(word));

        for (const word of words) {
          keywords.set(word, (keywords.get(word) || 0) + post.score);
        }
      }

      // Sort by trending score
      const trending = Array.from(keywords.entries())
        .map(([topic, score]) => ({ topic, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      // Store in database
      for (const { topic, score } of trending) {
        await db.insert(trendingTopics).values({
          subreddit,
          topic,
          mentions: 1,
          trendScore: score,
          detectedAt: new Date()
        }).onConflictDoNothing();
      }

      return trending;
    } catch (error) {
      logger.error(...formatLogArgs('Error detecting trends:', error));
      return [];
    }
  }

  /**
   * Get optimal posting times for a subreddit
   */
  async getOptimalPostingTimes(subreddit: string) {
    try {
      const stats = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM posted_at)`,
          avgScore: sql<number>`AVG(score)`,
          postCount: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, sql`NOW() - INTERVAL '90 days'`)
        ))
        .groupBy(sql`EXTRACT(HOUR FROM posted_at)`)
        .having(sql`COUNT(*) >= 5`) // Minimum sample size
        .orderBy(desc(sql`AVG(score)`));

      return stats.slice(0, 5); // Top 5 hours
    } catch (error) {
      logger.error(...formatLogArgs('Error getting optimal times:', error));
      return [];
    }
  }

  /**
   * Analyze content performance patterns
   */
  async analyzeContentPatterns(userId: number) {
    try {
      // Group by content type
      const byType = await db
        .select({
          contentType: postMetrics.contentType,
          avgScore: sql<number>`AVG(score)`,
          count: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(eq(postMetrics.userId, userId))
        .groupBy(postMetrics.contentType);

      // Find high-performing title patterns
      const titlePatterns = await this.analyzeTitlePatterns(userId);

      // Engagement trends
      const engagementTrend = await db
        .select({
          week: sql<string>`DATE_TRUNC('week', posted_at)`,
          avgScore: sql<number>`AVG(score)`,
          totalPosts: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.userId, userId),
          gte(postMetrics.postedAt, sql`NOW() - INTERVAL '90 days'`)
        ))
        .groupBy(sql`DATE_TRUNC('week', posted_at)`)
        .orderBy(sql`DATE_TRUNC('week', posted_at)`);

      return {
        byContentType: byType,
        titlePatterns,
        engagementTrend
      };
    } catch (error) {
      logger.error(...formatLogArgs('Error analyzing patterns:', error));
      return null;
    }
  }

  /**
   * Analyze title patterns (questions vs statements, length, etc.)
   */
  private async analyzeTitlePatterns(userId: number) {
    const posts = await db
      .select({
        title: postMetrics.title,
        score: postMetrics.score
      })
      .from(postMetrics)
      .where(eq(postMetrics.userId, userId));

    const patterns = {
      questions: { count: 0, avgScore: 0, total: 0 },
      statements: { count: 0, avgScore: 0, total: 0 },
      short: { count: 0, avgScore: 0, total: 0 },  // < 50 chars
      medium: { count: 0, avgScore: 0, total: 0 }, // 50-100 chars
      long: { count: 0, avgScore: 0, total: 0 }    // > 100 chars
    };

    for (const post of posts) {
      const title = post.title;
      const score = post.score || 0;

      // Question vs statement
      if (title.includes('?')) {
        patterns.questions.count++;
        patterns.questions.total += score;
      } else {
        patterns.statements.count++;
        patterns.statements.total += score;
      }

      // Length analysis
      const length = title.length;
      if (length < 50) {
        patterns.short.count++;
        patterns.short.total += score;
      } else if (length < 100) {
        patterns.medium.count++;
        patterns.medium.total += score;
      } else {
        patterns.long.count++;
        patterns.long.total += score;
      }
    }

    // Calculate averages
    for (const pattern of Object.values(patterns)) {
      pattern.avgScore = pattern.count > 0 ? pattern.total / pattern.count : 0;
    }

    return patterns;
  }

  /**
   * Generate content suggestions for user
   */
  async generateContentSuggestions(userId: number) {
    try {
      const patterns = await this.analyzeContentPatterns(userId);
      if (!patterns) return [];

      const suggestions = [];

      // Best content type
      const bestType = patterns.byContentType
        .sort((a, b) => b.avgScore - a.avgScore)[0];
      
      if (bestType) {
        suggestions.push({
          type: 'content_type',
          suggestion: `Focus on ${bestType.contentType} content (avg score: ${bestType.avgScore.toFixed(1)})`,
          priority: 'high'
        });
      }

      // Title length recommendation
      const { short, medium, long } = patterns.titlePatterns;
      const bestLength = [
        { name: 'short', ...short },
        { name: 'medium', ...medium },
        { name: 'long', ...long }
      ].sort((a, b) => b.avgScore - a.avgScore)[0];

      suggestions.push({
        type: 'title_length',
        suggestion: `Use ${bestLength.name} titles (${bestLength.name === 'short' ? '<50' : bestLength.name === 'medium' ? '50-100' : '>100'} chars) for best engagement`,
        priority: 'medium'
      });

      // Question vs statement
      const { questions, statements } = patterns.titlePatterns;
      if (questions.avgScore > statements.avgScore) {
        suggestions.push({
          type: 'title_style',
          suggestion: 'Questions perform better than statements for your content',
          priority: 'medium'
        });
      }

      return suggestions;
    } catch (error) {
      logger.error(...formatLogArgs('Error generating suggestions:', error));
      return [];
    }
  }
}

export const trendDetection = new TrendDetectionService();

VALIDATION:
Service should:
1. Detect trending keywords from recent posts
2. Identify optimal posting hours
3. Analyze content patterns (type, title style, length)
4. Generate actionable suggestions

Test with:
const trends = await trendDetection.detectTrendingTopics('fitness', 24);
const times = await trendDetection.getOptimalPostingTimes('fitness');
const suggestions = await trendDetection.generateContentSuggestions(userId);
```

---

## 🌆 AFTERNOON SESSION (4 hours)

### [ ] Task 4.3: Build Analytics API Endpoints (1.5 hours)

**Create** `server/routes/intelligence.ts`:

```typescript
import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { trendDetection } from '../services/trend-detection.js';
import {
  getSubredditMetrics,
  getUserSubredditPerformance,
  recommendSubreddits
} from '../lib/subreddit-recommender.js';

const router = Router();

// GET /api/intelligence/trends/:subreddit
router.get('/trends/:subreddit', authenticateToken(), async (req, res) => {
  const { subreddit } = req.params;
  const hours = parseInt(req.query.hours as string) || 24;
  
  const trends = await trendDetection.detectTrendingTopics(subreddit, hours);
  res.json({ subreddit, trends });
});

// GET /api/intelligence/optimal-times/:subreddit
router.get('/optimal-times/:subreddit', authenticateToken(), async (req, res) => {
  const { subreddit } = req.params;
  const times = await trendDetection.getOptimalPostingTimes(subreddit);
  res.json({ subreddit, optimalTimes: times });
});

// GET /api/intelligence/suggestions
router.get('/suggestions', authenticateToken(true), async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  
  const suggestions = await trendDetection.generateContentSuggestions(userId);
  res.json({ suggestions });
});

// GET /api/intelligence/performance
router.get('/performance', authenticateToken(true), async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  
  const performance = await getUserSubredditPerformance(userId);
  res.json({ performance });
});

// GET /api/intelligence/recommendations
router.get('/recommendations', authenticateToken(true), async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  
  const niche = req.query.niche as string || 'fitness';
  const recommendations = await recommendSubreddits(userId, niche);
  res.json({ recommendations });
});

export default router;
```

Mount in `server/routes.ts`:
```typescript
import intelligenceRouter from './routes/intelligence.js';
app.use('/api/intelligence', intelligenceRouter);
```

---

### [ ] Task 4.4: Build Analytics Dashboard UI (2 hours)

**Create** `client/src/components/intelligence-dashboard.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export function IntelligenceDashboard({ subreddit }: { subreddit: string }) {
  const { data: trends } = useQuery({
    queryKey: ['/api/intelligence/trends', subreddit],
    enabled: !!subreddit
  });

  const { data: optimalTimes } = useQuery({
    queryKey: ['/api/intelligence/optimal-times', subreddit],
    enabled: !!subreddit
  });

  const { data: suggestions } = useQuery({
    queryKey: ['/api/intelligence/suggestions']
  });

  const { data: performance } = useQuery({
    queryKey: ['/api/intelligence/performance']
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Trending Topics */}
      <Card>
        <CardHeader>
          <CardTitle>Trending in r/{subreddit}</CardTitle>
        </CardHeader>
        <CardContent>
          {trends?.trends?.map((trend, i) => (
            <div key={i} className="flex justify-between">
              <span>{trend.topic}</span>
              <span className="text-muted-foreground">{trend.score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Optimal Posting Times */}
      <Card>
        <CardHeader>
          <CardTitle>Best Times to Post</CardTitle>
        </CardHeader>
        <CardContent>
          {optimalTimes?.optimalTimes?.map((time, i) => (
            <div key={i}>
              {time.hour}:00 - Avg Score: {time.avgScore.toFixed(1)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Content Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>Content Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions?.suggestions?.map((s, i) => (
            <div key={i} className="mb-2">
              <span className={`badge ${s.priority}`}>{s.priority}</span>
              {s.suggestion}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Your Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {performance?.performance?.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>r/{p.subreddit}</span>
              <span>Avg: {p.avgScore.toFixed(1)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

Add to Reddit posting page or create dedicated analytics page.

---

### [ ] Task 4.5: Test & Validate (30 min)

**Manual testing**:

1. **Test trend detection**:
```bash
curl http://localhost:5000/api/intelligence/trends/fitness?hours=24
# Should return trending keywords
```

2. **Test optimal times**:
```bash
curl http://localhost:5000/api/intelligence/optimal-times/fitness
# Should return best posting hours
```

3. **Test suggestions**:
```bash
curl http://localhost:5000/api/intelligence/suggestions \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should return personalized content suggestions
```

4. **Verify no fake data**:
```bash
grep -n "TODO.*Replace" server/lib/subreddit-recommender.ts
# Should be 0 results
```

---

## ✅ DAY 4 WRAP-UP (30 min)

### Validation Checklist:
- [ ] Placeholder code removed from subreddit-recommender.ts
- [ ] Real database queries implemented
- [ ] Trend detection service working
- [ ] Analytics API endpoints responding
- [ ] Dashboard UI displays real data
- [ ] No fake/hardcoded metrics

### Commit:
```bash
git add server/lib/subreddit-recommender.ts \
        server/services/trend-detection.ts \
        server/routes/intelligence.ts \
        client/src/components/intelligence-dashboard.tsx

git commit -m "feat: implement Reddit intelligence engine

- Replace placeholder code with real database queries
- Add trend detection service (keywords, optimal times)
- Implement content pattern analysis
- Build analytics API endpoints
- Create intelligence dashboard UI
- Generate personalized content suggestions"

git push
```

---

**🎉 Day 4 Complete!** → Proceed to Day 5

**Tomorrow**: Final polish, admin portal enhancements, deployment prep, and LAUNCH! 🚀
