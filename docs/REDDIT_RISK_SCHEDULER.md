# Reddit Risk Evaluation & Scheduling System

## Overview
Intelligent risk detection system that prevents post removals by analyzing posting cadence, moderator history, and subreddit rules before publication.

## Components Implemented

### **Backend**
1. **`/app/api/reddit/_lib/risk-evaluator.ts`** - Core risk analysis engine
   - Detects cooldown conflicts (72-hour default, custom per subreddit)
   - Tracks recent removals and flags high-risk patterns
   - Evaluates subreddit rules (promo links, watermarks, original content)
   - Stores risk snapshots in analytics for trend tracking

2. **`/app/api/reddit/risk/route.ts`** - Risk API endpoint
   - Tier-based rate limiting (free: 2/hr, pro: 10/hr, premium: 20/hr)
   - 24-hour caching with force refresh option
   - Returns warnings, stats, and rate limit metadata

### **Frontend**
1. **`/app/(dashboard)/posting/schedule/page.tsx`** - Next.js server component
   - Pre-fetches risk summary on page load
   - Passes data to client component

2. **`/app/(dashboard)/posting/schedule/schedule-client.tsx`** - Interactive UI
   - Color-coded severity banners (high/medium/low risk)
   - 4-stat overview dashboard (upcoming posts, cooldown conflicts, removals, flagged subs)
   - Actionable warning cards with metadata
   - Toast notifications for actions
   - Cached vs fresh data indicators

3. **`/app/(dashboard)/posting/schedule/types.ts`** - TypeScript definitions

### **Testing**
- **`/tests/unit/app/api/reddit/risk-evaluator.test.ts`** - Vitest unit tests
  - Cooldown conflict detection
  - Removal warning generation
  - Rule-based warnings

## Features

### **Risk Detection Types**
1. **Cadence Warnings** - Posts scheduled too close together
   - High risk: < 24 hours apart
   - Medium risk: 24-72 hours apart
   - Low risk: Violates custom cooldown rules

2. **Removal Warnings** - Recent moderator actions
   - High risk: 3+ recent removals
   - Medium risk: 2 removals
   - Low risk: 1 removal

3. **Rule Warnings** - Subreddit policy violations
   - High risk: Promotional links banned
   - Medium risk: Limited promos, original content required
   - Low risk: Watermark restrictions

### **Smart Features**
- **Automatic caching** - 24-hour cache, force refresh available
- **Rate limiting** - Prevents API abuse, tier-based quotas
- **Analytics integration** - Risk scores stored for trend analysis
- **Contextual actions** - Each warning has actionable buttons

### **UI Highlights**
- **Severity-based styling** - Red (high), amber (medium), blue (low)
- **Stats dashboard** - Quick overview of posting health
- **Toast system** - Non-blocking notifications for actions
- **Empty/error states** - Graceful handling of edge cases
- **Loading skeletons** - Progressive enhancement

## Usage

### Access the scheduler:
```
/dashboard/posting/schedule
```

### API endpoints:
```typescript
// Get risk warnings (cached)
GET /api/reddit/risk

// Force refresh
GET /api/reddit/risk?refresh=true

// Extended history (90 days vs 30)
GET /api/reddit/risk?includeHistory=true
```

### Rate limits by tier:
- **Free**: 2 checks/hour
- **Starter**: 4 checks/45min
- **Pro**: 10 checks/30min
- **Premium**: 20 checks/15min

## Integration Points

### Database tables used:
- `scheduled_posts` - Upcoming posts to check
- `reddit_post_outcomes` - Historical mod actions
- `content_flags` - Internal flagging system
- `subreddit_rules` - Community policies
- `analytics_metrics` - Risk score tracking

### State management:
- Uses `stateStore` for caching and rate limiting
- Memory-based with TTL expiration
- Redis-ready architecture

## Next Steps

1. **Run migration** - Database schema already supports all features
2. **Test locally** - Schedule some posts and view risk warnings
3. **Integrate with posting flow** - Add risk checks before submission
4. **Monitor analytics** - Track risk score trends over time

## Architecture Benefits

✅ **Proactive prevention** - Catch issues before posting  
✅ **Testable design** - Dependency injection for unit tests  
✅ **Performance optimized** - Caching + rate limiting  
✅ **Tier-aware** - Different limits per subscription level  
✅ **Analytics-ready** - Stores risk metrics for reporting  
✅ **Extensible** - Easy to add new warning types  

All TypeScript checks passed. System ready for deployment.
