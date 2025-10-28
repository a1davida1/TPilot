# Analytics Aggregation System

## Overview

Fully implemented analytics aggregation system that populates the analytics dashboard with real data.

## What's Been Implemented

### 1. Analytics Aggregation Service (`server/services/analytics-aggregation.ts`)

Aggregates raw data into daily analytics tables:

**Content Performance Metrics:**
- Aggregates from `reddit_post_outcomes` and `scheduled_posts`
- Calculates: views, upvotes, engagement rates, performance by subreddit
- Writes to: `analyticsContentPerformanceDaily`

**AI Usage Metrics:**
- Aggregates from `caption_variants` and `content_generations`
- Calculates: generation counts, model breakdowns
- Writes to: `analyticsAiUsageDaily`

### 2. Cron Jobs (Updated in `server/lib/scheduler/cron-manager.ts`)

**New/Updated Cron Jobs:**

| Job Name | Schedule | Purpose |
|----------|----------|---------|
| `aggregate-daily-analytics` | Daily at 2 AM | Aggregate yesterday's data into analytics tables |
| `update-current-day-analytics` | Every hour | Update today's running totals for real-time data |
| `process-scheduled-posts` | Every minute | Process due scheduled posts (existing) |
| `cleanup-old-posts` | Daily at 3 AM | Clean up old completed posts (existing) |
| `check-stuck-jobs` | Every 5 minutes | Recover stuck jobs (existing) |

### 3. Backfill CLI Tool (`server/bin/backfill-analytics.ts`)

For populating historical data or fixing gaps:

```bash
# Backfill last 30 days
npm run backfill:analytics -- --days 30

# Backfill specific date range
npm run backfill:analytics -- --start 2025-01-01 --end 2025-01-31
```

## How It Works

### Daily Aggregation Flow (2 AM)

```
1. Cron job triggers aggregateDailyAnalytics()
2. Service fetches yesterday's data from:
   - reddit_post_outcomes (views, upvotes, success)
   - caption_variants (AI generations)
   - content_generations (AI generations)
3. Aggregates by user, subreddit, date
4. Calculates:
   - Engagement rates
   - View totals
   - Generation counts
   - Model breakdowns
5. Writes to analytics_content_performance_daily
6. Writes to analytics_ai_usage_daily
```

### Hourly Updates (Every hour)

```
1. Cron job triggers updateCurrentDayAnalytics()
2. Aggregates TODAY's data so far
3. Updates current day records
4. Provides real-time analytics
```

## Data Sources

### Content Performance
- **Primary**: `reddit_post_outcomes` table
  - success, upvotes, views, title, subreddit
- **Secondary**: `scheduled_posts` table
  - Links to Reddit post data

### AI Usage
- **Primary**: `caption_variants` table
  - Caption generations with metadata
- **Secondary**: `content_generations` table
  - Content generation records

## Analytics Tables

### `analyticsContentPerformanceDaily`
```sql
user_id | content_id | platform | subreddit | primary_title | day |
total_views | unique_viewers | social_views | likes | comments | shares | engagement_rate
```

### `analyticsAiUsageDaily`
```sql
user_id | day | generation_count | model_breakdown (JSONB)
```

Model breakdown format:
```json
[
  {"model": "grok-4-fast", "count": 45},
  {"model": "openai-fallback", "count": 5}
]
```

## Usage

### Automatic (Production)
✅ **Already running!** Cron jobs start automatically when app boots.

Check logs for:
```
📊 Aggregating daily analytics for yesterday
📊 Updating current day analytics metrics
✅ Daily analytics aggregation complete
```

### Manual Backfill (One-time Setup)

If you have historical data and want to populate analytics:

```bash
# Backfill last 7 days
npm run backfill:analytics -- --days 7

# Backfill last 30 days
npm run backfill:analytics -- --days 30

# Backfill specific range
npm run backfill:analytics -- --start 2025-01-01 --end 2025-10-27
```

## Monitoring

### Health Check
```bash
curl https://your-app.onrender.com/api/health
```

Should show cron job status including:
- `aggregate-daily-analytics`
- `update-current-day-analytics`

### View Logs
In Render Dashboard → Your Service → Logs

Look for:
```
📊 Aggregating content performance (date: 2025-10-27)
📈 Found 15 content performance records to aggregate
✅ Content performance aggregation complete (recordsProcessed: 15)
🤖 Aggregating AI usage (date: 2025-10-27)
🤖 Found 3 users with AI usage to aggregate
✅ AI usage aggregation complete (usersProcessed: 3, totalGenerations: 42)
```

### Check Data
```bash
# Connect to database
psql $DATABASE_URL

# Check content performance data
SELECT * FROM analytics_content_performance_daily
ORDER BY day DESC LIMIT 10;

# Check AI usage data
SELECT * FROM analytics_ai_usage_daily
ORDER BY day DESC LIMIT 10;
```

## Troubleshooting

### No Data in Analytics Tables

**Problem**: Tables are empty after deployment

**Solution**: Run backfill to populate historical data
```bash
npm run backfill:analytics -- --days 30
```

### Cron Jobs Not Running

**Problem**: No analytics logs appearing

**Check**:
1. Cron manager started: Look for "Cron manager started" in logs
2. Queue system initialized: Look for "Queue system initialized"
3. App is running: Check `/api/health` endpoint

**Fix**: Restart the app to ensure cron manager starts

### Gaps in Data

**Problem**: Missing days in analytics

**Solution**: Backfill the missing range
```bash
npm run backfill:analytics -- --start 2025-10-15 --end 2025-10-20
```

### Duplicate Records

**Problem**: Same day appears multiple times

**Cause**: Backfill ran multiple times

**Fix**: Already handled! The aggregation service uses UPSERT logic:
- If record exists → UPDATE
- If record doesn't exist → INSERT

Running backfill multiple times is safe!

## Future Enhancements

Potential improvements:

1. **Track Model Usage Accurately**
   - Currently estimates 80% Grok, 20% fallback
   - Could track actual API calls in real-time

2. **Add More Metrics**
   - Comment counts (requires Reddit API calls)
   - Share counts (not available from Reddit)
   - Time spent (not available from Reddit)

3. **Performance Optimization**
   - Batch inserts for large backfills
   - Parallel processing of date ranges
   - Incremental aggregation (only new data)

4. **Alerting**
   - Slack/Discord notifications on failures
   - Email summaries of daily aggregations
   - Performance threshold alerts

## Architecture Decisions

### Why Daily Aggregation at 2 AM?

- **Complete data**: Wait for late-night posts to finish
- **Off-peak**: Minimize impact on user traffic
- **Before cleanup**: Runs before 3 AM cleanup job
- **Consistent timezone**: Always UTC 2 AM

### Why Hourly Current Day Updates?

- **Real-time feel**: Dashboard shows today's activity
- **Minimal cost**: Only processes current day
- **User experience**: No waiting until next day to see results

### Why Separate Cron Jobs?

- **Reliability**: One failure doesn't affect others
- **Monitoring**: Clear logs per job
- **Debugging**: Easy to identify issues
- **Flexibility**: Can disable/adjust individual jobs

## Related Files

- **Service**: `server/services/analytics-aggregation.ts`
- **Cron Manager**: `server/lib/scheduler/cron-manager.ts`
- **CLI Tool**: `server/bin/backfill-analytics.ts`
- **Schema**: `shared/schema.ts` (analytics tables)
- **Insights Service**: `server/services/analytics-insights.ts` (reads aggregated data)
