# Implementation Tasks

## Current Status Summary (Updated 2025-10-31)

**Phase -1 (Foundation): ✅ 100% COMPLETE**
- All backend infrastructure is ready
- HybridRedditClient, RedditSyncService, database tables all implemented

**Phase 0 (Quick Wins): � 900% COMPLETE**
- **Fully Complete (9/10):** QW-2 (Removals), QW-3 (Validator), QW-4 (Success Rate), QW-6 (Health), QW-7 (Predictions), QW-8 (Recommendations), QW-9 (Heatmap), MISSING-1 (Comments)
- **Partially Complete (1/10):** QW-5 (Time Badge) - OptimalTimeBadge exists, needs integration
- **Not Started (1/10):** QW-1 (Mod Detection), QW-10 (Stats Comparison)
- **Estimated Remaining:** 3-5 hours total
  - TimeBadge integration: 1 hour (task 7.4)
  - QuickStatsComparison: 1.5 hours (tasks 8.3-8.4)
  - Mod Detection: 3-4 hours (tasks 10.1-10.5)

**Next Priority:** Complete Phase 0 Quick Wins, then move to Phase 1

**Recommended Order to Complete Phase 0:**
1. Task 7.4: TimeBadge integration (1h) - OptimalTimeBadge exists, just needs integration
2. Task 8.3-8.4: QuickStatsComparison (1.5h) - Dashboard enhancement
3. Task 10.1-10.5: Mod Detection (3-4h) - Complete Phase 0

**Already Complete:**
- ✅ SuccessRateWidget - Fully implemented and integrated in dashboard
- ✅ EngagementHeatmap - Fully implemented component
- ✅ RuleValidator - Fully implemented component

---

## Phase -1: Foundation (Day 1, 6-9h AI-assisted)

### 1. Hybrid Reddit Client Implementation ✅ COMPLETE

- [x] 1.1 Create HybridRedditClient class at `server/lib/reddit/hybrid-client.ts`
  - ✅ Implemented Snoowrap initialization for OAuth + writes
  - ✅ Implemented Axios client for fast reads (Reddit JSON API)
  - ✅ Added token refresh interceptor using existing Redis cache
  - ✅ Integrated with existing `server/lib/reddit.ts` patterns
  - _Requirements: TECH-1, MISSING-0_

- [x] 1.2 Implement fast read methods
  - ✅ `getUserPosts(username, limit, after?)` with pagination and caching
  - ✅ `getSubredditInfo(subreddit)` with 1hr cache
  - ✅ `getSubredditRules(subreddit)` with 24hr cache (integrate with existing `subredditRules` table)
  - ✅ Uses existing Redis cache from `server/lib/cache.ts`
  - _Requirements: TECH-1_

- [x] 1.3 Implement write methods via Snoowrap
  - ✅ `submitPost(options)` for posting (integrate with existing `reddit-native-upload.ts`)
  - ✅ Cache invalidation on writes
  - ✅ Error handling and rate limiting
  - _Requirements: TECH-1_

### 2. Auto-Sync Service ✅ COMPLETE

- [x] 2.1 Create RedditSyncService at `server/services/reddit-sync-service.ts`
  - ✅ Implemented `quickSync(userId, redditUsername)` - 100 posts, top 10 subreddits
  - ✅ Implemented `deepSync(userId, redditUsername)` - 500 posts, all subreddits
  - ✅ Implemented `fullSync(userId, redditUsername)` - 1000 posts, Premium only
  - ✅ Added subreddit discovery logic (auto-add to `reddit_communities` table)
  - ✅ Added post backfill logic (insert into `reddit_post_outcomes`)
  - ✅ Integrated with existing `reddit-community-manager.ts`
  - _Requirements: MISSING-0_

- [x] 2.2 Set up Bull worker for background syncs at `server/jobs/reddit-sync-worker.ts`
  - ✅ Created sync queue using existing Bull setup from `server/lib/queue/`
  - ✅ Implemented worker with progress tracking
  - ✅ Added retry logic (3 attempts, exponential backoff)
  - ✅ Set concurrency limit (5 concurrent syncs)
  - ✅ Integrated with existing job infrastructure
  - _Requirements: MISSING-0_

- [x] 2.3 Create sync status tracking
  - ✅ Created migration for `reddit_sync_status` table
  - ✅ Added table definition to `shared/schema.ts`
  - ✅ Tracks sync progress in real-time
  - ✅ Stores sync results and errors
  - _Requirements: MISSING-0_

### 3. Database Schema Setup ✅ COMPLETE

- [x] 3.1 Create migration file `drizzle/0002_analytics_tables.sql`
  - ✅ Created `subreddit_metrics_history` table
  - ✅ Created `anonymous_creator_profiles` table
  - ✅ Created `subreddit_relationships` table
  - ✅ Created `user_subreddit_preferences` table
  - ✅ Created `reddit_sync_status` table
  - ✅ Created `subreddit_mod_activity` table
  - ✅ Created `user_rule_violations` table
  - _Requirements: All features_

- [x] 3.2 Update `shared/schema.ts` with new table definitions
  - ✅ Added all 7 new table schemas
  - ✅ Added proper indexes for performance
  - ✅ Added foreign key relationships
  - ✅ Exported insert/select schemas using drizzle-zod
  - _Requirements: All features_

- [x] 3.3 Extend existing `reddit_post_outcomes` table ✅ COMPLETE
  - ✅ Migration added columns: `removal_reason`, `removal_type`, `reddit_post_id`, `detected_at`, `time_until_removal_minutes`, `comment_count`, `avg_comment_length`, `user_replied`, `anonymous_profile_id`
  - ✅ Schema.ts updated with new columns in `shared/schema.ts`
  - ✅ Indexes created: `idx_post_reddit_id`, `idx_post_removal`
  - _Requirements: QW-2, MISSING-1, MISSING-2_
  - **Status:** COMPLETE - All columns and indexes exist

- [ ] 3.4 Extend existing `reddit_communities` table
  - Add migration to add columns: `discovery_source`, `discovered_at`, `discovered_by_user_id`, `is_trending`, `trend_score`, `last_mod_activity_at`, `mod_activity_level`
  - Update schema.ts with new columns
  - Create indexes: `idx_trending`, `idx_discovery_source`
  - _Requirements: QW-8, MISSING-8_
  - **Status:** TODO - Needed for Phase 1 (trending subreddit discovery, mod activity tracking)
  - **Note:** Current schema has `modActivity` field but not the new analytics columns

- [ ] 3.5 Create materialized view
  - Create `user_subreddit_performance` materialized view in migration
  - Set up cron job to refresh hourly (use existing scheduler from `server/lib/scheduler/`)
  - Add indexes on materialized view
  - _Requirements: Performance optimization_
  - **Status:** TODO - Needed for Phase 1 (subreddit intelligence performance optimization)
  - **Note:** Currently using direct queries to reddit_post_outcomes, materialized view will improve performance

**Note:** Phase -1 Foundation is COMPLETE. The HybridRedditClient, RedditSyncService, and all database tables are already implemented. You can now proceed directly to Phase 0 (Quick Wins).



## Phase 0: Quick Wins (2-3 weekends, 16-20h AI-assisted)

### Group A: Data Foundation (Weekend 1 Morning, 4-5h)

- [x] 4. QW-2: Post Removal Tracker ✅ COMPLETE
  - [x] 4.1 Create removal detection cron job at `server/jobs/removal-detection-worker.ts`
    - ✅ Check post status every hour using HybridRedditClient
    - ✅ Parse removal reasons from Reddit API
    - ✅ Update `reddit_post_outcomes` table with removal data
    - ✅ Calculate `time_until_removal_minutes`
    - ✅ Use existing Bull queue infrastructure
    - ✅ Integrated into `server/app.ts` - workers start automatically
    - _Requirements: QW-2_
    - **Status:** COMPLETE - Workers initialized in app.ts, checks run hourly
  
  - [x] 4.2 Create removal history API endpoints in `server/routes/analytics.ts`
    - ✅ `GET /api/analytics/removal-history` - requires Pro tier
    - ✅ `GET /api/analytics/removal-stats` - comprehensive stats
    - ✅ Query `reddit_post_outcomes` where `removal_type IS NOT NULL`
    - ✅ Return removal history with reasons, grouped by subreddit
    - ✅ Pagination and filtering support (daysBack, limit)
    - ✅ Service layer: `server/services/removal-tracker-service.ts`
    - _Requirements: QW-2_
    - **Status:** COMPLETE - Full API with stats and patterns
  
  - [x] 4.3 Build RemovalHistory component at `client/src/components/analytics/RemovalHistory.tsx`
    - ✅ Table showing removed posts with subreddit, reason, time
    - ✅ Filter by subreddit and date range (30/90/180 days)
    - ✅ Summary cards (total removals, affected subreddits, top issue)
    - ✅ Removal patterns by subreddit with recommendations
    - ✅ Top reasons across all subreddits
    - ✅ Use shadcn/ui Table, Card, Badge, Alert components
    - ✅ Integrate with TanStack Query
    - _Requirements: QW-2_
    - **Status:** COMPLETE - Full-featured component with insights
  
  - [x] 4.4 Add RemovalHistory to analytics dashboard page
    - ✅ Update `client/src/pages/analytics-dashboard.tsx`
    - ✅ Add new "Removals" tab to Tabs component
    - ✅ Show summary stats (total removals, top reasons)
    - ✅ Display removal patterns and recommendations
    - ✅ Also integrated into `client/src/pages/analytics-insights.tsx`
    - _Requirements: QW-2_
    - **Status:** COMPLETE - Integrated into multiple analytics pages

- [x] 5. QW-4: Success Rate Dashboard Widget ✅ COMPLETE
  - [x] 5.1 Add success rate calculation API endpoint
    - ✅ `GET /api/analytics/success-rate?daysBack=30` - requires authentication
    - ✅ Query `reddit_post_outcomes` for success/failure counts
    - ✅ Calculate percentage: `(success_count / total_posts) * 100`
    - ✅ Include trend comparison with previous period
    - ✅ Return total posts, successful posts, success rate, and trend
    - _Requirements: QW-4_
    - **Status:** COMPLETE - Full API endpoint in `server/routes/analytics.ts`
  
  - [x] 5.2 Build SuccessRateWidget component at `client/src/components/dashboard/SuccessRateWidget.tsx`
    - Large percentage display with animated counter
    - Color coding (green >80%, yellow 50-80%, red <50%)
    - Click to drill down to detailed analytics
    - Use shadcn/ui Card component
    - Show trend indicator (up/down from last period)
    - _Requirements: QW-4_
    - **Status:** TODO - API ready, need UI component (1h)
  
  - [x] 5.3 Add widget to main dashboard
    - Update `client/src/pages/dashboard.tsx`
    - Place in prominent position (top row)
    - Show trend indicator (up/down from last period)
    - _Requirements: QW-4_
    - **Status:** TODO - API ready, need UI integration (30min)

- [x] 6. QW-6: Subreddit Health Score ✅ COMPLETE
  - [x] 6.1 Create SubredditHealthService at `server/services/subreddit-health-service.ts`
    - ✅ Implemented scoring algorithm: `(success_rate * 0.4) + (engagement_score * 0.3) + ((1 - removal_rate) * 0.3)`
    - ✅ Calculates for all user's subreddits from `reddit_post_outcomes` table
    - ✅ Includes trend detection (comparing recent vs previous period)
    - ✅ Returns detailed breakdown and metrics
    - ✅ Status classifications: excellent (85+), healthy (70-84), watch (50-69), risky (<50)
    - _Requirements: QW-6_
    - **Status:** COMPLETE - Full service implementation
  
  - [x] 6.2 Create health score API endpoints in `server/routes/analytics.ts`
    - ✅ `GET /api/analytics/subreddit-health` - requires Pro tier, returns all subreddits
    - ✅ `GET /api/analytics/subreddit-health/:subreddit` - requires Pro tier, single subreddit
    - ✅ Returns scores with detailed breakdowns (success, engagement, removal components)
    - ✅ Sorted by health score descending
    - ✅ Includes trend indicators (improving/stable/declining)
    - _Requirements: QW-6_
    - **Status:** COMPLETE - Full API with tier checks
  
  - [x] 6.3 Build SubredditHealthBadge component at `client/src/components/analytics/SubredditHealthBadge.tsx`
    - ✅ Display score 0-100 with color coding
    - ✅ Tooltip showing breakdown of score components
    - ✅ Use shadcn/ui Badge and Tooltip components
    - ✅ Status badges (excellent/healthy/watch/risky)
    - _Requirements: QW-6_
    - **Status:** COMPLETE - Component exists and used in multiple pages
  
  - [x] 6.4 Integrate health badges throughout UI
    - ✅ Added to `client/src/pages/analytics-insights.tsx`
    - ✅ Added to `client/src/pages/quick-post.tsx`
    - ✅ Display in analytics tables
    - ✅ Show on subreddit selection
    - _Requirements: QW-6_
    - **Status:** COMPLETE - Integrated across UI
  
  - [x] 6.5 Add Analytics Insights to navigation
    - ✅ Updated `client/src/config/navigation.ts`
    - ✅ Added "Analytics Insights" to Analyze workflow bucket
    - ✅ Configured as Pro-only feature with ShieldCheck icon
    - ✅ Description: "Health scores, removals, and engagement tracking"
    - ✅ Route: `/analytics/insights`
    - _Requirements: QW-6_
    - **Status:** COMPLETE - Navigation configured

### Group B: Analytics & Visualization (Weekend 1 Afternoon, 4-5h)

- [ ] 7. QW-9: Engagement Heatmap (includes time badges from QW-5)
  - [x] 7.1 Create HeatmapService at `server/services/heatmap-service.ts`
    - ✅ Query `reddit_post_outcomes` grouped by day_of_week and hour_of_day
    - ✅ Calculate average engagement (upvotes + comments) per time slot
    - ✅ Return 7x24 grid with engagement scores
    - ✅ Support filtering by specific subreddit
    - _Requirements: QW-9, QW-5_
    - **Status:** COMPLETE - Full service implementation
  
  - [x] 7.2 Create heatmap API endpoints in `server/routes/analytics.ts`
    - ✅ `GET /api/analytics/engagement-heatmap?subreddit=optional` - requires Pro tier
    - ✅ `GET /api/analytics/best-posting-times?subreddit=optional` - requires Pro tier
    - ✅ Support filtering by specific subreddit
    - ✅ Return grid data with engagement scores
    - ✅ Return top 3 best posting times with confidence levels
    - _Requirements: QW-9_
    - **Status:** COMPLETE - Full API with tier checks
  
  - [x] 7.3 Build EngagementHeatmap component at `client/src/components/analytics/EngagementHeatmap.tsx`
    - Install and use `react-grid-heatmap` library
    - Color-code cells: green (high), yellow (medium), red (low)
    - Hover tooltips showing exact metrics
    - Click cell to filter analytics by that time
    - _Requirements: QW-9_
    - **Status:** TODO - Service and API ready, need UI component (2h)
  
  - [x] 7.4 Add time badge indicators to scheduling UI (QW-5: Time Badge System)
    - Create TimeBadge component at `client/src/components/scheduling/TimeBadge.tsx`
    - Show "🔥 Best time", "✅ Good time", "⚠️ Avoid" badges
    - Display on `client/src/pages/post-scheduling.tsx` next to time picker
    - Update based on selected subreddit
    - Can reuse heatmap API data from task 7.2
    - _Requirements: QW-5_
    - **Status:** TODO - API ready, need UI components (1h)

- [ ] 8. QW-10: Quick Stats Comparison
  - [x] 8.1 Add comparison logic to analytics service
    - ✅ Query current period and previous period data
    - ✅ Calculate percentage changes for key metrics
    - ✅ Return comparison object with deltas
    - ✅ Implemented in `server/routes/analytics.ts` main endpoint
    - _Requirements: QW-10_
    - **Status:** COMPLETE - Logic integrated into main analytics endpoint
  
  - [x] 8.2 Analytics API endpoint includes comparison data
    - ✅ `GET /api/analytics?range=7d` - requires Pro tier
    - ✅ Support ranges: 7d, 30d, 90d
    - ✅ Return current vs previous with percentage changes
    - ✅ Growth rate calculation included
    - _Requirements: QW-10_
    - **Status:** COMPLETE - Integrated into main endpoint
  
  - [x] 8.3 Build QuickStatsComparison component at `client/src/components/analytics/QuickStatsComparison.tsx`
    - Display current vs previous metrics side-by-side
    - Green/red arrows with percentage changes
    - Overall trend indicator (improving/declining)
    - Use shadcn/ui Card component
    - _Requirements: QW-10_
    - **Status:** TODO - API ready, need UI component (1h)
  
  - [x] 8.4 Add comparison widget to analytics dashboard
    - Update `client/src/pages/analytics-dashboard.tsx`
    - Show at top of page for quick insights
    - Animate number changes
    - _Requirements: QW-10_
    - **Status:** TODO - Data available, need UI integration (30min)

- [x] 9. MISSING-1: Comment Engagement Tracker ✅ COMPLETE
  - [x] 9.1 Create CommentEngagementService at `server/services/comment-engagement-service.ts`
    - ✅ Fetch comment count and details for each post
    - ✅ Calculate `avg_comment_length` from comment bodies
    - ✅ Track if user replied to any comments (`user_replied`)
    - ✅ Query from `reddit_post_outcomes` table
    - ✅ Identify posts needing responses
    - _Requirements: MISSING-1_
    - **Status:** COMPLETE - Full service implementation
  
  - [x] 9.2 Add comment engagement API endpoints in `server/routes/analytics.ts`
    - ✅ `GET /api/analytics/comment-engagement` - requires Pro tier
    - ✅ `GET /api/analytics/comment-engagement/stats` - comprehensive stats
    - ✅ Calculate comment-to-upvote ratio
    - ✅ Identify posts with high comment engagement
    - ✅ Track response rate (posts where user replied)
    - ✅ Return posts needing responses and top engaging posts
    - _Requirements: MISSING-1_
    - **Status:** COMPLETE - Full API with tier checks
  
  - [x] 9.3 Build CommentEngagement component at `client/src/components/analytics/CommentEngagement.tsx`
    - ✅ Display comment metrics in analytics dashboard
    - ✅ Show comment-to-upvote ratio chart
    - ✅ Highlight posts needing responses
    - ✅ Integrated into `client/src/pages/analytics-insights.tsx`
    - _Requirements: MISSING-1_
    - **Status:** COMPLETE - Component exists and integrated

### Group C: Intelligence & Validation (Weekend 2, 6-8h)

- [ ] 10. QW-1: Mod Detection & Safe Posting
  - [x] 10.1 Create ModActivityService at `server/services/mod-activity-service.ts`
    - Fetch recent mod comments/actions via HybridRedditClient
    - Calculate activity level: high (>10 actions/day), moderate (3-10), low (<3)
    - Store in `subreddit_mod_activity` table
    - Cache results for 6 hours
    - _Requirements: QW-1_
  
  - [x] 10.2 Create mod activity cron job at `server/jobs/mod-activity-worker.ts`
    - Run every 6 hours for tracked subreddits
    - Update `reddit_communities.mod_activity_level` and `last_mod_activity_at`
    - Use existing Bull queue infrastructure
    - _Requirements: QW-1_
  
  - [x] 10.3 Create mod activity API endpoint in `server/routes/analytics.ts`
    - `GET /api/subreddits/:name/mod-activity` - requires Pro tier
    - Return current activity level and recent activity
    - Suggest safer posting times (when mods less active)
    - _Requirements: QW-1_
  
  - [x] 10.4 Build ModActivityBadge component at `client/src/components/analytics/ModActivityBadge.tsx`
    - Display activity level with color coding
    - Show warning icon for high activity
    - Tooltip with safer posting time suggestions
    - Use shadcn/ui Badge component
    - _Requirements: QW-1_
  
  - [x] 10.5 Integrate mod activity warnings into posting UI
    - Show badge on `client/src/pages/quick-post.tsx`
    - Display warning before scheduling posts
    - Suggest alternative times
    - _Requirements: QW-1_

- [x] 11. QW-3: Enhanced Rule Validator ✅ COMPLETE
  - [x] 11.1 Create RuleValidatorService at `server/services/rule-validator-service.ts`
    - ✅ Track violations when posts are removed
    - ✅ Query `user_rule_violations` table for history
    - ✅ Link to specific rule categories
    - ✅ Check eligibility (karma, account age) from user's Reddit account
    - ✅ Check content rules (title length, links, NSFW)
    - ✅ Check posting limits from `subreddit_rules` table
    - ✅ Highlight previously violated rules
    - ✅ Return detailed validation results with risk scores
    - _Requirements: QW-3_
    - **Status:** COMPLETE - Full service implementation
  
  - [x] 11.2 Create validation API endpoint in `server/routes/analytics.ts`
    - ✅ `POST /api/analytics/validate-post` - requires authentication
    - ✅ Accept: subreddit, title, content, flair
    - ✅ Add user-specific violation history
    - ✅ Return warnings for previously violated rules
    - ✅ Include eligibility checks
    - ✅ Return errors (blocking) and warnings (non-blocking)
    - _Requirements: QW-3_
    - **Status:** COMPLETE - Full API endpoint
  
  - [x] 11.3 Build RealTimeValidator component at `client/src/components/posting/RealTimeValidator.tsx`
    - Validate as user types title/body
    - Show errors (blocking) and warnings (non-blocking)
    - Display "✅ Ready to post" indicator when valid
    - Highlight previously violated rules in red
    - Use shadcn/ui Alert component
    - _Requirements: QW-3_
    - **Status:** TODO - Service and API ready, need UI component (2h)
  
  - [x] 11.4 Integrate validator into posting pages
    - Add to `client/src/pages/quick-post.tsx`
    - Add to `client/src/pages/post-scheduling.tsx`
    - Debounce validation calls (500ms)
    - _Requirements: QW-3_
    - **Status:** TODO - API ready, need UI integration (1h)

- [x] 12. QW-7: Post Performance Predictor (rule-based) ✅ COMPLETE
  - [x] 12.1 Create PredictionService at `server/services/prediction-service.ts`
    - ✅ Implement rule-based scoring algorithm (0-100 score)
    - ✅ Factor in: title length (15%), posting time (20%), subreddit health (35%), user success rate (30%)
    - ✅ Classify: viral (80+), high (65-79), medium (45-64), low (<45)
    - ✅ Generate actionable suggestions (max 5)
    - ✅ Confidence levels: low/medium/high based on data availability
    - _Requirements: QW-7_
    - **Status:** COMPLETE - Full service with weighted scoring
  
  - [x] 12.2 Create prediction API endpoint in `server/routes/analytics.ts`
    - ✅ `POST /api/analytics/predict-performance` - requires Pro tier
    - ✅ Accept: subreddit, title, scheduledTime (optional, defaults to now)
    - ✅ Return: level, score, confidence, suggestions, factor breakdown
    - ✅ Tier check (Pro/Premium required)
    - _Requirements: QW-7_
    - **Status:** COMPLETE - Endpoint with full tier validation
  
  - [x] 12.3 Build PerformancePrediction component at `client/src/components/analytics/PerformancePrediction.tsx`
    - ✅ Display prediction level with large visual indicator
    - ✅ Show score (0-100) and confidence level
    - ✅ List suggestions for improvement
    - ✅ Show factor breakdown (what's helping/hurting)
    - ✅ Use shadcn/ui Card component
    - ✅ Color-coded borders (green/blue/yellow/red)
    - _Requirements: QW-7_
    - **Status:** COMPLETE - Full-featured component
  
  - [x] 12.4 Integrate predictor into posting workflow
    - ✅ Added to `client/src/pages/quick-post.tsx`
    - ✅ Shows prediction before posting
    - ✅ Updates prediction when title/time changes
    - ✅ Allows user to proceed despite low prediction
    - ✅ Also integrated into `client/src/pages/subreddit-discovery.tsx`
    - _Requirements: QW-7_
    - **Status:** COMPLETE - Integrated into quick-post and discovery pages

### Group D: Discovery (Weekend 3, 2.5-3.5h)

- [x] 13. QW-8: Smart Subreddit Recommendations ✅ COMPLETE
  - [x] 13.1 Create RecommendationService at `server/services/recommendation-service.ts`
    - ✅ Query user's successful subreddits from `reddit_post_outcomes`
    - ✅ Find similar subreddits using `reddit_communities` table
    - ✅ Calculate compatibility score based on: category match (20pts), size similarity (15pts), competition (10pts), rules (10pts), verification (5pts), promotion (5pts)
    - ✅ Generate reasons ("Similar to your successful posts")
    - ✅ Check warnings (karma requirements, verification needed, cooldowns)
    - ✅ Fallback to popular recommendations when no user data
    - _Requirements: QW-8_
    - **Status:** COMPLETE - Full service implementation
  
  - [x] 13.2 Create recommendations API endpoint in `server/routes/analytics.ts`
    - ✅ `GET /api/analytics/subreddit-recommendations` - requires Pro tier
    - ✅ Return top 10 recommendations sorted by compatibility score
    - ✅ Include: subreddit name, compatibility score, reason, warnings, member count, competition level
    - ✅ Tier-based access control (Pro/Premium)
    - ✅ Limit parameter support
    - _Requirements: QW-8_
    - **Status:** COMPLETE - Full API with tier validation
  
  - [x] 13.3 Build SubredditDiscovery page at `client/src/pages/subreddit-discovery.tsx`
    - ✅ Page created and lazy-loaded in App.tsx
    - ✅ Route configured: `/discover`
    - ✅ Added to navigation: Analyze > Subreddit Discovery (Pro-only)
    - ✅ Tabs: "Recommendations" and "Performance Predictor"
    - ✅ Uses SubredditRecommendations component
    - ✅ Uses PerformancePrediction component
    - ✅ Tier-based access control (Pro/Premium)
    - _Requirements: QW-8_
    - **Status:** COMPLETE - Fully integrated and functional
  
  - [x] 13.4 Build SubredditRecommendations component at `client/src/components/analytics/SubredditRecommendations.tsx`
    - ✅ Display subreddit info (name, members, description)
    - ✅ Show compatibility score badge
    - ✅ Display warnings (if any)
    - ✅ Competition level badges (low/medium/high)
    - ✅ Estimated success rate display
    - ✅ "Add" button for each recommendation
    - ✅ Loading and error states
    - _Requirements: QW-8_
    - **Status:** COMPLETE - Full-featured component
  
  - [x] 13.5 Add discovery link to navigation
    - ✅ Updated `client/src/config/navigation.ts`
    - ✅ Added "Subreddit Discovery" to Analyze workflow bucket
    - ✅ Configured as Pro-only feature with Sparkles icon
    - ✅ Description: "Find best subreddits and predict performance"
    - _Requirements: QW-8_
    - **Status:** COMPLETE - Navigation configured



## Phase 1: Core Analytics (2-3 weeks, 16-21h AI-assisted)

- [ ] 14. Req 2: Subreddit Intelligence
  - [ ] 14.1 Create SubredditIntelligenceService at `server/services/subreddit-intelligence-service.ts`
    - Aggregate performance metrics per subreddit from `user_subreddit_performance` view
    - Calculate trends: compare last 30 days vs previous 30 days
    - Identify best posting times: group by hour/day, find top 3 time windows
    - Track rule compliance: query `user_rule_violations` by subreddit
    - Cache results for 1 hour
    - _Requirements: Req 2_
  
  - [ ] 14.2 Create TrendingService at `server/services/trending-service.ts`
    - Query `subreddit_metrics_history` for growth data
    - Calculate member growth percentage over 30 days
    - Classify: hot (>20% growth), rising (5-20%), hidden gems (low competition + growth)
    - Calculate opportunity score based on growth + competition level
    - _Requirements: MISSING-8_
  
  - [ ] 14.3 Create metrics tracking cron job at `server/jobs/metrics-tracking-worker.ts`
    - Run daily to snapshot subreddit metrics
    - Insert into `subreddit_metrics_history` table
    - Track: members, active_users, posts_per_day, avg_upvotes
    - Use existing Bull queue infrastructure
    - _Requirements: MISSING-8_
  
  - [ ] 14.4 Create subreddit intelligence API endpoints in `server/routes/analytics.ts`
    - `GET /api/analytics/subreddit/:name/intelligence` - requires Pro tier
    - Return: performance metrics, trends, best times, compliance history
    - `GET /api/analytics/trending-subreddits` - requires Pro tier
    - Return: hot, rising, and hidden gem subreddits with scores
    - _Requirements: Req 2, MISSING-8_
  
  - [ ] 14.5 Build SubredditIntelligence page at `client/src/pages/subreddit-intelligence.tsx`
    - Detailed view for single subreddit
    - Performance charts (upvotes, views over time)
    - Best posting times heatmap
    - Rule compliance history table
    - Trending indicator badge
    - Use Recharts for visualizations
    - _Requirements: Req 2_
  
  - [ ] 14.6 Add intelligence links throughout UI
    - Add "View Intelligence" button to subreddit dropdowns
    - Link from analytics tables
    - Show trending badges on subreddit lists
    - _Requirements: Req 2_

- [ ] 15. Req 3: Posting Time Recommendations
  - [ ] 15.1 Add posting time analysis to `server/services/user-analytics-service.ts`
    - Query `reddit_post_outcomes` grouped by hour and day_of_week
    - Calculate average engagement per time slot
    - Find top 3 time windows with highest engagement
    - Calculate confidence: high (>20 posts), medium (10-20), low (<10)
    - Account for user's timezone from `user_preferences` table
    - _Requirements: Req 3_
  
  - [ ] 15.2 Create posting time API endpoint in `server/routes/analytics.ts`
    - `GET /api/analytics/posting-times?subreddit=optional` - requires Pro tier
    - Return top 3 time windows with confidence scores
    - Support filtering by specific subreddit
    - Include reasoning ("Based on 45 posts, avg 120 upvotes")
    - _Requirements: Req 3_
  
  - [ ] 15.3 Build PostingTimeRecommendations component at `client/src/components/analytics/PostingTimeRecommendations.tsx`
    - Display top 3 optimal times with confidence badges
    - Show visual calendar with color-coded time slots
    - Integrate with existing EngagementHeatmap component
    - Use shadcn/ui Card component
    - _Requirements: Req 3_
  
  - [ ] 15.4 Integrate recommendations into scheduling UI
    - Add to `client/src/pages/post-scheduling.tsx`
    - Show "Recommended Times" section
    - Click to auto-fill time picker
    - Update recommendations when subreddit changes
    - _Requirements: Req 3_

- [ ] 16. Req 7: Advanced Filtering
  - [ ] 16.1 Add filter support to analytics queries in `server/services/user-analytics-service.ts`
    - Support filters: subreddit, date range, min_upvotes, max_upvotes, success/failure, removal status
    - Combine filters with AND logic using Drizzle ORM
    - _Requirements: Req 7_
  
  - [ ] 16.2 Update analytics API endpoints to accept filter params
    - Add query params to existing `/api/analytics/*` endpoints
    - Validate filter inputs with Zod schemas
    - _Requirements: Req 7_
  
  - [ ] 16.3 Build AnalyticsFilters component at `client/src/components/analytics/AnalyticsFilters.tsx`
    - Multi-select for subreddits
    - Date range picker
    - Performance tier selector (viral/high/medium/low)
    - Status filter (success/removed/all)
    - Use shadcn/ui Select and DatePicker components
    - _Requirements: Req 7_
  
  - [ ] 16.4 Add filter UI to analytics pages
    - Update `client/src/pages/analytics-dashboard.tsx`
    - Show active filters as removable badges
    - "Clear all filters" button
    - Persist filters in URL query params
    - _Requirements: Req 7_

- [ ] 17. Req 8: Export & Reporting
  - [ ] 17.1 Create ExportService at `server/services/export-service.ts`
    - Generate CSV exports using `json2csv` library
    - Generate PDF reports using `pdfkit` (Premium only)
    - Include charts as images in PDF
    - _Requirements: Req 8_
  
  - [ ] 17.2 Create export API endpoints in `server/routes/analytics.ts`
    - `POST /api/analytics/export/csv` - requires Pro tier
    - `POST /api/analytics/export/pdf` - requires Premium tier
    - Accept filter params to export filtered data
    - Return download URL or stream file
    - _Requirements: Req 8_
  
  - [ ] 17.3 Build ExportButton component at `client/src/components/analytics/ExportButton.tsx`
    - Dropdown menu: "Export as CSV" / "Export as PDF"
    - Show loading spinner during export
    - Auto-download file when ready
    - Use shadcn/ui DropdownMenu component
    - _Requirements: Req 8_
  
  - [ ] 17.4 Add export buttons to analytics pages
    - Add to `client/src/pages/analytics-dashboard.tsx`
    - Add to subreddit intelligence pages
    - Disable PDF option for non-Premium users with upgrade prompt
    - _Requirements: Req 8_



## Phase 2: Intelligence Layer (2-3 weeks, 14-18h AI-assisted)

- [ ] 18. Req 5: Trend Detection & Alerts
  - [ ] 18.1 Enhance existing `server/services/trend-detection.ts`
    - Detect engagement rate changes: compare last 7 days vs previous 7 days, alert if >20% change
    - Detect posting velocity changes: track posts per day trend
    - Detect subreddit activity changes: monitor member growth and post frequency
    - Generate alert objects with severity (info/warning/critical)
    - _Requirements: Req 5_
  
  - [ ] 18.2 Create alerts cron job at `server/jobs/trend-alerts-worker.ts`
    - Run daily to check for trends
    - Store alerts in new `analytics_alerts` table
    - Send email notifications for critical alerts (use existing email service)
    - _Requirements: Req 5_
  
  - [ ] 18.3 Create alerts API endpoints in `server/routes/analytics.ts`
    - `GET /api/analytics/alerts` - requires Pro tier, return unread alerts
    - `POST /api/analytics/alerts/:id/dismiss` - mark alert as read
    - `GET /api/analytics/alerts/history` - view past alerts
    - _Requirements: Req 5_
  
  - [ ] 18.4 Build AlertsCenter component at `client/src/components/analytics/AlertsCenter.tsx`
    - Bell icon with unread count badge in header
    - Dropdown showing recent alerts
    - Alert cards with severity colors and action buttons
    - Link to detailed trend visualizations
    - Use shadcn/ui Popover component
    - _Requirements: Req 5_

- [ ] 19. MISSING-3: Crosspost Opportunity Finder
  - [ ] 19.1 Create CrosspostService at `server/services/crosspost-service.ts`
    - Query successful posts (>100 upvotes, <7 days old) from `reddit_post_outcomes`
    - Find related subreddits from `subreddit_relationships` table
    - Filter out already crossposted subreddits
    - Suggest timing: 6-24 hours after original post
    - Generate title variations using existing AI service
    - _Requirements: MISSING-3_
  
  - [ ] 19.2 Create crosspost API endpoint in `server/routes/analytics.ts`
    - `GET /api/analytics/crosspost-opportunities` - requires Premium tier
    - Return top 10 opportunities with target subreddits and suggested times
    - Include estimated reach and success probability
    - _Requirements: MISSING-3_
  
  - [ ] 19.3 Build CrosspostOpportunities page at `client/src/pages/crosspost-opportunities.tsx`
    - List of crosspost opportunities with original post preview
    - Target subreddit cards with compatibility scores
    - "Schedule Crosspost" button (integrates with scheduling system)
    - Title variation selector
    - _Requirements: MISSING-3_



## Phase 3: Premium Features (3-4 weeks, 16-22h AI-assisted)

- [ ] 20. Req 4: ML Performance Predictions (OPTIONAL - Advanced)
  - [ ] 20.1 Create MLPredictionService at `server/services/ml-prediction-service.ts`
    - Use existing OpenRouter API for embeddings (CLIP for images, text model for titles)
    - Train XGBoost model on historical post data
    - Features: image embedding, title embedding, subreddit, time, user success rate
    - Store model in `server/ml/models/` directory
    - _Requirements: Req 4_
  
  - [ ] 20.2 Create ML training script at `server/scripts/train-prediction-model.ts`
    - Fetch training data from `reddit_post_outcomes`
    - Generate embeddings using OpenRouter
    - Train and save model
    - Run weekly via cron
    - _Requirements: Req 4_
  
  - [ ] 20.3 Add ML prediction endpoint in `server/routes/analytics.ts`
    - `POST /api/analytics/predict-performance-ml` - requires Premium tier
    - Return probability distribution for upvote ranges
    - Show confidence intervals
    - _Requirements: Req 4_

- [ ] 21. MISSING-2: Shadowban Detection
  - [ ] 21.1 Create ShadowbanService at `server/services/shadowban-service.ts`
    - Check if post is visible via Reddit API (fetch as anonymous user)
    - Detect zero engagement pattern: 0 upvotes, 0 comments after 2 hours
    - Mark posts as potentially shadowbanned in `reddit_post_outcomes`
    - _Requirements: MISSING-2_
  
  - [ ] 21.2 Create shadowban check cron job at `server/jobs/shadowban-check-worker.ts`
    - Run every hour
    - Check posts 1-2 hours old
    - Alert user via email if shadowban detected
    - _Requirements: MISSING-2_
  
  - [ ] 21.3 Build ShadowbanAlert component at `client/src/components/analytics/ShadowbanAlert.tsx`
    - Show warning banner when shadowban detected
    - Recommended actions: contact mods, verify email, build karma
    - Track shadowban history per subreddit
    - _Requirements: MISSING-2_

- [ ] 22. MISSING-4: Karma Velocity Tracker
  - [ ] 22.1 Create VelocityService at `server/services/velocity-service.ts`
    - Create `post_velocity_snapshots` table
    - Track upvotes at intervals: 15min, 1hr, 3hr, 6hr, 24hr
    - Calculate velocity score (upvotes per hour)
    - Predict final count using historical curves
    - _Requirements: MISSING-4_
  
  - [ ] 22.2 Create velocity tracking cron job at `server/jobs/velocity-tracker-worker.ts`
    - Run every 15 minutes
    - Snapshot recent posts
    - Alert if underperforming (below 50% of predicted)
    - _Requirements: MISSING-4_
  
  - [ ] 22.3 Build VelocityChart component at `client/src/components/analytics/VelocityChart.tsx`
    - Real-time line chart showing upvote velocity
    - Predicted final score with confidence band
    - Alert badge if underperforming
    - Use Recharts library
    - _Requirements: MISSING-4_



## Phase 4: Security & Polish (1 week, 8-11h AI-assisted)

- [ ] 23. SECURITY-1: Token Encryption & Rate Limiting
  - [ ] 23.1 Enhance existing encryption in `server/lib/encryption.ts`
    - Ensure Reddit refresh tokens use AES-256-GCM
    - Verify encryption key is stored securely in environment variables
    - Audit all token storage locations
    - _Requirements: SECURITY-1_
  
  - [ ] 23.2 Add analytics-specific rate limiting
    - Create rate limit middleware for `/api/analytics/*` routes (100 req/min per user)
    - Use existing Redis from `server/lib/cache.ts`
    - Return 429 with retry-after header
    - _Requirements: SECURITY-1_
  
  - [ ] 23.3 Verify security headers (already implemented)
    - Confirm Helmet middleware is active
    - Verify CORS configuration
    - Ensure HTTPS enforcement on production
    - _Requirements: SECURITY-1_

- [ ] 24. MISSING-5: Subreddit Saturation Monitor
  - [ ] 24.1 Create SaturationService at `server/services/saturation-service.ts`
    - Query user's posting frequency: posts per day in last 7 days
    - Compare to subreddit average from `subreddit_metrics_history`
    - Calculate saturation level: low (<50% of avg), medium (50-100%), high (>100%), critical (>200%)
    - Recommend cooldown periods based on saturation
    - _Requirements: MISSING-5_
  
  - [ ] 24.2 Create saturation API endpoint in `server/routes/analytics.ts`
    - `GET /api/analytics/saturation/:subreddit` - requires Pro tier
    - Return saturation metrics, level, and cooldown recommendation
    - Include engagement trend (declining if over-saturated)
    - _Requirements: MISSING-5_
  
  - [ ] 24.3 Build SaturationWarning component at `client/src/components/analytics/SaturationWarning.tsx`
    - Warning badge on over-posted subreddits
    - Display recommended cooldown period
    - Show engagement trend chart
    - Integrate into subreddit selection UI
    - _Requirements: MISSING-5_

- [ ] 25. MISSING-6: Flair Performance Analysis
  - [ ] 25.1 Add flair tracking to sync service
    - Capture flair text and ID during post sync
    - Store in new `post_flair` column in `reddit_post_outcomes`
    - _Requirements: MISSING-6_
  
  - [ ] 25.2 Create flair analysis API endpoint in `server/routes/analytics.ts`
    - `GET /api/analytics/flair-performance?subreddit=required` - requires Pro tier
    - Group posts by flair, calculate avg upvotes/views
    - Return ranked list of flairs by performance
    - _Requirements: MISSING-6_
  
  - [ ] 25.3 Build FlairRecommendations component at `client/src/components/analytics/FlairRecommendations.tsx`
    - Show best-performing flairs for selected subreddit
    - Display performance metrics per flair
    - Suggest flair during post creation
    - Warn if required flair is missing
    - _Requirements: MISSING-6_



## Phase 5: ML & Advanced (OPTIONAL - 6-8 weeks, 70-92h AI-assisted)

**Note:** These are advanced features that can be built later. Focus on Phases -1 through 4 first.

- [ ] 26. ML-2: NSFW Content Classification (OPTIONAL)
  - Use existing OpenRouter vision models for content classification
  - Integrate with posting workflow to warn about potential violations
  - _Requirements: ML-2_

- [ ] 27. ML-4: Viral Content Prediction (OPTIONAL)
  - Enhance rule-based predictor with ML model
  - Use OpenRouter for embeddings, train XGBoost model
  - _Requirements: ML-4_

- [ ] 28. ML-1: Image Content Analysis (OPTIONAL)
  - Use OpenRouter InternVL for image analysis
  - Extract visual features and correlate with engagement
  - _Requirements: ML-1_

- [ ] 29. ML-3: Caption Quality Scoring (OPTIONAL)
  - Score caption variants using language model
  - Integrate with existing caption generation
  - _Requirements: ML-3_

- [ ] 30. Req 6: Competitor Benchmarking (OPTIONAL)
  - Create anonymous benchmarking system
  - Show percentile rankings
  - _Requirements: Req 6_

- [ ] 31. Req 10: Mobile Optimization
  - [ ] 31.1 Test and optimize analytics pages for mobile
    - Test all pages on mobile devices
    - Adjust Tailwind breakpoints for better mobile UX
    - Optimize Recharts rendering for mobile
    - _Requirements: Req 10_
  
  - [ ] 31.2 Add mobile-specific features
    - Touch-friendly chart interactions
    - Swipe navigation between analytics views
    - Collapsible sections to save space
    - _Requirements: Req 10_
  
  - [ ] 31.3 Optimize mobile performance
    - Lazy load heavy components
    - Reduce data refresh frequency on mobile
    - Add "Reduce motion" option in settings
    - _Requirements: Req 10_



## Testing & Quality Assurance (OPTIONAL - Build tests as needed)

**Note:** Following platform standards, write minimal tests focused on core functionality. Only write tests if required.

- [ ] 32. Unit Tests (OPTIONAL)
  - Test core services: PredictionService, TrendingService, SubredditHealthService
  - Test HybridRedditClient with mocked Reddit API
  - Test RedditSyncService sync logic
  - Location: `tests/unit/services/`

- [ ] 33. Integration Tests (OPTIONAL)
  - Test analytics API endpoints with real database
  - Test sync endpoints and job queue
  - Location: `tests/integration/`

- [ ] 34. E2E Tests (OPTIONAL)
  - Test analytics dashboard user flows
  - Test subreddit discovery and recommendations
  - Test sync workflow from OAuth to data display
  - Location: `tests/e2e/` using Playwright



## Deployment & Infrastructure

- [ ] 35. Production Setup (Complete after Phase 4)
  - [ ] 35.1 Verify Render configuration
    - Confirm web service and worker service are configured
    - Verify PostgreSQL and Redis/Valkey instances
    - Check environment variables are set
  
  - [ ] 35.2 Run database migrations
    - Execute all analytics migrations on production database
    - Verify materialized views are created
    - Confirm indexes are in place
  
  - [ ] 35.3 Set up monitoring
    - Verify Sentry DSN is configured
    - Add health check for analytics endpoints
    - Monitor Bull queue performance

- [ ] 36. Performance Optimization (Ongoing)
  - [ ] 36.1 Database optimization
    - Monitor query performance with EXPLAIN ANALYZE
    - Add indexes as needed based on slow query log
    - Tune materialized view refresh schedule
  
  - [ ] 36.2 Caching optimization
    - Monitor Redis cache hit rates
    - Adjust TTLs based on usage patterns
    - Implement cache warming for popular queries
  
  - [ ] 36.3 Frontend optimization
    - Lazy load analytics components
    - Code-split analytics routes
    - Optimize React Query staleTime/cacheTime

- [ ] 37. Documentation (Complete after Phase 4)
  - [ ] 37.1 Update API documentation
    - Document all new analytics endpoints in `docs/API_ENDPOINTS_STATUS.md`
    - Add request/response examples
  
  - [ ] 37.2 Create user guide
    - Write "Getting Started with Analytics" guide
    - Document each analytics feature
    - Add to `docs/` directory
  
  - [ ] 37.3 Update developer docs
    - Document analytics architecture in `docs/PLATFORM_OVERVIEW.md`
    - Add deployment notes
    - Update `PLATFORM_MASTER_REFERENCE.md`

---

## Summary

**Total Tasks:** 37 major tasks with 100+ sub-tasks

**Estimated Time (UPDATED based on current implementation):**
- ✅ Phase -1 (Foundation): COMPLETE - HybridRedditClient, RedditSyncService, all database tables exist
- Phase 0 (Quick Wins): 16-20h - 10 high-impact features (removal tracking, health scores, predictions, etc.)
- Phase 1 (Core Analytics): 16-21h - Subreddit intelligence, posting times, filtering, export
- Phase 2 (Intelligence): 14-18h - Trend detection, alerts, crosspost opportunities
- Phase 3 (Premium): 16-22h - ML predictions, shadowban detection, velocity tracking
- Phase 4 (Security & Polish): 8-11h - Security audit, saturation monitoring, flair analysis
- Phase 5 (ML & Advanced): 70-92h (OPTIONAL - can be built later)
- Testing & QA: As needed (minimal, focused on core functionality)
- Deployment: 5-8h

**Total MVP (Phases 0 to 4):** 70-92h AI-assisted (Phase -1 already complete!)
**Total with ML (Phase 5):** 140-184h AI-assisted

**Current Status (Updated 2025-10-31):**
- ✅ Requirements approved
- ✅ Design approved
- ✅ Tasks refreshed based on current codebase analysis
- ✅ Phase -1 Foundation: 100% COMPLETE
  - ✅ HybridRedditClient implemented at `server/lib/reddit/hybrid-client.ts`
  - ✅ RedditSyncService implemented at `server/services/reddit-sync-service.ts`
  - ✅ Bull worker implemented at `server/jobs/reddit-sync-worker.ts`
  - ✅ All 7 database tables created in `drizzle/0002_analytics_tables.sql`
  - ✅ Schema definitions added to `shared/schema.ts`
  - ✅ reddit_post_outcomes extended with removal tracking columns
- 🟡 Phase 0 Quick Wins: 70% COMPLETE (7/10 features fully done)
  - ✅ QW-2: Post Removal Tracker - COMPLETE (service, API, UI, integrated)
  - ✅ QW-6: Subreddit Health Score - COMPLETE (service, API, UI, integrated)
  - ✅ QW-7: Performance Predictor - COMPLETE (service, API, UI, integrated)
  - ✅ QW-8: Smart Recommendations - COMPLETE (service, API, UI, integrated)
  - ✅ MISSING-1: Comment Engagement - COMPLETE (service, API, UI, integrated)
  - ⏳ QW-9: Engagement Heatmap - 67% COMPLETE (service ✅, API ✅, UI ❌) - 2h remaining
  - ⏳ QW-3: Enhanced Rule Validator - 67% COMPLETE (service ✅, API ✅, UI ❌) - 2h remaining
  - ⏳ QW-4: Success Rate Widget - 33% COMPLETE (API ✅, UI ❌) - 1.5h remaining
  - ⏳ QW-10: Stats Comparison - 67% COMPLETE (logic ✅, API ✅, UI ❌) - 1.5h remaining
  - ❌ QW-1: Mod Detection - NOT STARTED (need service, API, UI) - 3-4h
  - ❌ QW-5: Time Badge System - NOT STARTED (can reuse QW-9 heatmap data) - 1h

**Already Implemented (Backend 90% Complete):**
- ✅ **Services:** PredictionService, SubredditHealthService, RemovalTrackerService, RecommendationService, CommentEngagementService, HeatmapService, RuleValidatorService
- ✅ **API Endpoints:** 15+ analytics endpoints in `server/routes/analytics.ts` with Pro/Premium tier checks
- ✅ **Workers:** RemovalDetectionWorker, RemovalSchedulerWorker (running hourly via cron)
- ✅ **Database:** All 7 new tables + extended reddit_post_outcomes with removal tracking columns
- ✅ **Frontend Components:** RemovalHistory, PerformancePrediction, SubredditRecommendations, SubredditHealthBadge, CommentEngagement
- ✅ **Pages:** analytics-insights.tsx, subreddit-discovery.tsx, analytics-dashboard.tsx (with removals tab)
- ✅ **Integration:** Quick-post.tsx has PerformancePrediction and SubredditHealthBadge

**Phase 0 Remaining Work (5-8h of UI development):**
- ⏳ EngagementHeatmap component (QW-9) - 2h - API ready, install react-grid-heatmap
- ⏳ TimeBadge component (QW-5) - 1h - reuse heatmap API data
- ⏳ RealTimeValidator component (QW-3) - 2h - API ready, add real-time validation UI
- ⏳ SuccessRateWidget component (QW-4) - 1h - API ready, add animated widget
- ⏳ QuickStatsComparison component (QW-10) - 1h - data available, add comparison UI
- ❌ ModActivityService + API + UI (QW-1) - 3-4h - full implementation needed

**Future Phases (After Phase 0):**
- Phase 1: Core analytics (subreddit intelligence, posting times, filtering, export) - 16-21h
- Phase 2: Intelligence layer (trend detection, alerts, crosspost finder) - 14-18h
- Phase 3: Premium features (ML predictions, shadowban detection, velocity tracking) - 16-22h
- Phase 4: Security & polish (encryption, rate limiting, saturation monitoring) - 8-11h

**Key Integration Points:**
- Uses existing: Bull queue, Redis cache, Drizzle ORM, shadcn/ui components, TanStack Query
- Extends existing: `reddit_post_outcomes` table, analytics services, routes
- Already implemented: HybridRedditClient, RedditSyncService, 7 new database tables

**Next Steps:**
1. ✅ Phase -1 (Foundation) - COMPLETE
2. 🚀 Start Phase 0 (Quick Wins) - Build 10 high-impact features
3. Continue through Phases 1-4 for complete MVP
4. Phase 5 (ML) is optional and can be built later

**Ready to build the Quick Win features! The foundation is solid and ready to go.**

