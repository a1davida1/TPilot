/**
 * End-to-End Tests for Reddit Sync Feature
 * Simulates real user workflows from OAuth to sync completion
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RedditSyncService } from '../../server/services/reddit-sync-service.js';
import { HybridRedditClient } from '../../server/lib/reddit/hybrid-client.js';
import { db } from '../../server/db.js';
import { users, creatorAccounts, redditPostOutcomes, redditSyncStatus } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Reddit Sync E2E Workflow', () => {
  let testUserId: number;
  let testUsername: string;

  beforeAll(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      email: 'e2e-sync@test.com',
      username: 'e2e-sync-user',
      tier: 'premium', // Use premium to test all sync types
    }).returning();

    testUserId = user.id;
    testUsername = 'e2e_reddit_user';

    // Create Reddit account
    await db.insert(creatorAccounts).values({
      userId: testUserId,
      platform: 'reddit',
      handle: testUsername,
      platformUsername: testUsername,
      oauthToken: 'encrypted_test_token',
      oauthRefresh: 'encrypted_test_refresh',
      isActive: true,
    });
  });

  it('Complete Workflow: Connect → Quick Sync → Deep Sync → Full Sync → Analytics', async () => {
    // ========================================
    // STEP 1: Quick Sync (Automatic on OAuth)
    // ========================================
    console.log('Step 1: Testing automatic quick sync on OAuth connection...');

    const quickResult = await RedditSyncService.quickSync(testUserId, testUsername);

    expect(quickResult.status).toBe('completed');
    expect(quickResult.postsSynced).toBeGreaterThan(0);
    expect(quickResult.subredditsFound).toBeGreaterThan(0);

    // Verify posts were stored in database
    const quickPosts = await db
      .select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, testUserId));

    expect(quickPosts.length).toBe(quickResult.postsSynced);

    console.log(`✓ Quick sync completed: ${quickResult.postsSynced} posts, ${quickResult.subredditsFound} subreddits`);

    // ========================================
    // STEP 2: Check Sync Status
    // ========================================
    console.log('\nStep 2: Checking sync status...');

    const status1 = await RedditSyncService.getLastSyncStatus(testUserId);

    expect(status1).not.toBeNull();
    expect(status1?.postCount).toBe(quickResult.postsSynced);
    expect(status1?.subredditCount).toBe(quickResult.subredditsFound);

    console.log(`✓ Sync status verified: ${status1?.postCount} posts, ${status1?.subredditCount} subreddits`);

    // ========================================
    // STEP 3: Deep Sync (Pro+ Feature)
    // ========================================
    console.log('\nStep 3: Testing deep sync (500 posts)...');

    const deepResult = await RedditSyncService.deepSync(testUserId, testUsername);

    expect(deepResult.status).toBe('completed');
    expect(deepResult.postsSynced).toBeGreaterThanOrEqual(quickResult.postsSynced);

    // Verify more posts were added
    const deepPosts = await db
      .select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, testUserId));

    expect(deepPosts.length).toBeGreaterThanOrEqual(deepResult.postsSynced);

    console.log(`✓ Deep sync completed: ${deepResult.postsSynced} posts total`);

    // ========================================
    // STEP 4: Full Sync (Premium Feature)
    // ========================================
    console.log('\nStep 4: Testing full sync (1000 posts)...');

    const fullResult = await RedditSyncService.fullSync(testUserId, testUsername);

    expect(fullResult.status).toBe('completed');
    expect(fullResult.postsSynced).toBeGreaterThanOrEqual(deepResult.postsSynced);
    expect(fullResult.canDeepSync).toBe(false); // No further syncing needed

    // Verify final post count
    const allPosts = await db
      .select()
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, testUserId));

    expect(allPosts.length).toBeGreaterThanOrEqual(fullResult.postsSynced);

    console.log(`✓ Full sync completed: ${fullResult.postsSynced} posts total`);

    // ========================================
    // STEP 5: Verify Analytics Data
    // ========================================
    console.log('\nStep 5: Verifying analytics can use synced data...');

    // Check posts by subreddit
    const postsBySubreddit = allPosts.reduce((acc, post) => {
      acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(Object.keys(postsBySubreddit).length).toBeGreaterThan(0);

    // Check success rate
    const successfulPosts = allPosts.filter(p => p.success);
    const successRate = successfulPosts.length / allPosts.length;

    expect(successRate).toBeGreaterThan(0);
    expect(successRate).toBeLessThanOrEqual(1);

    // Check date range
    const dates = allPosts.map(p => p.occurredAt.getTime());
    const oldestPost = new Date(Math.min(...dates));
    const newestPost = new Date(Math.max(...dates));
    const daysCovered = (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24);

    expect(daysCovered).toBeGreaterThan(0);

    console.log(`✓ Analytics data verified:`);
    console.log(`  - ${Object.keys(postsBySubreddit).length} unique subreddits`);
    console.log(`  - ${(successRate * 100).toFixed(1)}% success rate`);
    console.log(`  - ${Math.floor(daysCovered)} days of history`);

    // ========================================
    // STEP 6: Final Status Check
    // ========================================
    console.log('\nStep 6: Final sync status check...');

    const finalStatus = await RedditSyncService.getLastSyncStatus(testUserId);

    expect(finalStatus).not.toBeNull();
    expect(finalStatus?.postCount).toBe(fullResult.postsSynced);

    console.log(`✓ Final status: ${finalStatus?.postCount} posts across ${finalStatus?.subredditCount} subreddits`);
    console.log(`\n✅ Complete E2E workflow successful!`);
  });

  it('HybridRedditClient: Fast Reads Performance Test', async () => {
    console.log('\nTesting HybridRedditClient performance...');

    const client = await HybridRedditClient.forUser(testUserId);

    if (!client) {
      console.log('⚠️ Skipping test: No Reddit client available (expected in test environment)');
      return;
    }

    const startTime = Date.now();

    // Test fast read performance
    const { posts } = await client.getUserPosts(testUsername, 100);

    const duration = Date.now() - startTime;

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.length).toBeLessThanOrEqual(100);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

    console.log(`✓ Fetched ${posts.length} posts in ${duration}ms`);
    console.log(`  Average: ${(duration / posts.length).toFixed(2)}ms per post`);

    // Test caching (second request should be much faster)
    const cacheStartTime = Date.now();
    const { posts: cachedPosts } = await client.getUserPosts(testUsername, 100);
    const cacheDuration = Date.now() - cacheStartTime;

    expect(cachedPosts.length).toBe(posts.length);
    expect(cacheDuration).toBeLessThan(duration); // Cached should be faster

    console.log(`✓ Cached fetch in ${cacheDuration}ms (${((1 - cacheDuration / duration) * 100).toFixed(1)}% faster)`);
  });

  it('Error Handling: Graceful Degradation', async () => {
    console.log('\nTesting error handling and graceful degradation...');

    // Test with non-existent user
    const result = await RedditSyncService.quickSync(999999, 'nonexistent');

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(result.postsSynced).toBe(0);

    console.log(`✓ Gracefully handled non-existent user: ${result.error}`);

    // Test with user who has no Reddit account
    const [userWithoutReddit] = await db.insert(users).values({
      email: 'no-reddit@test.com',
      username: 'no-reddit-user',
      tier: 'free',
    }).returning();

    const result2 = await RedditSyncService.quickSync(userWithoutReddit.id, 'nobody');

    expect(result2.status).toBe('failed');
    expect(result2.error).toContain('No active Reddit account');

    console.log(`✓ Gracefully handled missing Reddit account`);
  });

  it('Tier Enforcement at Service Level', async () => {
    console.log('\nTesting tier enforcement...');

    // Create free tier user
    const [freeUser] = await db.insert(users).values({
      email: 'free-tier@test.com',
      username: 'free-tier-user',
      tier: 'free',
    }).returning();

    await db.insert(creatorAccounts).values({
      userId: freeUser.id,
      platform: 'reddit',
      handle: 'free_user',
      platformUsername: 'free_user',
      oauthToken: 'token',
      oauthRefresh: 'refresh',
      isActive: true,
    });

    // Free user can quick sync
    const quickResult = await RedditSyncService.quickSync(freeUser.id, 'free_user');
    expect(quickResult.status).not.toBe('failed'); // Should work or complete

    // Free user cannot full sync (Premium required)
    const fullResult = await RedditSyncService.fullSync(freeUser.id, 'free_user');
    expect(fullResult.status).toBe('failed');
    expect(fullResult.error).toContain('Premium tier');

    console.log(`✓ Tier enforcement working correctly`);
  });
});
