import { eq } from "drizzle-orm";
import { getPreviewStats, canQueuePosts, checkPreviewGate } from '../../server/lib/preview-gate';
import { db } from '../../server/db';
import { postPreviews, users } from '@shared/schema';

describe('Preview Gate', () => {
  const testUserId = 999; // Test user ID
  
  beforeAll(async () => {
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      tier: 'free'
    }).onConflictDoNothing();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(postPreviews).where(eq(postPreviews.userId, testUserId));
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(postPreviews).where(eq(postPreviews.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('Preview Statistics', () => {
    test('returns correct stats with no previews', async () => {
      const stats = await getPreviewStats(testUserId);

      expect(stats.okCount14d).toBe(0);
      expect(stats.totalPreviews14d).toBe(0);
      expect(stats.canQueue).toBe(false);
      expect(stats.required).toBe(3);
    });

    test('counts OK previews in last 14 days', async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const old = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago (outside window)

      // Insert test previews
      await db.insert(postPreviews).values([
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'Recent OK preview 1',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'Recent OK preview 2', 
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'Old OK preview',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: old
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'Recent warning preview',
          bodyPreview: 'Content',
          policyState: 'warn',
          warnings: ['Some warning'],
          createdAt: recent
        }
      ]);

      const stats = await getPreviewStats(testUserId);

      expect(stats.okCount14d).toBe(2); // Only 2 recent OK previews
      expect(stats.totalPreviews14d).toBe(3); // 3 recent previews total
      expect(stats.canQueue).toBe(false); // Still need 1 more
    });

    test('enables queue when requirement is met', async () => {
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      // Insert 3 OK previews
      await db.insert(postPreviews).values([
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 1',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 2',
          bodyPreview: 'Content', 
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 3',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        }
      ]);

      const stats = await getPreviewStats(testUserId);

      expect(stats.okCount14d).toBe(3);
      expect(stats.canQueue).toBe(true);
    });
  });

  describe('Queue Permission', () => {
    test('denies queue with insufficient previews', async () => {
      const canQueue = await canQueuePosts(testUserId);
      expect(canQueue).toBe(false);
    });

    test('allows queue with sufficient previews', async () => {
      // Insert 3 OK previews
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      
      await db.insert(postPreviews).values([
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 1',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 2',
          bodyPreview: 'Content',
          policyState: 'ok', 
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 3',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        }
      ]);

      const canQueue = await canQueuePosts(testUserId);
      expect(canQueue).toBe(true);
    });
  });

  describe('Gate Check', () => {
    test('provides detailed gate check result when requirement not met', async () => {
      const gateResult = await checkPreviewGate(testUserId);

      expect(gateResult.canQueue).toBe(false);
      expect(gateResult.reason).toBe('PREVIEW_GATE_NOT_MET');
      expect(gateResult.required).toBe(3);
      expect(gateResult.current).toBe(0);
    });

    test('passes gate check when requirement is met', async () => {
      // Insert 3 OK previews
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      
      await db.insert(postPreviews).values([
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 1',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 2',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        },
        {
          userId: testUserId,
          subreddit: 'test',
          titlePreview: 'OK preview 3',
          bodyPreview: 'Content',
          policyState: 'ok',
          warnings: [],
          createdAt: recent
        }
      ]);

      const gateResult = await checkPreviewGate(testUserId);

      expect(gateResult.canQueue).toBe(true);
      expect(gateResult.reason).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('handles database errors gracefully', async () => {
      // Test with invalid user ID to trigger error handling
      const stats = await getPreviewStats(-1);
      
      // Should return safe defaults
      expect(stats.okCount14d).toBe(0);
      expect(stats.canQueue).toBe(false);
    });
  });
});