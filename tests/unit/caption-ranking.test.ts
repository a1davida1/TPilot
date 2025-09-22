import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectRankingViolations, formatViolations, sanitizeVariantForRanking, normalizeVariantForRanking } from '../../server/caption/rankingGuards';
import type { CaptionVariant } from '../../server/caption/rankingGuards';

describe('Ranking Guards', () => {
  describe('detectRankingViolations', () => {
    it('should detect sparkle filler phrases', () => {
      const variant: CaptionVariant = {
        caption: 'Check out this amazing content!',
        alt: 'Engaging social media content',
        hashtags: ['#photography'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const violations = detectRankingViolations(variant);
      expect(violations).toContain('sparkle filler "Check out this amazing content"');
    });

    it('should detect enhanced sparkle filler phrases', () => {
      const variant: CaptionVariant = {
        caption: 'This is ✨ Enhanced content for you',
        alt: 'Engaging social media content',
        hashtags: ['#photography'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const violations = detectRankingViolations(variant);
      expect(violations).toContain('sparkle filler "✨ Enhanced"');
    });

    it('should detect generic hashtags', () => {
      const variant: CaptionVariant = {
        caption: 'Beautiful sunset photo',
        alt: 'Engaging social media content',
        hashtags: ['#content', '#creative', '#amazing'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const violations = detectRankingViolations(variant);
      expect(violations).toContain('generic hashtag "#content"');
      expect(violations).toContain('generic hashtag "#creative"');
      expect(violations).toContain('generic hashtag "#amazing"');
    });

    it('should detect repeated CTA templates', () => {
      const variant: CaptionVariant = {
        caption: 'Beautiful sunset photo',
        alt: 'Engaging social media content',
        hashtags: ['#photography'],
        cta: 'Check it out!',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const violations = detectRankingViolations(variant);
      expect(violations).toContain('repeated CTA "Check it out"');
    });

    it('should return no violations for clean content', () => {
      const variant: CaptionVariant = {
        caption: 'Capturing the golden hour magic at the beach today',
        alt: 'Stunning beach sunset with golden light reflecting on waves',
        hashtags: ['#photography', '#sunset', '#beach'],
        cta: 'What do you think?',
        mood: 'peaceful',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const violations = detectRankingViolations(variant);
      expect(violations).toHaveLength(0);
    });
  });

  describe('formatViolations', () => {
    it('should format multiple violations correctly', () => {
      const violations = ['sparkle filler "Check out this amazing content"', 'generic hashtag "#content"'];
      const formatted = formatViolations(violations);
      expect(formatted).toBe('sparkle filler "Check out this amazing content", generic hashtag "#content"');
    });

    it('should handle single violation', () => {
      const violations = ['repeated CTA "Check it out"'];
      const formatted = formatViolations(violations);
      expect(formatted).toBe('repeated CTA "Check it out"');
    });

    it('should handle empty violations', () => {
      const violations: string[] = [];
      const formatted = formatViolations(violations);
      expect(formatted).toBe('');
    });
  });

  describe('sanitizeVariantForRanking', () => {
    it('should sanitize sparkle filler in caption', () => {
      const variant: CaptionVariant = {
        caption: 'Check out this amazing content!',
        alt: 'Engaging social media content',
        hashtags: ['#photography'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const sanitized = sanitizeVariantForRanking(variant);
      expect(sanitized.caption).toBe('Captivating visual that tells your story');
      expect(sanitized.caption).not.toContain('Check out this amazing content');
    });

    it('should sanitize repeated CTA templates', () => {
      const variant: CaptionVariant = {
        caption: 'Beautiful sunset photo',
        alt: 'Engaging social media content',
        hashtags: ['#photography'],
        cta: 'Check it out!',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const sanitized = sanitizeVariantForRanking(variant);
      expect(sanitized.cta).toBe('Share your thoughts');
      expect(sanitized.cta).not.toContain('Check it out');
    });

    it('should filter out generic hashtags', () => {
      const variant: CaptionVariant = {
        caption: 'Beautiful sunset photo',
        alt: 'Engaging social media content',
        hashtags: ['#content', '#creative', '#amazing', '#photography'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const sanitized = sanitizeVariantForRanking(variant);
      expect(sanitized.hashtags).toEqual(['#photography']);
      expect(sanitized.hashtags).not.toContain('#content');
      expect(sanitized.hashtags).not.toContain('#creative');
      expect(sanitized.hashtags).not.toContain('#amazing');
    });

    it('should use fallback hashtags when all are filtered', () => {
      const variant: CaptionVariant = {
        caption: 'Beautiful sunset photo',
        alt: 'Engaging social media content',
        hashtags: ['#content', '#creative', '#amazing'],
        cta: 'Share your thoughts',
        mood: 'engaging',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const sanitized = sanitizeVariantForRanking(variant);
      expect(sanitized.hashtags).toEqual(['#authentic', '#creative', '#storytelling']);
    });

    it('should preserve clean content without changes', () => {
      const variant: CaptionVariant = {
        caption: 'Capturing the golden hour magic at the beach today',
        alt: 'Stunning beach sunset with golden light reflecting on waves',
        hashtags: ['#photography', '#sunset', '#beach'],
        cta: 'What do you think?',
        mood: 'peaceful',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false,
      };

      const sanitized = sanitizeVariantForRanking(variant);
      expect(sanitized).toEqual(variant);
    });
  });

  describe('normalizeVariantForRanking', () => {
    it('should normalize variant with missing fields', () => {
      const rawVariant: Record<string, unknown> = {
        caption: 'Test caption',
        // Missing other required fields
      };

      const normalized = normalizeVariantForRanking(rawVariant);
      expect(normalized.caption).toBe('Test caption');
      expect(normalized.alt).toBe('Engaging social media content');
      expect(normalized.hashtags).toEqual(['#authentic', '#creative', '#storytelling']);
      expect(normalized.cta).toBe('Share your thoughts');
      expect(normalized.mood).toBe('engaging');
      expect(normalized.style).toBe('authentic');
      expect(normalized.safety_level).toBe('normal');
      expect(normalized.nsfw).toBe(false);
    });

    it('should normalize variant with invalid field types', () => {
      const rawVariant: Record<string, unknown> = {
        caption: 123, // Wrong type
        alt: '', // Too short
        hashtags: 'not an array', // Wrong type
        cta: '', // Too short
        mood: 'x', // Too short
        style: null, // Wrong type
        safety_level: 'invalid',
        nsfw: 'yes', // Wrong type
      };

      const normalized = normalizeVariantForRanking(rawVariant);
      expect(normalized.caption).toBe('Captivating visual that tells your story');
      expect(normalized.alt).toBe('Engaging social media content');
      expect(normalized.hashtags).toEqual(['#authentic', '#creative', '#storytelling']);
      expect(normalized.cta).toBe('Share your thoughts');
      expect(normalized.mood).toBe('engaging');
      expect(normalized.style).toBe('authentic');
      expect(normalized.safety_level).toBe('normal');
      expect(normalized.nsfw).toBe(false);
    });

    it('should preserve valid fields', () => {
      const rawVariant: Record<string, unknown> = {
        caption: 'Valid caption content',
        alt: 'A detailed description of the image content',
        hashtags: ['#photography', '#nature'],
        cta: 'Let me know your thoughts',
        mood: 'inspirational',
        style: 'professional',
        safety_level: 'spicy_safe',
        nsfw: true,
      };

      const normalized = normalizeVariantForRanking(rawVariant);
      expect(normalized.caption).toBe('Valid caption content');
      expect(normalized.alt).toBe('A detailed description of the image content');
      expect(normalized.hashtags).toEqual(['#photography', '#nature']);
      expect(normalized.cta).toBe('Let me know your thoughts');
      expect(normalized.mood).toBe('inspirational');
      expect(normalized.style).toBe('professional');
      expect(normalized.safety_level).toBe('spicy_safe');
      expect(normalized.nsfw).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should handle the complete flow from raw variant to sanitized result', () => {
      const rawVariant: Record<string, unknown> = {
        caption: 'Check out this amazing content! ✨ Enhanced for maximum engagement',
        alt: 'Cool pic',
        hashtags: ['#content', '#creative', '#amazing', '#photography'],
        cta: 'Click the link!',
        mood: '',
        style: null,
        safety_level: 'unknown',
        nsfw: null,
      };

      // Step 1: Normalize
      const normalized = normalizeVariantForRanking(rawVariant);
      
      // Step 2: Detect violations
      const violations = detectRankingViolations(normalized);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations).toContain(expect.stringContaining('sparkle filler'));
      expect(violations).toContain(expect.stringContaining('generic hashtag'));
      expect(violations).toContain(expect.stringContaining('repeated CTA'));

      // Step 3: Sanitize
      const sanitized = sanitizeVariantForRanking(normalized);
      
      // Step 4: Verify clean result
      const finalViolations = detectRankingViolations(sanitized);
      expect(finalViolations).toHaveLength(0);
      
      expect(sanitized.caption).not.toContain('Check out this amazing content');
      expect(sanitized.caption).not.toContain('✨ Enhanced');
      expect(sanitized.hashtags).not.toContain('#content');
      expect(sanitized.hashtags).not.toContain('#creative');
      expect(sanitized.hashtags).not.toContain('#amazing');
      expect(sanitized.cta).not.toContain('Click the link');
    });
  });
});