# Reddit Sync Testing Suite

Comprehensive test coverage for the Reddit Sync feature, covering unit tests, integration tests, and end-to-end workflows.

## Test Structure

```
tests/
├── unit/
│   └── reddit-sync-service.test.ts    # Service layer unit tests
├── routes/
│   └── reddit-sync.test.ts            # API endpoint integration tests
└── e2e/
    └── reddit-sync-e2e.test.ts        # Full workflow E2E tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit tests/unit/reddit-sync-service.test.ts
```

### Integration Tests Only
```bash
npm run test:routes tests/routes/reddit-sync.test.ts
```

### E2E Tests Only
```bash
npm test tests/e2e/reddit-sync-e2e.test.ts
```

### With Coverage
```bash
npm run test:coverage
```

## Test Coverage

### Unit Tests (`reddit-sync-service.test.ts`)

**What It Tests:**
- ✅ Quick Sync: 100 posts, top 10 subreddits
- ✅ Deep Sync: 500 posts with pagination
- ✅ Full Sync: 1000 posts for Premium users
- ✅ Tier enforcement at service level
- ✅ Error handling (no account, API failures)
- ✅ Sync status retrieval
- ✅ Edge cases (no posts, incomplete pagination)

**Key Scenarios:**
- Successful sync with varying post counts
- Pagination handling (multiple API calls)
- Subreddit discovery and deduplication
- Premium tier requirement for full sync
- Graceful degradation on failures

### Integration Tests (`reddit-sync.test.ts`)

**What It Tests:**
- ✅ POST /api/reddit/sync/quick - All users
- ✅ POST /api/reddit/sync/deep - Pro+ users only
- ✅ POST /api/reddit/sync/full - Premium users only
- ✅ GET /api/reddit/sync/status - Sync statistics
- ✅ GET /api/reddit/sync/job/:jobId - Job progress
- ✅ Tier-based access control matrix
- ✅ Authentication requirements
- ✅ Error responses (400, 401, 403, 404)

**Key Scenarios:**
- All tiers attempting each sync type
- Missing Reddit account errors
- Unauthenticated requests
- Job status tracking
- Complete tier access matrix verification

### E2E Tests (`reddit-sync-e2e.test.ts`)

**What It Tests:**
- ✅ Complete user workflow: OAuth → Quick → Deep → Full → Analytics
- ✅ Automatic quick sync on Reddit connection
- ✅ Sequential syncs with increasing data
- ✅ Analytics integration with synced data
- ✅ HybridRedditClient performance
- ✅ Caching effectiveness
- ✅ Error handling and graceful degradation

**Key Scenarios:**
- Real user journey from connection to analytics
- Performance benchmarking (< 5s for 100 posts)
- Cache speedup verification
- Data integrity checks
- Success rate calculations
- Date range coverage

## Mock Data

### Mock Reddit Post
```typescript
{
  id: 'post_123',
  title: 'Test Post Title',
  subreddit: 'testsubreddit',
  author: 'testuser',
  score: 42,
  num_comments: 10,
  created_utc: 1234567890,
  permalink: '/r/test/comments/abc123',
  url: 'https://reddit.com/r/test/comments/abc123',
  is_self: true,
  over_18: false,
  removed_by_category: null
}
```

### Mock Subreddit Info
```typescript
{
  display_name: 'TestSub',
  title: 'Test Subreddit',
  public_description: 'A test subreddit',
  subscribers: 10000,
  active_user_count: 100,
  over18: false,
  subreddit_type: 'public',
  created_utc: 1234567890
}
```

## Tier Access Matrix

| Feature     | Free | Starter | Pro | Premium |
|-------------|------|---------|-----|---------|
| Quick Sync  | ✅   | ✅      | ✅  | ✅      |
| Deep Sync   | ❌   | ❌      | ✅  | ✅      |
| Full Sync   | ❌   | ❌      | ❌  | ✅      |

## Expected Results

### Quick Sync
- **Time**: ~30 seconds
- **Posts**: Up to 100
- **Subreddits**: Top 10 by post count
- **Tier**: All users
- **Next Action**: Can trigger Deep Sync if got 100 posts

### Deep Sync
- **Time**: ~2-3 minutes
- **Posts**: Up to 500
- **Subreddits**: All discovered
- **Tier**: Pro or Premium
- **Next Action**: Can trigger Full Sync if got 500 posts

### Full Sync
- **Time**: ~5-10 minutes
- **Posts**: Up to 1000
- **Subreddits**: All discovered
- **Tier**: Premium only
- **Next Action**: Complete - no further sync recommended

## Performance Benchmarks

### HybridRedditClient (Fast Reads)
- **100 posts**: < 5 seconds
- **Cache hit**: 50-80% faster
- **Avg per post**: < 50ms

### Sync Times (Real-World)
- **Quick**: 20-40 seconds
- **Deep**: 2-4 minutes
- **Full**: 5-12 minutes

*Note: Times vary based on Reddit API response times and user's posting history*

## Debugging Test Failures

### "No active Reddit account found"
**Cause**: Test user doesn't have a `creatorAccounts` record
**Fix**: Ensure test setup creates Reddit account entry

### "Queue not available"
**Cause**: Queue backend not initialized
**Fix**: Use `startQueue: false` in test app creation

### "HybridRedditClient.forUser returns null"
**Cause**: Missing or invalid OAuth tokens
**Fix**: Mock the client or provide valid test tokens

### "Tier enforcement failing"
**Cause**: User tier not set correctly
**Fix**: Verify user.tier matches expected value

## Testing in Production (Safe)

### Manual Sync Test
1. Create a test user with Premium tier
2. Connect Reddit account via OAuth
3. Verify automatic quick sync triggered
4. Navigate to Intelligence Insights page
5. Click "Deep Sync" button
6. Wait 2-3 minutes
7. Check sync status updates
8. Verify analytics show synced data

### Health Check Endpoints
```bash
# Check sync status
curl -H "Authorization: Bearer $TOKEN" \
  https://thottopilot.com/api/reddit/sync/status

# Check job status
curl -H "Authorization: Bearer $TOKEN" \
  https://thottopilot.com/api/reddit/sync/job/$JOB_ID
```

### Database Verification
```sql
-- Check synced posts
SELECT COUNT(*), subreddit
FROM reddit_post_outcomes
WHERE user_id = $USER_ID
GROUP BY subreddit;

-- Check sync status
SELECT * FROM reddit_sync_status
WHERE user_id = $USER_ID;
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Reddit Sync Tests
  run: |
    npm run test:unit tests/unit/reddit-sync-service.test.ts
    npm run test:routes tests/routes/reddit-sync.test.ts
```

### Pre-Deployment Checks
1. All unit tests pass
2. All integration tests pass
3. E2E workflow completes
4. Coverage > 80%

## Known Limitations

1. **Reddit API Rate Limits**: Tests may fail if hitting rate limits
2. **Mock Data**: E2E tests with real API require valid credentials
3. **Queue Timing**: Job status may not update immediately
4. **Cache Invalidation**: May need manual clearing between tests

## Future Improvements

- [ ] Add stress tests (1000+ concurrent syncs)
- [ ] Add performance regression tests
- [ ] Add monitoring/alerting integration tests
- [ ] Add data consistency validation tests
- [ ] Add rollback/recovery scenario tests

## Support

For test failures or questions:
1. Check test output logs
2. Review [PLATFORM_MASTER_REFERENCE.md](../PLATFORM_MASTER_REFERENCE.md)
3. Check Reddit sync service logs: `logs/combined-*.log`
4. Create issue with test output and environment details
