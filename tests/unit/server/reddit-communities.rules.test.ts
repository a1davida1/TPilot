import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Test interfaces
interface TestCommunityRules {
  sellingAllowed?: string;
  watermarksAllowed?: boolean;
  titleRules?: string[];
  contentRules?: string[];
  verificationRequired?: boolean;
  minKarma?: number;
  minAccountAge?: number;
  requiresApproval?: boolean;
  nsfwRequired?: boolean;
  maxPostsPerDay?: number;
  cooldownHours?: number;
}

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
  rules: TestCommunityRules;
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
        expect(community.rules).toHaveProperty('sellingAllowed');
        expect(community.rules).toHaveProperty('watermarksAllowed');
        expect(community.rules).toHaveProperty('titleRules');
        expect(community.rules).toHaveProperty('contentRules');
        expect(Array.isArray(community.rules.titleRules)).toBe(true);
        expect(Array.isArray(community.rules.contentRules)).toBe(true);
      });
      
      // Verify structured rule format in full seed
      fullSeed.forEach((community: TestCommunity) => {
        expect(community).toHaveProperty('rules');
        expect(typeof community.rules).toBe('object');
        expect(community.rules).toHaveProperty('sellingAllowed');
        expect(community.rules).toHaveProperty('watermarksAllowed');
        expect(community.rules).toHaveProperty('titleRules');
        expect(community.rules).toHaveProperty('contentRules');
        expect(Array.isArray(community.rules.titleRules)).toBe(true);
        expect(Array.isArray(community.rules.contentRules)).toBe(true);
      });
      
      // Test specific communities from different seeds
      const gonewild = fullSeed.find((c: TestCommunity) => c.id === 'gonewild');
      expect(gonewild).toBeDefined();
      expect(gonewild.rules.sellingAllowed).toBe('not_allowed');
      expect(gonewild.rules.watermarksAllowed).toBe(false);
      expect(gonewild.rules.verificationRequired).toBe(true);
      
      const onlyfans = fullSeed.find((c: TestCommunity) => c.id === 'onlyfans');
      expect(onlyfans).toBeDefined();
      expect(onlyfans.rules.sellingAllowed).toBe('allowed');
      expect(onlyfans.rules.watermarksAllowed).toBe(true);
      
      const fitness = regularSeed.find((c: TestCommunity) => c.id === 'fitness');
      expect(fitness).toBeDefined();
      expect(fitness.rules.minKarma).toBe(100);
      expect(fitness.rules.minAccountAge).toBe(30);
      expect(fitness.rules.sellingAllowed).toBe('not_allowed');
      expect(fitness.rules.watermarksAllowed).toBe(false);
    });

  });

  describe('Rule processing and normalization', () => {
    it('should handle legacy array-based rules with backward compatibility', async () => {
      // Create a simple test module to access normalizeRules function
      const testModule = `
        import { normalizeRules } from '../../../server/reddit-communities.ts';
        
        export function testNormalizeRules(rawRules: unknown, promotionAllowed: string, category: string) {
          return normalizeRules(rawRules, promotionAllowed, category);
        }
      `;
      
      // Write temporary test file
      const tempTestPath = path.join(__dirname, '../../../temp-test-normalizer.js');
      fs.writeFileSync(tempTestPath, testModule);
      
      try {
        const { testNormalizeRules } = await import('../../../temp-test-normalizer.js');
        
        // Test legacy array-based rules
        const legacyRules = ['Verification required', 'No selling', 'OC only'];
        const result = testNormalizeRules(legacyRules, 'no', 'gonewild');
        
        expect(result.contentRules).toEqual(legacyRules);
        expect(result.sellingAllowed).toBe('not_allowed'); // Inferred from promotion='no'
        expect(result.titleRules).toEqual([]);
        expect(result.verificationRequired).toBe(false); // Default value
        
        // Test empty legacy rules
        const emptyResult = testNormalizeRules([], 'yes', 'selling');
        expect(emptyResult.contentRules).toEqual([]);
        expect(emptyResult.sellingAllowed).toBe('allowed'); // Inferred from promotion='yes'
        
        // Test null rules
        const nullResult = testNormalizeRules(null, 'limited', 'general');
        expect(nullResult.sellingAllowed).toBe('unknown'); // Default value
        expect(nullResult.contentRules).toEqual([]);
        
      } finally {
        // Cleanup temp file
        if (fs.existsSync(tempTestPath)) {
          fs.unlinkSync(tempTestPath);
        }
      }
    });

    it('should properly infer selling policy from promotion flags and category', async () => {
      // Test via the normalizeRules function with unknown selling policy
      const testModule = `
        import { normalizeRules } from '../../../server/reddit-communities.ts';
        
        export function testSellingPolicyInference(promotionAllowed: string, category: string) {
          const rules = { sellingAllowed: 'unknown' };
          return normalizeRules(rules, promotionAllowed, category);
        }
      `;
      
      const tempTestPath = path.join(__dirname, '../../../temp-test-policy.js');
      fs.writeFileSync(tempTestPath, testModule);
      
      try {
        const { testSellingPolicyInference } = await import('../../../temp-test-policy.js');
        
        // Test various promotion/category combinations
        expect(testSellingPolicyInference('yes', 'general').sellingAllowed).toBe('allowed');
        expect(testSellingPolicyInference('no', 'general').sellingAllowed).toBe('not_allowed');
        expect(testSellingPolicyInference('limited', 'general').sellingAllowed).toBe('limited');
        expect(testSellingPolicyInference('subtle', 'general').sellingAllowed).toBe('limited');
        expect(testSellingPolicyInference('unknown', 'selling').sellingAllowed).toBe('allowed');
        expect(testSellingPolicyInference('unknown', 'gonewild').sellingAllowed).toBe('unknown');
        
      } finally {
        // Cleanup temp file
        if (fs.existsSync(tempTestPath)) {
          fs.unlinkSync(tempTestPath);
        }
      }
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
          minKarma: 500,
          minAccountAge: 30,
          watermarksAllowed: false,
          sellingAllowed: 'limited',
          titleRules: ['No clickbait', 'Include category'],
          contentRules: ['High quality only', 'No spam'],
          verificationRequired: true,
          requiresApproval: true,
          nsfwRequired: false,
          maxPostsPerDay: 1,
          cooldownHours: 48
        }
      };

      // Import the normalizeRules function to test insights derivation
      const testModule = `
        import { normalizeRules } from '../../../server/reddit-communities.ts';
        
        export function testInsightsFromRules(community: TestCommunity) {
          const rules = normalizeRules(community.rules, community.promotionAllowed, community.category);
          const warnings = [];
          
          // Replicate the warning logic from getCommunityInsights
          if (rules.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
          if (rules.sellingAllowed === 'not_allowed') warnings.push('No promotion/selling allowed - content only');
          if (rules.sellingAllowed === 'limited') warnings.push('Limited promotion allowed - check specific rules');
          if (rules.watermarksAllowed === false) warnings.push('Watermarks not allowed - use clean images');
          if (rules.minKarma && rules.minKarma > 50) warnings.push(\`Requires \${rules.minKarma}+ karma\`);
          if (rules.minAccountAge && rules.minAccountAge > 7) warnings.push(\`Account must be \${rules.minAccountAge}+ days old\`);
          if (rules.maxPostsPerDay && rules.maxPostsPerDay <= 1) warnings.push(\`Limited to \${rules.maxPostsPerDay} post\${rules.maxPostsPerDay === 1 ? '' : 's'} per day\`);
          if (rules.cooldownHours && rules.cooldownHours >= 24) warnings.push(\`\${rules.cooldownHours}h cooldown between posts\`);
          if (rules.requiresApproval) warnings.push('Posts require mod approval - expect delays');
          
          return { rules, warnings };
        }
      `;
      
      const tempTestPath = path.join(__dirname, '../../../temp-test-insights.js');
      fs.writeFileSync(tempTestPath, testModule);
      
      try {
        const { testInsightsFromRules } = await import('../../../temp-test-insights.js');
        
        const result = testInsightsFromRules(testCommunity);
        
        // Verify warnings are generated correctly
        expect(result.warnings).toContain('Verification required - complete r/GetVerified');
        expect(result.warnings).toContain('Limited promotion allowed - check specific rules');
        expect(result.warnings).toContain('Watermarks not allowed - use clean images');
        expect(result.warnings).toContain('Requires 500+ karma');
        expect(result.warnings).toContain('Account must be 30+ days old');
        expect(result.warnings).toContain('Limited to 1 post per day');
        expect(result.warnings).toContain('48h cooldown between posts');
        expect(result.warnings).toContain('Posts require mod approval - expect delays');
        
        // Verify structured rules are properly normalized
        expect(result.rules.sellingAllowed).toBe('limited');
        expect(result.rules.watermarksAllowed).toBe(false);
        expect(result.rules.verificationRequired).toBe(true);
        
      } finally {
        // Cleanup temp file
        if (fs.existsSync(tempTestPath)) {
          fs.unlinkSync(tempTestPath);
        }
      }
    });
  });

  describe('Schema validation', () => {
    it('should validate RedditCommunityRuleSet schema correctly', async () => {
      // Import schema components
      const { redditCommunityRuleSetSchema, createDefaultRules } = await import('../../../shared/schema.ts');
      
      // Test valid rule set
      const validRules = {
        minKarma: 100,
        minAccountAge: 30,
        watermarksAllowed: false,
        sellingAllowed: 'not_allowed' as const,
        titleRules: ['No clickbait'],
        contentRules: ['High quality only'],
        verificationRequired: true,
        requiresApproval: false,
        nsfwRequired: true,
        maxPostsPerDay: 2,
        cooldownHours: 24
      };
      
      const result = redditCommunityRuleSetSchema.parse(validRules);
      expect(result).toMatchObject(validRules);
    });

    it('should create proper default rules', async () => {
      const { createDefaultRules } = await import('../../../shared/schema.ts');
      
      const defaults = createDefaultRules();
      
      expect(defaults).toMatchObject({
        minKarma: null,
        minAccountAge: null,
        watermarksAllowed: null,
        sellingAllowed: 'unknown',
        titleRules: [],
        contentRules: [],
        verificationRequired: false,
        requiresApproval: false,
        nsfwRequired: false,
        maxPostsPerDay: null,
        cooldownHours: null
      });
    });

    it('should validate sellingAllowed enum values', async () => {
      const { redditCommunityRuleSetSchema } = await import('../../../shared/schema.ts');
      
      const validValues = ['allowed', 'limited', 'not_allowed', 'unknown'];
      
      for (const value of validValues) {
        const rules = { sellingAllowed: value };
        const result = redditCommunityRuleSetSchema.parse(rules);
        expect(result.sellingAllowed).toBe(value);
      }
      
      // Test invalid value
      expect(() => {
        redditCommunityRuleSetSchema.parse({ sellingAllowed: 'invalid' });
      }).toThrow();
    });
  });
});