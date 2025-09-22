import { z } from "zod";
import { CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";

const CAPTION_RULES: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /check out this amazing content!?/i, description: 'sparkle filler "Check out this amazing content"' },
  { pattern: /✨\s*enhanced/i, description: 'sparkle filler "✨ Enhanced"' },
  { pattern: /amazing\s+content/i, description: 'sparkle filler "amazing content"' },
  { pattern: /absolutely\s+stunning/i, description: 'sparkle filler "absolutely stunning"' },
  { pattern: /incredibly\s+beautiful/i, description: 'sparkle filler "incredibly beautiful"' },
];

const HASHTAG_RULES: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /#content\b/i, description: 'generic hashtag "#content"' },
  { pattern: /#creative\b/i, description: 'generic hashtag "#creative"' },
  { pattern: /#amazing\b/i, description: 'generic hashtag "#amazing"' },
  { pattern: /#lifestyle\b/i, description: 'generic hashtag "#lifestyle"' },
  { pattern: /#vibes\b/i, description: 'generic hashtag "#vibes"' },
  { pattern: /#mood\b/i, description: 'generic hashtag "#mood"' },
];

const CTA_RULES: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /check it out!?/i, description: 'repeated CTA "Check it out"' },
  { pattern: /click the link!?/i, description: 'repeated CTA "Click the link"' },
  { pattern: /link in bio!?/i, description: 'repeated CTA "Link in bio"' },
  { pattern: /swipe up!?/i, description: 'repeated CTA "Swipe up"' },
];

export const bannedExamples = [
  "Check out this amazing content!",
  "✨ Enhanced",
  "Check it out",
  "Click the link",
  "#content #creative #amazing #lifestyle",
];

export type CaptionVariant = z.infer<typeof CaptionItem>;

function detectCaptionViolations(caption: string): string[] {
  const violations: string[] = [];
  
  for (const rule of CAPTION_RULES) {
    if (rule.pattern.test(caption)) {
      violations.push(rule.description);
    }
  }
  
  return violations;
}

function detectHashtagViolations(hashtags: string[]): string[] {
  const violations: string[] = [];
  
  for (const hashtag of hashtags) {
    for (const rule of HASHTAG_RULES) {
      if (rule.pattern.test(hashtag)) {
        violations.push(rule.description);
      }
    }
  }
  
  return violations;
}

function detectCtaViolations(cta: string): string[] {
  const violations: string[] = [];
  
  for (const rule of CTA_RULES) {
    if (rule.pattern.test(cta)) {
      violations.push(rule.description);
    }
  }
  
  return violations;
}

export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations: string[] = [];
  
  const caption = typeof variant.caption === 'string' ? variant.caption : '';
  const cta = typeof variant.cta === 'string' ? variant.cta : '';
  const hashtags = Array.isArray(variant.hashtags) ? variant.hashtags : [];
  
  violations.push(...detectCaptionViolations(caption));
  violations.push(...detectCtaViolations(cta));
  violations.push(...detectHashtagViolations(hashtags));
  
  return violations;
}

export function formatViolations(violations: string[]): string {
  return violations.join(', ');
}

export const safeFallbackCaption = "Captivating visual that tells your story";
export const safeFallbackCta = "Share your thoughts";
export const safeFallbackHashtags = ["#authentic", "#storytelling", "#behindthescenes"];

function sanitizeCaption(caption: string): string {
  let cleaned = caption;
  
  for (const rule of CAPTION_RULES) {
    cleaned = cleaned.replace(rule.pattern, safeFallbackCaption);
  }
  
  // Remove excessive punctuation and emojis
  cleaned = cleaned.replace(/✨+/g, '').replace(/!{2,}/g, '!').trim();
  
  return cleaned || safeFallbackCaption;
}

function sanitizeCta(cta: string): string {
  let cleaned = cta;
  
  for (const rule of CTA_RULES) {
    cleaned = cleaned.replace(rule.pattern, safeFallbackCta);
  }
  
  return cleaned || safeFallbackCta;
}

function sanitizeHashtags(hashtags: string[]): string[] {
  const cleaned = hashtags.filter(tag => {
    return !HASHTAG_RULES.some(rule => rule.pattern.test(tag));
  });
  
  // If all hashtags were filtered out, use safe fallbacks
  if (cleaned.length === 0) {
    return [...safeFallbackHashtags];
  }
  
  // If we have fewer than 3 hashtags, add safe ones
  while (cleaned.length < 3 && cleaned.length < safeFallbackHashtags.length) {
    const nextSafe = safeFallbackHashtags[cleaned.length];
    if (!cleaned.includes(nextSafe)) {
      cleaned.push(nextSafe);
    }
  }
  
  return cleaned;
}

export function normalizeVariantForRanking(variant: Record<string, unknown>): CaptionVariant {
  const caption = typeof variant.caption === 'string' ? variant.caption : safeFallbackCaption;
  const alt = typeof variant.alt === 'string' && variant.alt.length >= 20 ? variant.alt : "Engaging social media content";
  const hashtags = Array.isArray(variant.hashtags) ? variant.hashtags.filter(h => typeof h === 'string') : [...safeFallbackHashtags];
  const cta = typeof variant.cta === 'string' && variant.cta.length >= 2 ? variant.cta : safeFallbackCta;
  const mood = typeof variant.mood === 'string' && variant.mood.length >= 2 ? variant.mood : "engaging";
  const style = typeof variant.style === 'string' && variant.style.length >= 2 ? variant.style : "authentic";
  const safety_level = normalizeSafetyLevel(typeof variant.safety_level === 'string' ? variant.safety_level : 'normal');
  const nsfw = typeof variant.nsfw === 'boolean' ? variant.nsfw : false;
  
  return {
    caption,
    alt,
    hashtags,
    cta,
    mood,
    style,
    safety_level,
    nsfw,
  };
}

export function sanitizeVariantForRanking(variant: CaptionVariant): CaptionVariant {
  return {
    ...variant,
    caption: sanitizeCaption(variant.caption),
    cta: sanitizeCta(variant.cta),
    hashtags: sanitizeHashtags(variant.hashtags),
  };
}

export function truncateReason(reason: string): string {
  if (reason.length <= 240) {
    return reason;
  }
  return reason.substring(0, 237) + '...';
}