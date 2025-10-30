# Reddit Sync Feature - Beta Testing Guide

## Overview

The Reddit Sync feature automatically imports your Reddit posting history to provide analytics and insights. It's fully functional and ready for beta testing!

## Feature Status: ✅ READY FOR BETA

### Backend Implementation
- ✅ Fully implemented in `server/services/reddit-sync-service.ts`
- ✅ API endpoints active at `/api/reddit/sync/*`
- ✅ Background job processing via `server/jobs/reddit-sync-worker.ts`
- ✅ Tier-based access control enforced

### Testing Coverage
- ✅ Route tests: `tests/routes/reddit-sync.test.ts` (13 test cases)
- ✅ Service tests: `tests/unit/reddit-sync-service.test.ts`
- ✅ E2E tests: `tests/e2e/reddit-sync-e2e.test.ts`
- ✅ Worker tests: `tests/unit/workers/community-sync-worker.test.ts`

### Frontend Integration
- ✅ UI integrated in Intelligence Insights page (`/subreddit-insights`)
- ✅ Sync buttons with real-time status updates
- ✅ Job progress tracking
- ✅ Tier restriction messaging

## How to Test

### 1. Prerequisites
- Beta tester must have a Reddit account connected
- Navigate to: **https://thottopilot.com/subreddit-insights**

### 2. Sync Types Available

#### Quick Sync (All Users)
- **What it does**: Syncs 100 most recent posts from top 10 subreddits
- **Time**: ~30 seconds
- **Access**: All authenticated users
- **Endpoint**: `POST /api/reddit/sync/quick`

#### Deep Sync (Pro+ Users)
- **What it does**: Syncs 500 posts from all subreddits
- **Time**: 2-3 minutes
- **Access**: Pro and Premium tiers only
- **Endpoint**: `POST /api/reddit/sync/deep`

#### Full Sync (Premium Only)
- **What it does**: Syncs 1000 posts from all subreddits
- **Time**: 5-10 minutes
- **Access**: Premium tier only
- **Endpoint**: `POST /api/reddit/sync/full`

### 3. Testing Steps

1. **Check Initial Status**
   - Visit `/subreddit-insights`
   - Look for sync status card showing: "No sync yet"

2. **Run Quick Sync**
   - Click "Quick Sync" button
   - Should see: "Quick sync started" message
   - Wait ~30 seconds
   - Refresh page to see updated stats

3. **Verify Data Imported**
   - Check that post count increased
   - Verify subreddit count shows discovered communities
   - Select a subreddit from dropdown to see analytics

4. **Test Tier Restrictions** (if testing Pro/Premium)
   - Pro users: Can run Deep Sync but not Full Sync
   - Premium users: Can run all sync types
   - Free/Starter: Should see upgrade prompts for Deep/Full

## What Gets Synced

### Post Data
- Post titles and content
- Subreddit names
- Timestamps (posted date/time)
- Upvotes and engagement metrics
- NSFW flags
- Post types (link, text, image)

### Subreddit Discovery
- Auto-discovers subreddits from your posts
- Adds them to platform's subreddit library
- Fetches subreddit rules and metadata
- Calculates posting frequency per subreddit

### Analytics Generated
- Title analysis (length, keywords, emoji usage)
- Posting cadence and consistency
- Optimal posting times
- Engagement trends
- Subreddit recommendations

## Known Limitations

1. **Reddit API Rate Limits**
   - Quick sync: Safe for frequent use
   - Deep/Full sync: Recommended max 1x per day per user

2. **Historical Data**
   - Limited to Reddit's API history (typically 1000 posts max)
   - Deleted posts won't be synced
   - Private/removed posts excluded

3. **Processing Time**
   - Runs as background job (non-blocking)
   - User can continue using app while sync runs
   - Status updates via polling

## Error Scenarios to Test

### No Reddit Account
- **Expected**: Error message "No active Reddit account found"
- **Action**: Prompt user to connect Reddit account first

### Token Expired
- **Expected**: Automatic token refresh attempt
- **Fallback**: Prompt to reconnect if refresh fails

### Tier Restriction
- **Expected**: 403 error with upgrade message
- **Action**: Show tier requirement (Pro or Premium)

### API Rate Limit Hit
- **Expected**: Graceful error with retry suggestion
- **Action**: Show "Try again in X minutes" message

## API Endpoints Reference

```typescript
// Check sync status
GET /api/reddit/sync/status
Response: { lastSyncAt: string | null, postCount: number, subredditCount: number }

// Start quick sync
POST /api/reddit/sync/quick
Response: { message: string, jobId: string, estimatedTime: string, syncType: 'quick' }

// Start deep sync (Pro+)
POST /api/reddit/sync/deep
Response: { message: string, jobId: string, estimatedTime: string, syncType: 'deep' }

// Start full sync (Premium)
POST /api/reddit/sync/full
Response: { message: string, jobId: string, estimatedTime: string, syncType: 'full' }

// Check job status
GET /api/reddit/sync/job/:jobId
Response: { status: 'queued' | 'processing' | 'completed' | 'failed', progress?: number }
```

## Troubleshooting

### Sync Not Starting
1. Verify Reddit account is connected: `/settings`
2. Check network tab for API errors
3. Verify tier requirements met
4. Check server logs: `POST /api/reddit/sync/*` endpoint

### No Data After Sync
1. Check sync actually completed (not just queued)
2. Verify Reddit account has posting history
3. Check `reddit_post_outcomes` table in database
4. Look for errors in server logs

### Slow Performance
1. Quick sync should complete in ~30s
2. Deep/Full sync can take 2-10 minutes
3. Check background worker is running: `cron-runner.ts`
4. Verify queue processing (Redis or PostgreSQL)

## Database Tables Populated

- `reddit_post_outcomes` - Individual post data
- `reddit_communities` - Discovered subreddits
- `user_analytics` - Aggregated insights
- Sync metadata stored in user records

## Success Criteria for Beta

✅ User can complete quick sync without errors
✅ Post count increases after sync
✅ Subreddit dropdown populates with discovered communities
✅ Analytics pages show meaningful insights
✅ Tier restrictions work correctly
✅ Re-syncing updates existing data (no duplicates)
✅ Error messages are clear and actionable

## Reporting Issues

When reporting bugs, please include:
1. User tier (Free/Starter/Pro/Premium)
2. Sync type attempted (Quick/Deep/Full)
3. Error message received
4. Browser console errors (F12 → Console tab)
5. Expected vs actual behavior

## Production Logs Location

Render service: `srv-d3m1ddemcj7s73ab7v7g`
Filter for: "sync" OR "reddit-sync" OR "RedditSyncService"

---

**Last Updated**: 2025-10-30
**Status**: Production Ready - Beta Testing Phase
**Contact**: Development team for issues/feedback
