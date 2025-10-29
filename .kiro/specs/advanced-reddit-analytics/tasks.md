# Implementation Tasks

## Phase -1: Foundation (Day 1, 6-9h AI-assisted)

### 1. Hybrid Reddit Client Implementation

- [ ] 1.1 Create HybridRedditClient class
  - Implement Snoowrap initialization for OAuth + writes
  - Implement Axios client for fast reads
  - Add token refresh interceptor
  - Add Redis caching layer
  - _Requirements: TECH-1, MISSING-0_

- [ ] 1.2 Implement fast read methods
  - `getUserPosts()` with pagination and caching
  - `getSubredditInfo()` with 1hr cache
  - `getSubredditRules()` with 24hr cache
  - _Requirements: TECH-1_

- [ ] 1.3 Implement write methods via Snoowrap
  - `submitPost()` for posting
  - Cache invalidation on writes
  - _Requirements: TECH-1_

### 2. Auto-Sync Service

- [ ] 2.1 Create RedditSyncService
  - Implement `quickSync()` (100 posts, 10 subreddits)
  - Implement `deepSync()` (500 posts, all subreddits)
  - Implement `fullSync()` (1000 posts, Premium only)
  - Add subreddit discovery logic
  - Add post backfill logic
  - _Requirements: MISSING-0_

- [ ] 2.2 Set up Bull worker for background syncs
  - Create sync queue
  - Implement worker with progress tracking
  - Add retry logic (3 attempts, exponential backoff)
  - Set concurrency limit (5 concurrent syncs)
  - _Requirements: MISSING-0_

- [ ] 2.3 Create sync status tracking
  - Add `reddit_sync_status` table
  - Track sync progress in real-time
  - Store sync results
  - _Requirements: MISSING-0_

### 3. Database Schema Setup

- [ ] 3.1 Create new tables
  - `subreddit_metrics_history`
  - `anonymous_creator_profiles`
  - `subreddit_relationships`
  - `user_subreddit_preferences`
  - `reddit_sync_status`
  - `subreddit_mod_activity`
  - `user_rule_violations`
  - _Requirements: All features_

- [ ] 3.2 Extend existing tables
  - Add columns to `reddit_communities`
  - Add columns to `reddit_post_outcomes`
  - Create indexes for performance
  - _Requirements: All features_

- [ ] 3.3 Create materialized views
  - `user_subreddit_performance` view
  - Set up hourly refresh cron job
  - _Requirements: Performance optimization_



## Phase 0: Quick Wins (2-3 weekends, 16-20h AI-assisted)

### Group A: Data Foundation (Weekend 1 Morning, 4-5h)

- [ ] 4. QW-2: Post Removal Tracker
  - [ ] 4.1 Extend `reddit_post_outcomes` schema
    - Add `removal_reason`, `removal_type`, `reddit_post_id` columns
    - Add `time_until_removal_minutes` column
    - _Requirements: QW-2_
  
  - [ ] 4.2 Create removal detection cron job
    - Check post status every hour
    - Parse removal reasons from mod messages
    - Update post outcomes table
    - _Requirements: QW-2_
  
  - [ ] 4.3 Create removal history API endpoint
    - `GET /api/analytics/removal-history`
    - Return removal history with reasons
    - _Requirements: QW-2_
  
  - [ ] 4.4 Build removal history UI component
    - Table showing removed posts
    - Filter by subreddit, date, reason
    - _Requirements: QW-2_

- [ ] 5. QW-4: Success Rate Dashboard Widget
  - [ ] 5.1 Create success rate calculation service
    - Query `reddit_post_outcomes` for success/failure counts
    - Calculate percentage
    - _Requirements: QW-4_
  
  - [ ] 5.2 Build dashboard widget component
    - Large percentage display
    - Color coding (green >80%, yellow 50-80%, red <50%)
    - Click to drill down
    - _Requirements: QW-4_

- [ ] 6. QW-6: Subreddit Health Score
  - [ ] 6.1 Create health score calculation service
    - Implement scoring algorithm (success 40%, engagement 30%, removal 30%)
    - Calculate for all user's subreddits
    - _Requirements: QW-6_
  
  - [ ] 6.2 Create health score API endpoint
    - `GET /api/analytics/subreddit-health`
    - Return scores with breakdowns
    - _Requirements: QW-6_
  
  - [ ] 6.3 Build SubredditHealthBadge component
    - Display score with color coding
    - Tooltip with breakdown
    - _Requirements: QW-6_

### Group B: Analytics & Visualization (Weekend 1 Afternoon, 4-5h)

- [ ] 7. QW-9: Engagement Heatmap (includes time badges from QW-5)
  - [ ] 7.1 Create heatmap data API endpoint
    - `GET /api/analytics/engagement-heatmap`
    - Return 7x24 grid of engagement data
    - _Requirements: QW-9, QW-5_
  
  - [ ] 7.2 Build EngagementHeatmap component
    - Use react-grid-heatmap library
    - Color-code cells by engagement
    - Hover tooltips with metrics
    - Click to filter analytics
    - _Requirements: QW-9_
  
  - [ ] 7.3 Add time badge indicators
    - Show "Best time", "Good time", "Avoid" badges
    - Display on scheduling interface
    - _Requirements: QW-5_

- [ ] 8. QW-10: Quick Stats Comparison
  - [ ] 8.1 Create comparison API endpoint
    - `GET /api/analytics/comparison?range=7d`
    - Compare current vs previous period
    - Calculate percentage changes
    - _Requirements: QW-10_
  
  - [ ] 8.2 Build QuickStatsComparison component
    - Display current vs previous metrics
    - Green/red arrows for changes
    - Overall trend indicator
    - _Requirements: QW-10_

- [ ] 9. MISSING-1: Comment Engagement Tracker
  - [ ] 9.1 Extend schema for comment data
    - Add `comment_count`, `avg_comment_length`, `user_replied` to `reddit_post_outcomes`
    - _Requirements: MISSING-1_
  
  - [ ] 9.2 Track comment metrics in sync
    - Fetch comment data during post sync
    - Calculate engagement metrics
    - _Requirements: MISSING-1_
  
  - [ ] 9.3 Add comment metrics to analytics
    - Display in overview
    - Show comment-to-upvote ratio
    - _Requirements: MISSING-1_

### Group C: Intelligence & Validation (Weekend 2, 6-8h)

- [ ] 10. QW-1: Mod Detection & Safe Posting
  - [ ] 10.1 Create mod activity tracking
    - Add `subreddit_mod_activity` table
    - Track mod comments/actions via Reddit API
    - Calculate activity level (high/moderate/low)
    - _Requirements: QW-1_
  
  - [ ] 10.2 Create mod activity API endpoint
    - `GET /api/subreddits/:name/mod-activity`
    - Return current activity level
    - _Requirements: QW-1_
  
  - [ ] 10.3 Build ModActivityBadge component
    - Display activity level
    - Show warnings for high activity
    - Suggest safer posting times
    - _Requirements: QW-1_

- [ ] 11. QW-3: Enhanced Rule Validator
  - [ ] 11.1 Create user rule violations tracking
    - Add `user_rule_violations` table
    - Track which rules user violated
    - _Requirements: QW-3_
  
  - [ ] 11.2 Create validation service
    - Check eligibility (karma, account age)
    - Check content rules (title, links, NSFW)
    - Check posting limits
    - Highlight previously violated rules
    - _Requirements: QW-3_
  
  - [ ] 11.3 Create validation API endpoint
    - `POST /api/subreddits/:name/validate`
    - Return validation results with warnings
    - _Requirements: QW-3_
  
  - [ ] 11.4 Build real-time validation UI
    - Validate as user types
    - Show errors and warnings
    - Display "Ready to post" indicator
    - _Requirements: QW-3_

- [ ] 12. QW-7: Post Performance Predictor (rule-based)
  - [ ] 12.1 Create prediction service
    - Implement rule-based scoring algorithm
    - Factor in title length, posting time, subreddit health, user success rate
    - Generate suggestions
    - _Requirements: QW-7_
  
  - [ ] 12.2 Create prediction API endpoint
    - `POST /api/analytics/predict-performance`
    - Return prediction with confidence
    - _Requirements: QW-7_
  
  - [ ] 12.3 Build PerformancePrediction component
    - Display prediction level (low/medium/high/viral)
    - Show score and confidence
    - List suggestions
    - _Requirements: QW-7_

### Group D: Discovery (Weekend 3, 2.5-3.5h)

- [ ] 13. QW-8: Smart Subreddit Recommendations
  - [ ] 13.1 Create recommendation service
    - Find similar subreddits based on user's successful subs
    - Calculate compatibility scores
    - Generate reasons
    - Check warnings (requirements, rules)
    - _Requirements: QW-8_
  
  - [ ] 13.2 Create recommendations API endpoint
    - `GET /api/analytics/subreddit-recommendations`
    - Return top 10 recommendations
    - _Requirements: QW-8_
  
  - [ ] 13.3 Build subreddit discovery page
    - Tabs for trending/recommended/search
    - Subreddit cards with compatibility scores
    - "Add to My Subreddits" button
    - _Requirements: QW-8_



## Phase 1: Core Analytics (2-3 weeks, 16-21h AI-assisted)

- [ ] 14. Req 2: Subreddit Intelligence
  - [ ] 14.1 Create subreddit analytics service
    - Aggregate performance metrics per subreddit
    - Calculate trends (improving/stable/declining)
    - Identify best posting times per subreddit
    - Track rule compliance history
    - _Requirements: Req 2_
  
  - [ ] 14.2 Integrate MISSING-8 (Trending Subreddits)
    - Create `subreddit_metrics_history` tracking
    - Implement trending detection algorithm
    - Identify hot (>20% growth), rising (5-20% growth), hidden gems
    - _Requirements: MISSING-8_
  
  - [ ] 14.3 Create subreddit intelligence API endpoints
    - `GET /api/analytics/subreddit/:name/intelligence`
    - `GET /api/analytics/trending-subreddits`
    - _Requirements: Req 2, MISSING-8_
  
  - [ ] 14.4 Build subreddit intelligence UI
    - Detailed subreddit page with all metrics
    - Performance charts
    - Rule compliance history
    - Trending indicators
    - _Requirements: Req 2_

- [ ] 15. Req 3: Posting Time Recommendations
  - [ ] 15.1 Create posting time analysis service
    - Analyze hour-of-day and day-of-week patterns
    - Calculate confidence scores
    - Account for timezone differences
    - _Requirements: Req 3_
  
  - [ ] 15.2 Create posting time API endpoint
    - `GET /api/analytics/posting-times?subreddit=gonewild`
    - Return top 3 time windows with confidence
    - _Requirements: Req 3_
  
  - [ ] 15.3 Build posting time recommendations UI
    - Display optimal times with confidence
    - Visual calendar/heatmap integration
    - Show on scheduling interface
    - _Requirements: Req 3_

- [ ] 16. Req 7: Advanced Filtering
  - [ ] 16.1 Create filter service
    - Support filtering by subreddit, date range, content type, performance tier
    - Combine filters with AND logic
    - Save filter presets
    - _Requirements: Req 7_
  
  - [ ] 16.2 Build advanced filter UI
    - Filter panel with multiple options
    - Active filters display
    - One-click filter removal
    - Save/load presets
    - _Requirements: Req 7_

- [ ] 17. Req 8: Export & Reporting
  - [ ] 17.1 Create export service
    - Generate CSV exports
    - Generate PDF reports (Premium)
    - Include charts and metrics
    - _Requirements: Req 8_
  
  - [ ] 17.2 Create export API endpoints
    - `POST /api/analytics/export/csv`
    - `POST /api/analytics/export/pdf` (Premium)
    - _Requirements: Req 8_
  
  - [ ] 17.3 Build export UI
    - Export button on analytics pages
    - Format selection (CSV/PDF)
    - Download progress indicator
    - _Requirements: Req 8_



## Phase 2: Intelligence Layer (2-3 weeks, 14-18h AI-assisted)

- [ ] 18. Req 5: Trend Detection & Alerts
  - [ ] 18.1 Create trend detection service
    - Detect significant changes in engagement rate (>20% change over 7 days)
    - Detect posting velocity changes
    - Detect subreddit activity changes
    - _Requirements: Req 5_
  
  - [ ] 18.2 Create alert system
    - Generate notifications for positive trends
    - Generate alerts for negative trends
    - Provide diagnostic information and recommendations
    - _Requirements: Req 5_
  
  - [ ] 18.3 Create alerts API endpoints
    - `GET /api/analytics/alerts`
    - `POST /api/analytics/alerts/:id/dismiss`
    - _Requirements: Req 5_
  
  - [ ] 18.4 Build alerts UI
    - Notification center
    - Alert cards with actions
    - Trend visualizations
    - _Requirements: Req 5_

- [ ] 19. MISSING-3: Crosspost Opportunity Finder
  - [ ] 19.1 Create crosspost analysis service
    - Identify successful posts suitable for crossposting
    - Find related subreddits via network graph
    - Suggest optimal crosspost timing (6-24 hours after original)
    - Generate title variations
    - _Requirements: MISSING-3_
  
  - [ ] 19.2 Create crosspost API endpoint
    - `GET /api/analytics/crosspost-opportunities`
    - Return opportunities with target subreddits
    - _Requirements: MISSING-3_
  
  - [ ] 19.3 Build crosspost opportunities UI
    - List of crosspost opportunities
    - Target subreddit suggestions
    - One-click crosspost scheduling
    - _Requirements: MISSING-3_



## Phase 3: Premium Features (3-4 weeks, 16-22h AI-assisted)

- [ ] 20. Req 4: ML Performance Predictions
  - [ ] 20.1 Enhance prediction service with ML
    - Train gradient boosting model (XGBoost/LightGBM)
    - Use image embeddings (CLIP), text embeddings (BERT), tabular features
    - Track actual vs predicted performance
    - Retrain model weekly
    - _Requirements: Req 4_
  
  - [ ] 20.2 Create ML prediction API endpoint
    - `POST /api/analytics/predict-performance-ml`
    - Return probability distributions for view ranges
    - _Requirements: Req 4_
  
  - [ ] 20.3 Integrate ML predictions into UI
    - Enhanced prediction display
    - Confidence intervals
    - Historical accuracy metrics
    - _Requirements: Req 4_

- [ ] 21. MISSING-2: Shadowban Detection
  - [ ] 21.1 Create shadowban detection service
    - Check if post is visible to others
    - Detect zero engagement despite good timing/content
    - Identify spam filter issues
    - _Requirements: MISSING-2_
  
  - [ ] 21.2 Create shadowban detection cron job
    - Check posts 1-2 hours after posting
    - Alert user if shadowban detected
    - _Requirements: MISSING-2_
  
  - [ ] 21.3 Build shadowban alert UI
    - Warning notifications
    - Recommended actions
    - Subreddit-specific shadowban tracking
    - _Requirements: MISSING-2_

- [ ] 22. MISSING-4: Karma Velocity Tracker
  - [ ] 22.1 Create velocity tracking
    - Track upvotes at 15min, 1hr, 3hr, 6hr, 24hr intervals
    - Compare to historical velocity curves
    - Predict final upvote count
    - _Requirements: MISSING-4_
  
  - [ ] 22.2 Create velocity API endpoint
    - `GET /api/analytics/post/:id/velocity`
    - Return velocity snapshots and predictions
    - _Requirements: MISSING-4_
  
  - [ ] 22.3 Build velocity tracking UI
    - Real-time velocity chart
    - Predicted final score
    - Underperformance alerts
    - _Requirements: MISSING-4_



## Phase 4: Security & Polish (1 week, 8-11h AI-assisted)

- [ ] 23. SECURITY-1: Token Encryption & Rate Limiting
  - [ ] 23.1 Implement AES-256-GCM encryption
    - Create encryption/decryption utilities
    - Encrypt Reddit refresh tokens at rest
    - Generate and store encryption key securely
    - _Requirements: SECURITY-1_
  
  - [ ] 23.2 Implement rate limiting
    - Add rate limit middleware (100 req/min per user)
    - Use Redis for rate limit counters
    - Return proper 429 responses
    - _Requirements: SECURITY-1_
  
  - [ ] 23.3 Add security headers
    - HTTPS enforcement
    - CORS configuration
    - Helmet middleware
    - _Requirements: SECURITY-1_

- [ ] 24. MISSING-5: Subreddit Saturation Monitor
  - [ ] 24.1 Create saturation tracking service
    - Track user's posting frequency per subreddit
    - Compare to subreddit average
    - Calculate saturation level
    - _Requirements: MISSING-5_
  
  - [ ] 24.2 Create saturation API endpoint
    - `GET /api/analytics/saturation/:subreddit`
    - Return saturation metrics and recommendations
    - _Requirements: MISSING-5_
  
  - [ ] 24.3 Build saturation warnings UI
    - Warning badges on over-posted subreddits
    - Recommended cooldown periods
    - Engagement trend indicators
    - _Requirements: MISSING-5_

- [ ] 25. MISSING-6: Flair Performance Analysis
  - [ ] 25.1 Track flair usage and performance
    - Store flair data with posts
    - Calculate performance by flair type
    - _Requirements: MISSING-6_
  
  - [ ] 25.2 Create flair analysis API endpoint
    - `GET /api/analytics/flair-performance?subreddit=gonewild`
    - Return performance by flair
    - _Requirements: MISSING-6_
  
  - [ ] 25.3 Build flair recommendations UI
    - Show best-performing flairs
    - Flair selection suggestions
    - Missing flair warnings
    - _Requirements: MISSING-6_



## Phase 5: ML & Advanced (6-8 weeks, 70-92h AI-assisted) - Optional

- [ ] 26. ML-2: NSFW Content Classification
  - [ ] 26.1 Set up Python ML service
    - Create FastAPI service for ML inference
    - Configure GPU (RTX 4090) support
    - Set up model serving infrastructure
    - _Requirements: ML-2_
  
  - [ ] 26.2 Implement NSFW classifier
    - Fine-tune CLIP or use NudeNet model
    - Train on Reddit post outcomes (successful vs removed)
    - Classify content safety level (SFW/suggestive/explicit)
    - Identify specific elements for rule compliance
    - _Requirements: ML-2_
  
  - [ ] 26.3 Integrate with posting workflow
    - Validate content before posting
    - Display warnings for potential violations
    - Allow user feedback to improve accuracy
    - _Requirements: ML-2_

- [ ] 27. ML-4: Viral Content Prediction
  - [ ] 27.1 Build multi-modal prediction model
    - Generate image embeddings (CLIP)
    - Generate text embeddings (BERT)
    - Combine with tabular features
    - Train ensemble model (XGBoost + neural network)
    - _Requirements: ML-4_
  
  - [ ] 27.2 Implement viral prediction API
    - `POST /api/ml/predict-viral`
    - Return probability distributions for view ranges
    - Track actual outcomes for retraining
    - _Requirements: ML-4_
  
  - [ ] 27.3 Build viral prediction UI
    - "High opportunity" indicators
    - Probability distributions visualization
    - Optimal posting strategy suggestions
    - _Requirements: ML-4_

- [ ] 28. ML-1: Image Content Analysis
  - [ ] 28.1 Implement vision model inference
    - Use CLIP or InternVL for image analysis
    - Extract visual features (composition, colors, subject)
    - Generate content tags
    - _Requirements: ML-1_
  
  - [ ] 28.2 Correlate visual features with engagement
    - Store image embeddings in PostgreSQL (pgvector)
    - Identify high-performing visual patterns
    - _Requirements: ML-1_
  
  - [ ] 28.3 Build visual insights UI
    - Display image analysis results
    - Show successful visual patterns
    - Suggest visual improvements
    - _Requirements: ML-1_

- [ ] 29. ML-3: Caption Quality Scoring
  - [ ] 29.1 Fine-tune language model
    - Train BERT/RoBERTa on caption performance data
    - Analyze linguistic features
    - Score readability, engagement potential, brand consistency
    - _Requirements: ML-3_
  
  - [ ] 29.2 Integrate with caption generation
    - Score caption variants automatically
    - Rank by predicted performance
    - Provide improvement suggestions
    - _Requirements: ML-3_

- [ ] 30. Req 6: Competitor Benchmarking
  - [ ] 30.1 Create anonymous benchmarking system
    - Build anonymous creator profiles
    - Aggregate performance data
    - Calculate percentile rankings
    - _Requirements: Req 6_
  
  - [ ] 30.2 Create benchmarking API endpoint
    - `GET /api/analytics/benchmarks`
    - Return anonymized comparison data
    - _Requirements: Req 6_
  
  - [ ] 30.3 Build benchmarking UI
    - Percentile rankings display
    - Performance comparison charts
    - Improvement opportunities
    - _Requirements: Req 6_

- [ ] 31. Req 10: Mobile Optimization
  - [ ] 31.1 Optimize responsive layouts
    - Test all analytics pages on mobile
    - Adjust breakpoints and layouts
    - Optimize chart rendering for mobile
    - _Requirements: Req 10_
  
  - [ ] 31.2 Add touch-friendly interactions
    - Pinch-to-zoom on charts
    - Swipe navigation
    - Touch-optimized controls
    - _Requirements: Req 10_
  
  - [ ] 31.3 Optimize mobile performance
    - Reduce data refresh frequency option
    - Disable animations option
    - Lazy load heavy components
    - _Requirements: Req 10_



## Testing & Quality Assurance

- [ ] 32. Unit Tests
  - [ ] 32.1 Test analytics services
    - PredictionService tests
    - TrendingService tests
    - RecommendationService tests
    - AnalyticsQueryService tests
  
  - [ ] 32.2 Test Reddit client
    - HybridRedditClient tests
    - Mock Reddit API responses
    - Test caching behavior
  
  - [ ] 32.3 Test sync service
    - RedditSyncService tests
    - Test quick/deep/full sync logic
    - Test error handling

- [ ] 33. Integration Tests
  - [ ] 33.1 Test API endpoints
    - Analytics endpoints
    - Sync endpoints
    - Subreddit management endpoints
  
  - [ ] 33.2 Test database operations
    - Schema migrations
    - Materialized view refreshes
    - Query performance

- [ ] 34. E2E Tests
  - [ ] 34.1 Test analytics dashboard
    - User can view analytics
    - Time range filtering works
    - Charts render correctly
  
  - [ ] 34.2 Test subreddit discovery
    - User can view trending subreddits
    - User can add subreddits
    - Recommendations display correctly
  
  - [ ] 34.3 Test sync workflow
    - User can connect Reddit account
    - Quick sync completes successfully
    - Deep sync can be triggered



## Deployment & Infrastructure

- [ ] 35. Production Setup
  - [ ] 35.1 Configure Render services
    - Set up web service
    - Set up worker service
    - Configure PostgreSQL database
    - Configure Redis instance
  
  - [ ] 35.2 Set environment variables
    - Add all required env vars
    - Configure encryption keys
    - Set up Sentry DSN
  
  - [ ] 35.3 Set up monitoring
    - Configure health check endpoint
    - Set up error tracking (Sentry)
    - Configure logging
    - Set up metrics collection

- [ ] 36. Performance Optimization
  - [ ] 36.1 Database optimization
    - Create all indexes
    - Set up materialized views
    - Configure connection pooling
  
  - [ ] 36.2 Caching optimization
    - Configure Redis cache tiers
    - Implement cache invalidation
    - Set up stale-while-revalidate
  
  - [ ] 36.3 Frontend optimization
    - Lazy load components
    - Optimize bundle size
    - Configure React Query caching

- [ ] 37. Documentation
  - [ ] 37.1 API documentation
    - Document all endpoints
    - Add request/response examples
    - Create Postman collection
  
  - [ ] 37.2 User documentation
    - Getting started guide
    - Feature tutorials
    - FAQ
  
  - [ ] 37.3 Developer documentation
    - Architecture overview
    - Deployment guide
    - Contributing guidelines

---

## Summary

**Total Tasks:** 37 major tasks with 100+ sub-tasks

**Estimated Time:**
- Phase -1 (Foundation): 6-9h
- Phase 0 (Quick Wins): 16-20h
- Phase 1 (Core Analytics): 16-21h
- Phase 2 (Intelligence): 14-18h
- Phase 3 (Premium): 16-22h
- Phase 4 (Security): 8-11h
- Phase 5 (ML): 70-92h (optional)
- Testing & QA: 10-15h
- Deployment: 5-8h

**Total MVP (Phases -1 to 4):** 76-101h AI-assisted
**Total with ML (Phase 5):** 146-193h AI-assisted

**Next Steps:**
1. ✅ Requirements approved
2. ✅ Design approved
3. ✅ Tasks created
4. 🚀 Begin Phase -1: Foundation

**Ready to start building the most advanced Reddit analytics platform!**

