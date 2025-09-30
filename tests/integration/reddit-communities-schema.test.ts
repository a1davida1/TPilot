/* eslint-env node, jest */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../server/index.ts';
import { storage } from '../../server/storage.ts';

interface RedditCommunityRules {
  sellingAllowed?: string;
  promotionalLinksAllowed?: string;
  minKarma?: number;
  minAccountAge?: number;
  minAccountAgeDays?: number;
  watermarksAllowed?: boolean;
  titleRules?: unknown;
  contentRules?: unknown;
  bannedContent?: unknown;
  formattingRequirements?: unknown;
  requiresOriginalContent?: boolean;
  notes?: unknown;
  [key: string]: unknown;
}

interface RedditCommunityResponse {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category?: string;
  promotionAllowed?: string;
  rules?: RedditCommunityRules;
}

describe('Reddit Communities Schema Integration', () => {
  let app: Express;
  let server: Server | undefined;
  let authToken: string;
  let testUserId: number;
  let sampleCommunityId: string;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });
    app = result.app;
    server = result.server;

    const uniqueSuffix = Date.now();
    const email = `reddit-schema-${uniqueSuffix}@example.com`;
    const user = await storage.createUser({
      username: `reddit-schema-${uniqueSuffix}`,
      password: 'hashedpassword',
      email,
      emailVerified: true,
      tier: 'pro',
      subscriptionStatus: 'active',
      mustChangePassword: false,
    });
    testUserId = user.id;

    const jwtSecret = process.env.JWT_SECRET ?? 'test-secret';
    authToken = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const communitiesResponse = await request(app)
      .get('/api/reddit/communities')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const [firstCommunity] = communitiesResponse.body as RedditCommunityResponse[];
    if (!firstCommunity?.id) {
      throw new Error('Seeded Reddit communities are required for tests');
    }
    sampleCommunityId = firstCommunity.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await storage.deleteUser(testUserId).catch(() => {});
    }
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(error => (error ? reject(error) : resolve()));
      });
    }
  });

  test('should reject unauthenticated access to communities listing', async () => {
    await request(app)
      .get('/api/reddit/communities')
      .expect(401);
  });

  test('should return communities with structured rules schema from seeded data', async () => {
    const response = await request(app)
      .get('/api/reddit/communities')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const communities = response.body as RedditCommunityResponse[];
    expect(Array.isArray(communities)).toBe(true);
    expect(communities.length).toBeGreaterThan(0);

    const community = communities[0];
    expect(community).toBeDefined();
    expect(community.id).toBeDefined();
    expect(community.name).toBeDefined();
    expect(community.displayName).toBeDefined();
    expect(typeof community.members).toBe('number');
    expect(typeof community.engagementRate).toBe('number');

    const rules = community.rules;
    expect(rules).toBeDefined();
    if (rules) {
      const sellingAllowed = rules.sellingAllowed;
      if (sellingAllowed !== undefined) {
        expect(['allowed', 'limited', 'not_allowed', 'unknown']).toContain(sellingAllowed);
      }

      const promotionalLinksAllowed = rules.promotionalLinksAllowed;
      if (promotionalLinksAllowed !== undefined) {
        expect(['yes', 'limited', 'no']).toContain(promotionalLinksAllowed);
      }

      if (rules.minKarma !== undefined) {
        expect(typeof rules.minKarma).toBe('number');
      }
      if (rules.minAccountAge !== undefined) {
        expect(typeof rules.minAccountAge).toBe('number');
      }
      if (rules.titleRules !== undefined) {
        expect(Array.isArray(rules.titleRules)).toBe(true);
      }
      if (rules.contentRules !== undefined) {
        expect(Array.isArray(rules.contentRules)).toBe(true);
      }
    }
  });

  test('should validate schema consistency across multiple communities', async () => {
    const response = await request(app)
      .get('/api/reddit/communities')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const communities = response.body as RedditCommunityResponse[];
    expect(Array.isArray(communities)).toBe(true);

    const communitiesToTest = communities.slice(0, 3);

    for (const community of communitiesToTest) {
      expect(community.id).toBeDefined();
      expect(community.name).toBeDefined();
      expect(community.rules).toBeDefined();
      expect(typeof community.rules).toBe('object');

      const rules = community.rules;
      if (rules?.sellingAllowed !== undefined) {
        expect(typeof rules.sellingAllowed).toBe('string');
        expect(['allowed', 'limited', 'not_allowed', 'unknown']).toContain(rules.sellingAllowed);
      }

      if (rules?.watermarksAllowed !== undefined) {
        expect(typeof rules.watermarksAllowed).toBe('boolean');
      }
    }
  });

  test('should ensure new schema fields are properly serialized', async () => {
    const response = await request(app)
      .get('/api/reddit/communities?category=general')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const communities = response.body as RedditCommunityResponse[];
    expect(Array.isArray(communities)).toBe(true);

    const communityWithRules = communities.find((community) =>
      community.rules && Object.keys(community.rules).length > 2
    );

    if (communityWithRules?.rules) {
      const rules = communityWithRules.rules;

      if (rules.minAccountAgeDays !== undefined) {
        expect(typeof rules.minAccountAgeDays).toBe('number');
      }
      if (rules.requiresOriginalContent !== undefined) {
        expect(typeof rules.requiresOriginalContent).toBe('boolean');
      }
      if (rules.bannedContent !== undefined) {
        expect(Array.isArray(rules.bannedContent)).toBe(true);
      }
      if (rules.formattingRequirements !== undefined) {
        expect(Array.isArray(rules.formattingRequirements)).toBe(true);
      }
      if (rules.notes !== undefined) {
        const noteType = typeof rules.notes;
        expect(['string', 'object']).toContain(noteType);
      }
    }
  });

  test('should reject unauthenticated community insights requests', async () => {
    await request(app)
      .get(`/api/reddit/community-insights/${sampleCommunityId}`)
      .expect(401);
  });

  test('should provide community insights for authenticated users', async () => {
    const response = await request(app)
      .get(`/api/reddit/community-insights/${sampleCommunityId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(Array.isArray(response.body.bestTimes)).toBe(true);
    expect(Array.isArray(response.body.successTips)).toBe(true);
    expect(Array.isArray(response.body.warnings)).toBe(true);
  });
});
