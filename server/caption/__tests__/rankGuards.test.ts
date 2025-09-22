import { describe, it, expect } from 'vitest';
import { 
  detectVariantViolations, 
  sanitizeFinalVariant, 
  buildRerankHint, 
  formatViolationSummary,
  fallbackHashtags,
  HUMAN_CTA 
} from '../rankGuards';
import { CaptionItem } from '../schema';
import { z } from 'zod';
type CaptionItemType = z.infer<typeof CaptionItem>;

// Helper to create valid test caption objects
const createTestCaption = (overrides: Partial<CaptionItemType>): CaptionItemType => ({
  style: 'flirty',
  hashtags: ['#test'],
  mood: 'playful',
  nsfw: false,
  caption: 'Test caption',
  alt: 'Test alt text',
  cta: 'Test CTA',
  safety_level: 'safe',
  ...overrides
});

describe('rankGuards', () => {
  describe('detectVariantViolations', () => {
    it('should detect sparkle-filler phrases in captions', () => {
      const caption = createTestCaption({
        caption: "Check out this amazing content! ✨",
        alt: "A photo",
        hashtags: ["#photography"],
        cta: "Follow me!"
      });
      
      const violations = detectVariantViolations(caption);
      expect(violations).toContainEqual(
        expect.objectContaining({
          type: 'banned_phrase',
          field: 'caption'
        })
      );
    });

    it('should detect generic hashtags', () => {
      const caption = createTestCaption({
        caption: "Beautiful day",
        alt: "A photo",
        hashtags: ["#content", "#creative", "#amazing"],
        cta: "DM me!"
      });
      
      const violations = detectVariantViolations(caption);
      expect(violations).toContainEqual(
        expect.objectContaining({
          type: 'generic_hashtag',
          field: 'hashtags'
        })
      );
    });

    it('should detect canned CTAs', () => {
      const caption = createTestCaption({
        caption: "Beautiful sunset",
        alt: "A photo",
        hashtags: ["#photography"],
        cta: "Link in bio for more!"
      });
      
      const violations = detectVariantViolations(caption);
      expect(violations).toContainEqual(
        expect.objectContaining({
          type: 'canned_cta',
          field: 'cta'
        })
      );
    });

    it('should return no violations for clean content', () => {
      const caption = createTestCaption({
        caption: "Enjoying the peaceful morning in my garden",
        alt: "Person tending to flowers in a sunlit garden",
        hashtags: ["#gardening", "#morninglight", "#peaceful"],
        cta: "What's your favorite flower?"
      });
      
      const violations = detectVariantViolations(caption);
      expect(violations).toHaveLength(0);
    });

    it('should detect multiple violation types', () => {
      const caption = createTestCaption({
        caption: "Check out this amazing content! ✨",
        alt: "A photo",
        hashtags: ["#content", "#amazing"],
        cta: "Link in bio!"
      });
      
      const violations = detectVariantViolations(caption);
      expect(violations).toHaveLength(3); // banned_phrase, generic_hashtag, canned_cta
    });
  });

  describe('sanitizeFinalVariant', () => {
    it('should sanitize caption with fallback content', () => {
      const caption = createTestCaption({
        caption: "✨ Amazing content! Check it out! ✨",
        alt: "A photo",
        hashtags: ["#content", "#creative"],
        cta: "Link in bio!"
      });
      
      const sanitized = sanitizeFinalVariant(caption, 'instagram');
      
      expect(sanitized.caption).not.toContain('✨');
      expect(sanitized.caption).not.toContain('Amazing content');
      expect(sanitized.cta).toBe(HUMAN_CTA);
      expect(sanitized.hashtags).toEqual(fallbackHashtags('instagram'));
    });

    it('should preserve good content unchanged', () => {
      const caption = createTestCaption({
        caption: "Enjoying the peaceful morning in my garden",
        alt: "Person tending to flowers in a sunlit garden",
        hashtags: ["#gardening", "#morninglight"],
        cta: "What's your favorite flower?"
      });
      
      const sanitized = sanitizeFinalVariant(caption, 'instagram');
      expect(sanitized).toEqual(caption);
    });

    it('should apply platform-specific hashtag limits', () => {
      const caption = createTestCaption({
        caption: "Beautiful day",
        alt: "A photo",
        hashtags: Array(10).fill("#test"), // Too many for X platform
        cta: "Nice!"
      });
      
      const sanitized = sanitizeFinalVariant(caption, 'x');
      expect(sanitized.hashtags).toHaveLength(2); // X platform limit
    });

    it('should provide empty hashtags for Reddit', () => {
      const caption = createTestCaption({
        caption: "Beautiful day",
        alt: "A photo", 
        hashtags: ["#test"],
        cta: "Nice!"
      });
      
      const sanitized = sanitizeFinalVariant(caption, 'reddit');
      expect(sanitized.hashtags).toEqual([]);
    });
  });

  describe('buildRerankHint', () => {
    it('should build rerank hint from violations', () => {
      const violations = [
        { type: 'banned_phrase' as const, field: 'caption' as const, content: '✨ Amazing content!' },
        { type: 'generic_hashtag' as const, field: 'hashtags' as const, content: '#content' }
      ];
      
      const hint = buildRerankHint(violations);
      expect(hint).toContain('sparkle emojis');
      expect(hint).toContain('generic hashtags');
      expect(hint).toContain('specific, engaging');
    });

    it('should return empty string for no violations', () => {
      const hint = buildRerankHint([]);
      expect(hint).toBe('');
    });
  });

  describe('formatViolationSummary', () => {
    it('should format violation summary', () => {
      const violations = [
        { type: 'banned_phrase' as const, field: 'caption' as const, content: '✨ Amazing!' },
        { type: 'canned_cta' as const, field: 'cta' as const, content: 'Link in bio!' }
      ];
      
      const summary = formatViolationSummary(violations);
      expect(summary).toContain('Sanitized');
      expect(summary).toContain('sparkle');
      expect(summary).toContain('canned CTA');
    });
  });

  describe('fallbackHashtags', () => {
    it('should return platform-specific hashtags', () => {
      expect(fallbackHashtags('instagram')).toEqual(['#behindthescenes', '#handcrafted', '#maker', '#creator']);
      expect(fallbackHashtags('x')).toEqual(['#thoughts']);
      expect(fallbackHashtags('reddit')).toEqual([]);
      expect(fallbackHashtags('tiktok')).toEqual(['#niche', '#authentic']);
    });

    it('should not return banned hashtags', () => {
      const allFallbacks = [
        ...fallbackHashtags('instagram'),
        ...fallbackHashtags('x'), 
        ...fallbackHashtags('tiktok')
      ];
      
      // Ensure no fallback hashtags are in the banned list
      const bannedHashtags = ['#content', '#creative', '#amazing', '#lifestyle', '#mood', '#vibes'];
      const intersection = allFallbacks.filter(tag => bannedHashtags.includes(tag));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('HUMAN_CTA', () => {
    it('should be a human-sounding CTA', () => {
      expect(HUMAN_CTA).toBe("What do you think?");
      expect(HUMAN_CTA).not.toContain('link');
      expect(HUMAN_CTA).not.toContain('bio');
      expect(HUMAN_CTA).not.toContain('follow');
    });
  });
});