/* eslint-env node, jest */
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/index.js';

describe('Reddit Communities Schema Integration', () => {

  test('should return communities with structured rules schema from seeded data', async () => {
    const { app } = await createApp();
    const response = await request(app)
      .get('/api/reddit/communities')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Test the first community's structure
    const community = response.body[0];
    expect(community).toBeDefined();

    // Verify the community has the expected basic structure
    expect(community.id).toBeDefined();
    expect(community.name).toBeDefined();
    expect(community.displayName).toBeDefined();
    expect(typeof community.members).toBe('number');
    expect(typeof community.engagementRate).toBe('number');

    // Verify the rules object contains structured fields
    expect(community.rules).toBeDefined();
    expect(typeof community.rules).toBe('object');

    // Test that sellingAllowed uses the new enum values (not boolean)
    if (community.rules.sellingAllowed !== undefined) {
      expect(['allowed', 'limited', 'not_allowed', 'unknown']).toContain(community.rules.sellingAllowed);
    }

    // Test that promotionalLinksAllowed uses enum values if present
    if (community.rules.promotionalLinksAllowed !== undefined) {
      expect(['yes', 'limited', 'no']).toContain(community.rules.promotionalLinksAllowed);
    }

    // Test optional numeric fields are either number or undefined
    if (community.rules.minKarma !== undefined) {
      expect(typeof community.rules.minKarma).toBe('number');
    }
    if (community.rules.minAccountAge !== undefined) {
      expect(typeof community.rules.minAccountAge).toBe('number');
    }

    // Test array fields are arrays if present
    if (community.rules.titleRules !== undefined) {
      expect(Array.isArray(community.rules.titleRules)).toBe(true);
    }
    if (community.rules.contentRules !== undefined) {
      expect(Array.isArray(community.rules.contentRules)).toBe(true);
    }
  });

  test('should validate schema consistency across multiple communities', async () => {
    const { app } = await createApp();
    const response = await request(app)
      .get('/api/reddit/communities')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    
    // Test multiple communities to ensure schema consistency
    const communitiesToTest = response.body.slice(0, 3); // Test first 3 communities
    
    for (const community of communitiesToTest) {
      // Each community should have consistent required fields
      expect(community.id).toBeDefined();
      expect(community.name).toBeDefined();
      expect(community.rules).toBeDefined();
      expect(typeof community.rules).toBe('object');

      // sellingAllowed should be enum if present, not boolean
      if (community.rules.sellingAllowed !== undefined) {
        expect(typeof community.rules.sellingAllowed).toBe('string');
        expect(['allowed', 'limited', 'not_allowed', 'unknown']).toContain(community.rules.sellingAllowed);
      }

      // Ensure watermarksAllowed stays boolean (not affected by our enum changes)
      if (community.rules.watermarksAllowed !== undefined) {
        expect(typeof community.rules.watermarksAllowed).toBe('boolean');
      }
    }
  });

  test('should ensure new schema fields are properly serialized', async () => {
    const { app } = await createApp();
    const response = await request(app)
      .get('/api/reddit/communities?category=general')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    
    // Find a community that has some of the new fields
    const communityWithRules = response.body.find((community: { rules?: { [key: string]: unknown } }) => 
      community.rules && Object.keys(community.rules).length > 2
    );
    
    if (communityWithRules) {
      const rules = communityWithRules.rules;
      
      // Test that new optional fields are properly handled
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
        expect(typeof rules.notes).toBe('string');
      }
    }
  });
});