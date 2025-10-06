import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeRules, inferSellingPolicy } from '../../../server/reddit-communities.ts';
import type { RedditCommunityRuleSet } from '../../../shared/schema.ts';

// Test interfaces
interface TestCommunity {
  id: string;
  name?: string;
  displayName?: string;
  category?: string;
  promotionAllowed?: string;
  successProbability?: number;
  growthTrend?: string;
  competitionLevel?: string;
  bestPostingTimes?: string[];
  rules: RedditCommunityRuleSet | undefined;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Reddit Communities Rules Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Seed data verification', () => {
    it('should load both seed datasets and verify structured rule content', async () => {
      const projectRoot = path.resolve(__dirname, '../../../');
      
      // Load both seed files
      const regularSeedPath = path.join(projectRoot, 'server/seeds/reddit-communities.json');
      const fullSeedPath = path.join(projectRoot, 'server/seeds/reddit-communities-full.json');
      
      expect(fs.existsSync(regularSeedPath)).toBe(true);
      expect(fs.existsSync(fullSeedPath)).toBe(true);
      
      // Parse seed data
      const regularSeed = JSON.parse(fs.readFileSync(regularSeedPath, 'utf8'));
      const fullSeed = JSON.parse(fs.readFileSync(fullSeedPath, 'utf8'));
      
      expect(Array.isArray(regularSeed)).toBe(true);
      expect(Array.isArray(fullSeed)).toBe(true);
      expect(regularSeed.length).toBeGreaterThan(0);
      expect(fullSeed.length).toBeGreaterThan(0);
      
      // Verify structured rule format in regular seed
      regularSeed.forEach((community: TestCommunity) => {
        expect(community).toHaveProperty('rules');
        expect(typeof community.rules).toBe('object');
        // Check nested structure
        if (community.rules?.content) {
          expect(community.rules.content).toHaveProperty('sellingPolicy');
          expect(community.rules.content).toHaveProperty('watermarksAllowed');
          expect(community.rules.content).toHaveProperty('titleGuidelines');
          expect(community.rules.content).toHaveProperty('contentGuidelines');
          expect(Array.isArray(community.rules.content.titleGuidelines)).toBe(true);
          expect(Array.isArray(community.rules.content.contentGuidelines)).toBe(true);
        }
      });
      
      // Verify structured rule format in full seed
      fullSeed.forEach((community: TestCommunity) => {
        expect(community).toHaveProperty('rules');
        expect(typeof community.rules).toBe('object');
        // Check nested structure
        if (community.rules?.content) {
          expect(community.rules.content).toHaveProperty('sellingPolicy');
          expect(community.rules.content).toHaveProperty('watermarksAllowed');
          expect(community.rules.content).toHaveProperty('titleGuidelines');
          expect(community.rules.content).toHaveProperty('contentGuidelines');
          expect(Array.isArray(community.rules.content.titleGuidelines)).toBe(true);
          expect(Array.isArray(community.rules.content.contentGuidelines)).toBe(true);
        }
      });
      
      // Test specific communities from different seeds with nested structure
      const gonewild = fullSeed.find((c: TestCommunity) => c.id === 'gonewild');
      expect(gonewild).toBeDefined();
      expect(gonewild.rules?.content?.sellingPolicy).toBe('not_allowed');
      expect(gonewild.rules?.content?.watermarksAllowed).toBe(false);
      expect(gonewild.rules?.eligibility?.verificationRequired).toBe(true);
      
      const onlyfans = fullSeed.find((c: TestCommunity) => c.id === 'onlyfans');
      expect(onlyfans).toBeDefined();
      expect(onlyfans.rules?.content?.sellingPolicy).toBe('allowed');
      expect(onlyfans.rules?.content?.watermarksAllowed).toBe(true);
      
      const fitness = regularSeed.find((c: TestCommunity) => c.id === 'fitness');
      expect(fitness).toBeDefined();
      expect(fitness.rules?.eligibility?.minKarma).toBe(100);
      expect(fitness.rules?.eligibility?.minAccountAgeDays).toBe(30);
      expect(fitness.rules?.content?.sellingPolicy).toBe('not_allowed');
      expect(fitness.rules?.content?.watermarksAllowed).toBe(false);
    });

  });

  describe('Rule processing and normalization', () => {
    it('should handle legacy array-based rules with backward compatibility', async () => {
      // Test legacy array-based rules
      const legacyRules = ['Verification required', 'No selling', 'OC only'];
      const result = normalizeRules(legacyRules, 'no', 'gonewild');
      
      expect(result.content?.contentGuidelines).toEqual(legacyRules);
      expect(result.content?.sellingPolicy).toBe('not_allowed'); // Inferred from promotion='no'
      expect(result.content?.titleGuidelines).toEqual([]);
      expect(result.eligibility?.verificationRequired).toBe(false); // Default value
      
      // Test empty legacy rules
      const emptyResult = normalizeRules([], 'yes', 'selling');
      expect(emptyResult.content?.contentGuidelines).toEqual([]);
      expect(emptyResult.content?.sellingPolicy).toBe('allowed'); // Inferred from promotion='yes'
      
      // Test null rules - should infer from promotion flag
      const nullResult = normalizeRules(null, 'limited', 'general');
      expect(nullResult.content?.sellingPolicy).toBe('limited'); // Inferred from promotion='limited'
      expect(nullResult.content?.contentGuidelines).toEqual([]);
    });

    it('should properly infer selling policy from promotion flags and category', async () => {
      // Test various promotion/category combinations using inferSellingPolicy directly
      expect(inferSellingPolicy('yes', 'general')).toBe('allowed');
      expect(inferSellingPolicy('no', 'general')).toBe('not_allowed');
      expect(inferSellingPolicy('limited', 'general')).toBe('limited');
      expect(inferSellingPolicy('subtle', 'general')).toBe('limited');
      expect(inferSellingPolicy('unknown', 'selling')).toBe('allowed');
      expect(inferSellingPolicy('unknown', 'gonewild')).toBe('unknown');
      
      // Test with normalizeRules to verify integration
      const rules = { content: { sellingPolicy: 'unknown' } };
      expect(normalizeRules(rules, 'yes', 'general').content?.sellingPolicy).toBe('unknown'); // Rules already specify policy
      expect(normalizeRules({}, 'yes', 'general').content?.sellingPolicy).toBe('allowed'); // Empty rules, infer from flags
    });

    it('should derive insights warnings from structured rules', async () => {
      // Test deriving insights from rule combinations
      const testCommunity = {
        id: 'test_community',
        name: 'test_community',
        displayName: 'Test Community',
        category: 'test',
        promotionAllowed: 'limited',
        successProbability: 60,
        growthTrend: 'stable',
        competitionLevel: 'medium',
        bestPostingTimes: ['morning', 'evening'],
        rules: {
          eligibility: {
            minKarma: 500,
            minAccountAgeDays: 30,
            verificationRequired: true,
            requiresApproval: true,
          },
          content: {
            watermarksAllowed: false,
            sellingPolicy: 'limited',
            titleGuidelines: ['No clickbait', 'Include category'],
            contentGuidelines: ['High quality only', 'No spam'],
            nsfwRequired: false,
            linkRestrictions: [],
            bannedContent: [],
            formattingRequirements: [],
            promotionalLinks: null,
            requiresOriginalContent: false,
          },
          posting: {
            maxPostsPerDay: 1,
            cooldownHours: 48,
          },
          notes: null,
        }
      };

      // Test insights derivation using normalizeRules directly
      const rules = normalizeRules(testCommunity.rules, testCommunity.promotionAllowed, testCommunity.category);
      const warnings: string[] = [];
      
      // Replicate the warning logic from getCommunityInsights
      if (rules.eligibility?.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
      if (rules.content?.sellingPolicy === 'no') warnings.push('No promotion/selling allowed - content only');
      if (rules.content?.sellingPolicy === 'limited') warnings.push('Limited promotion allowed - check specific rules');
      if (rules.content?.watermarksAllowed === false) warnings.push('Watermarks not allowed - use clean images');
      if (rules.eligibility?.minKarma && rules.eligibility.minKarma > 50) warnings.push(`Requires ${rules.eligibility.minKarma}+ karma`);
      if (rules.eligibility?.minAccountAgeDays && rules.eligibility.minAccountAgeDays > 7) warnings.push(`Account must be ${rules.eligibility.minAccountAgeDays}+ days old`);
      if (rules.posting?.maxPostsPerDay && rules.posting.maxPostsPerDay <= 1) warnings.push(`Limited to ${rules.posting.maxPostsPerDay} post${rules.posting.maxPostsPerDay === 1 ? '' : 's'} per day`);
      if (rules.posting?.cooldownHours && rules.posting.cooldownHours >= 24) warnings.push(`${rules.posting.cooldownHours}h cooldown between posts`);
      if (rules.eligibility?.requiresApproval) warnings.push('Posts require mod approval - expect delays');
      
      // Verify warnings are generated correctly
      expect(warnings).toContain('Verification required - complete r/GetVerified');
      expect(warnings).toContain('Limited promotion allowed - check specific rules');
      expect(warnings).toContain('Watermarks not allowed - use clean images');
      expect(warnings).toContain('Requires 500+ karma');
      expect(warnings).toContain('Account must be 30+ days old');
      expect(warnings).toContain('Limited to 1 post per day');
      expect(warnings).toContain('48h cooldown between posts');
      expect(warnings).toContain('Posts require mod approval - expect delays');
      
      // Verify structured rules are properly normalized
      expect(rules.content?.sellingPolicy).toBe('limited');
      expect(rules.content?.watermarksAllowed).toBe(false);
      expect(rules.eligibility?.verificationRequired).toBe(true);
    });
  });

  describe('Schema validation', () => {
    it('should validate RedditCommunityRuleSet schema correctly', async () => {
      // Import schema components
      const { redditCommunityRuleSetSchema } = await import('../../../shared/schema.ts');
      
      // Test valid rule set with new nested structure
      const validRules = {
        eligibility: {
          minKarma: 100,
          minAccountAgeDays: 30,
          verificationRequired: true,
          requiresApproval: false,
        },
        content: {
          watermarksAllowed: false,
          sellingPolicy: 'not_allowed' as const,
          titleGuidelines: ['No clickbait'],
          contentGuidelines: ['High quality only'],
          nsfwRequired: true,
          linkRestrictions: [],
          bannedContent: [],
          formattingRequirements: [],
          promotionalLinks: null,
          requiresOriginalContent: false,
        },
        posting: {
          maxPostsPerDay: 2,
          cooldownHours: 24,
        },
        notes: null,
      };
      
      const result = redditCommunityRuleSetSchema.parse(validRules);
      expect(result).toMatchObject(validRules);
    });

    it('should create proper default rules', async () => {
      const { createDefaultRules } = await import('../../../shared/schema.ts');
      
      const defaults = createDefaultRules();
      
      expect(defaults).toMatchObject({
        eligibility: {
          minKarma: null,
          minAccountAgeDays: null,
          verificationRequired: false,
          requiresApproval: false,
        },
        content: {
          watermarksAllowed: null,
          sellingPolicy: undefined,
          titleGuidelines: [],
          contentGuidelines: [],
          nsfwRequired: false,
          linkRestrictions: [],
          bannedContent: [],
          formattingRequirements: [],
          promotionalLinks: null,
          requiresOriginalContent: false,
        },
        posting: {
          maxPostsPerDay: null,
          cooldownHours: null,
        },
        notes: null,
      });
    });

    it('should validate sellingPolicy enum values', async () => {
      const { redditCommunityRuleSetSchema } = await import('../../../shared/schema.ts');
      
      const validValues = ['allowed', 'limited', 'not_allowed', 'unknown'];
      
      for (const value of validValues) {
        const rules = { 
          content: { 
            sellingPolicy: value,
            titleGuidelines: [],
            contentGuidelines: [],
            linkRestrictions: [],
            bannedContent: [],
            formattingRequirements: [],
          } 
        };
        const result = redditCommunityRuleSetSchema.parse(rules);
        expect(result?.content?.sellingPolicy).toBe(value);
      }
      
      // Test invalid value
      expect(() => {
        redditCommunityRuleSetSchema.parse({ 
          content: { 
            sellingPolicy: 'invalid',
            titleGuidelines: [],
            contentGuidelines: [],
            linkRestrictions: [],
            bannedContent: [],
            formattingRequirements: [],
          } 
        });
      }).toThrow();
    });
  });
});