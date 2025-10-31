# Post Removal Detection Implementation

## Overview

Implemented automatic Reddit post removal detection as part of **QW-2: Post Removal Tracker** from the advanced-reddit-analytics spec.

## What Was Implemented

### 1. Removal Detection Worker (`server/jobs/removal-detection-worker.ts`)

**Purpose:** Automatically detect when Reddit posts are removed and track removal patterns.

**Key Features:**
- Checks posts from the last 7 days for removal status
- Runs hourly via cron schedule (`0 * * * *`)
- Processes up to 100 posts per hour
- Rate limited to 60 requests/minute (Reddit API limit)
- Concurrent processing of 5 posts at a time

**Detection Logic:**
- Fetches post data from Reddit API using HybridRedditClient
- Checks for removal indicators:
  - `post.removed` - Moderator removal
  - `post.spam` - Spam filter
  - `post.removed_by_category` - Categorized removal
- Extracts removal reasons from:
  - `post.mod_note` - Moderator notes
  - `post.removal_reason` - Structured removal reason
- Calculates time from post to removal in minutes

**Database Updates:**
When a removal is detected, updates `reddit_post_outcomes` table:
```typescript
{
  removalType: 'moderator' | 'spam' | 'automod_filtered' | 'unknown',
  removalReason: string,
  detectedAt: Date,
  timeUntilRemovalMinutes: number,
  status: 'removed',
  success: false
}
```

For live posts, updates engagement metrics:
```typescript
{
  upvotes: number,
  commentCount: number
}
```

### 2. Removal Scheduler Worker

**Purpose:** Queues hourly removal checks automatically.

**Implementation:**
- Repeatable Bull job with cron pattern: `0 * * * *`
- Queries posts that haven't been checked yet (`removalType IS NULL`)
- Only checks posts with Reddit post IDs
- Limits to 100 posts per run to avoid API rate limits

### 3. Integration with App Startup

**File:** `server/app.ts`

Workers are automatically initialized when the queue system starts:

```typescript
// Start removal detection workers
try {
  createRemovalDetectionWorker();
  createRemovalSchedulerWorker();
  await scheduleRemovalChecks();
  logger.info('Removal detection workers initialized successfully');
} catch (error) {
  logger.error('Failed to start removal detection workers:', error);
}
```

**Startup Conditions:**
- Only starts if queue system is enabled
- Requires `REDIS_URL` or `DATABASE_URL` environment variable
- Gracefully handles initialization failures

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hourly Cron Trigger                       │
│                    (0 * * * * pattern)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Removal Scheduler Worker                        │
│  - Queries posts from last 7 days                           │
│  - Filters: removalType IS NULL                             │
│  - Limit: 100 posts per run                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Bull Queue (removal-detection)              │
│  - Rate limit: 60 requests/minute                           │
│  - Concurrency: 5 workers                                   │
│  - Retry: 3 attempts with exponential backoff               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Removal Detection Worker                        │
│  1. Fetch post from Reddit API (HybridRedditClient)         │
│  2. Check removal status (removed/spam/filtered)            │
│  3. Extract removal reason (mod_note/removal_reason)        │
│  4. Calculate time until removal                            │
│  5. Update database (reddit_post_outcomes)                  │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

**Table:** `reddit_post_outcomes`

**New Columns Added:**
```sql
removalType VARCHAR(50)           -- Type of removal
removalReason TEXT                -- Extracted reason text
detectedAt TIMESTAMP              -- When removal was detected
timeUntilRemovalMinutes INTEGER   -- Time from post to removal
commentCount INTEGER DEFAULT 0    -- Number of comments
```

**Indexes:**
```sql
CREATE INDEX idx_post_reddit_id ON reddit_post_outcomes(reddit_post_id);
CREATE INDEX idx_post_removal ON reddit_post_outcomes(user_id, removal_type) 
  WHERE removal_type IS NOT NULL;
```

## API Endpoints (TODO)

**Planned Endpoints:**

### GET /api/analytics/removal-history
Returns removal history for authenticated user.

**Auth:** Required (Pro/Premium tier)

**Query Parameters:**
- `subreddit` (optional) - Filter by subreddit
- `startDate` (optional) - Filter by date range
- `endDate` (optional) - Filter by date range
- `removalType` (optional) - Filter by removal type
- `page` (optional) - Pagination
- `limit` (optional) - Results per page

**Response:**
```typescript
{
  removals: Array<{
    id: number;
    subreddit: string;
    title: string;
    removalType: string;
    removalReason: string;
    occurredAt: Date;
    detectedAt: Date;
    timeUntilRemovalMinutes: number;
  }>;
  summary: {
    totalRemovals: number;
    byType: Record<string, number>;
    bySubreddit: Record<string, number>;
    avgTimeUntilRemoval: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

## UI Components (TODO)

### RemovalHistory Component
**Location:** `client/src/components/analytics/RemovalHistory.tsx`

**Features:**
- Table view of removed posts
- Filters: subreddit, date range, removal type
- Summary statistics
- Export to CSV
- Drill-down to post details

### Integration Points
- Analytics dashboard (`client/src/pages/analytics-dashboard.tsx`)
- Subreddit intelligence page
- Post history view

## Testing

**Unit Tests Needed:**
- [ ] Test removal detection logic
- [ ] Test removal reason extraction
- [ ] Test time calculation
- [ ] Test database updates

**Integration Tests Needed:**
- [ ] Test worker initialization
- [ ] Test cron scheduling
- [ ] Test queue processing
- [ ] Test API endpoints

## Monitoring

**Logs:**
- Worker startup: `Removal detection workers initialized successfully`
- Hourly checks: `Queued removal checks, count: X`
- Removal detected: `Post removal detected and recorded`
- Errors: `Failed to check post removal`

**Metrics to Track:**
- Posts checked per hour
- Removals detected per hour
- Average time until removal
- Removal types distribution
- API rate limit usage

## Next Steps

1. **Create API endpoint** (`server/routes/analytics.ts`)
   - Implement `/api/analytics/removal-history`
   - Add tier-based access control (Pro/Premium)
   - Add pagination and filtering

2. **Build UI component** (`client/src/components/analytics/RemovalHistory.tsx`)
   - Table with filters
   - Summary statistics
   - Export functionality

3. **Integrate into dashboard** (`client/src/pages/analytics-dashboard.tsx`)
   - Add removal tracking tab
   - Show summary stats
   - Link to detailed view

4. **Add tests**
   - Unit tests for worker logic
   - Integration tests for queue processing
   - E2E tests for UI

5. **Documentation**
   - API endpoint documentation
   - User guide for removal tracking
   - Best practices for avoiding removals

## Related Specs

- **Spec:** `.kiro/specs/advanced-reddit-analytics/requirements.md`
- **Task:** QW-2: Post Removal Tracker
- **Status:** Backend complete, API and UI pending

## References

- Worker implementation: `server/jobs/removal-detection-worker.ts`
- App integration: `server/app.ts` (lines 23-26, 447-453)
- Database schema: `shared/schema.ts` (reddit_post_outcomes table)
- Platform guide: `.kiro/steering/platform guide.md`
