
import { z } from "zod";
import { CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";

export type CaptionVariant = z.infer<typeof CaptionItem>;

/**
 * Hashtags that are too generic and don't provide meaningful ranking signal
 */
const GENERIC_HASHTAGS = new Set<string>([
  '#content',
  '#post',
  '#photo',
  '#pic',
  '#image',
  '#share',
  '#like',
  '#follow',
  '#instagram',
  '#reddit',
  '#social',
  '#media',
  '#online',
  '#digital',
  '#internet',
  '#creative',
  '#amazing'
]);

/**
 * Safe fallback values for ranking failures
 */
export const safeFallbackCaption = "Captivating visual that tells your story";
export const safeFallbackCta = "Share your thoughts";
export const safeFallbackHashtags = [
  "#authentic",
  "#creative", 
  "#storytelling"
] as const;

const _SAFE_FALLBACK_HASHTAG_SET = new Set(
  safeFallbackHashtags.map(tag => tag.toLowerCase())
);

export const bannedExamples = [
  "Click here for more",
  "Link in bio", 
  "DM for details",
  "Subscribe now",
  "Buy my content",
  "OnlyFans",
  "Cashapp",
  "Venmo",
  "PayPal",
  "$$$",
  "💰",
  "🤑"
];

/**
 * Remove problematic hashtags that could harm ranking
 */
function sanitizeHashtags(tags: readonly string[]): string[] {
  const cleaned = tags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .filter(tag => !GENERIC_HASHTAGS.has(tag.toLowerCase()))
    .filter(tag => !bannedExamples.some(banned => 
      tag.toLowerCase().includes(banned.toLowerCase())
    ));

  return cleaned.length > 0 
    ? Array.from(new Set(cleaned)).slice(0, 10)
    : [...safeFallbackHashtags];
}

/**
 * Patterns that indicate sparkle filler content
 */
const SPARKLE_FILLER_PATTERNS = [
  /check out this amazing content/i,
  /✨\s*enhanced/i,
  /amazing content/i,
  /incredible/i,
  /stunning/i,
  /absolutely gorgeous/i,
  /mind-blowing/i
];

/**
 * Common repeated CTA templates
 */
const REPEATED_CTA_PATTERNS = [
  /check it out/i,
  /click the link/i,
  /link in bio/i,
  /swipe up/i,
  /tap the link/i,
  /more in comments/i
];

/**
 * Detect content that violates ranking guidelines
 */
export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations: string[] = [];
  
  const caption = variant.caption || '';
  const cta = variant.cta || '';
  const hashtags = variant.hashtags || [];

  // Check for sparkle filler phrases in caption
  for (const pattern of SPARKLE_FILLER_PATTERNS) {
    const match = caption.match(pattern);
    if (match) {
      violations.push(`sparkle filler "${match[0]}"`);
    }
  }

  // Check for generic hashtags
  for (const hashtag of hashtags) {
    if (GENERIC_HASHTAGS.has(hashtag.toLowerCase())) {
      violations.push(`generic hashtag "${hashtag}"`);
    }
  }

  // Check for repeated CTA templates
  for (const pattern of REPEATED_CTA_PATTERNS) {
    const match = cta.match(pattern);
    if (match) {
      violations.push(`repeated CTA "${match[0]}"`);
    }
  }

  // Check for banned phrases
  const allText = `${caption} ${cta} ${hashtags.join(' ')}`.toLowerCase();
  for (const banned of bannedExamples) {
    if (allText.includes(banned.toLowerCase())) {
      violations.push(`Contains banned phrase: "${banned}"`);
    }
  }

  // Check caption length
  if (caption.length > 2200) {
    violations.push('Caption exceeds maximum length (2200 characters)');
  }

  // Check hashtag count
  if (hashtags.length > 30) {
    violations.push('Too many hashtags (max 30)');
  }

  return violations;
}

/**
 * Quick check if variant has any violations
 */
export function hasRankingViolations(variant: CaptionVariant): boolean {
  return detectRankingViolations(variant).length > 0;
}

/**
 * Clean up variant to meet ranking guidelines
 */
export function sanitizeVariantForRanking(variant: CaptionVariant): CaptionVariant {
  let caption = (variant.caption || '').slice(0, 2200);
  let cta = variant.cta || safeFallbackCta;
  
  // Remove sparkle filler phrases from caption
  for (const pattern of SPARKLE_FILLER_PATTERNS) {
    if (pattern.test(caption)) {
      caption = safeFallbackCaption;
      break;
    }
  }
  
  // Replace problematic CTAs
  for (const pattern of REPEATED_CTA_PATTERNS) {
    if (pattern.test(cta)) {
      cta = safeFallbackCta;
      break;
    }
  }

  const hashtags = sanitizeHashtags(variant.hashtags || []);

  return {
    ...variant,
    caption,
    cta,
    hashtags: hashtags.slice(0, 30)
  };
}

/**
 * Format violations for display
 */
export function formatViolations(violations: readonly string[]): string {
  if (violations.length === 0) return '';
  if (violations.length === 1) return violations[0];
  
  return violations.join(', ');
}

/**
 * Normalize unknown objects to ranking variants
 */
export function normalizeVariantForRanking(final: Record<string, unknown>): CaptionVariant {
  const rawSafetyLevel = typeof final.safety_level === 'string' ? final.safety_level : 'normal';
  const safetyLevel = normalizeSafetyLevel(rawSafetyLevel);

  const caption = typeof final.caption === 'string' ? final.caption : safeFallbackCaption;
  const alt =
    typeof final.alt === 'string' && final.alt.trim().length >= 20
      ? final.alt
      : 'Engaging social media content';
  const cta = typeof final.cta === 'string' && final.cta.trim().length >= 2 ? final.cta : safeFallbackCta;
  const mood =
    typeof final.mood === 'string' && final.mood.trim().length >= 2 ? final.mood : 'engaging';
  const style =
    typeof final.style === 'string' && final.style.trim().length >= 2 ? final.style : 'authentic';
  const normalizedHashtags = Array.isArray(final.hashtags)
    ? final.hashtags
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    : [];
  const hashtags = normalizedHashtags.length > 0 ? normalizedHashtags.slice(0, 10) : [...safeFallbackHashtags];

  return {
    caption,
    alt,
    cta,
    hashtags,
    mood,
    style,
    safety_level: safetyLevel,
    nsfw: typeof final.nsfw === 'boolean' ? final.nsfw : false
  };
}

/**
 * Truncate text while preserving meaning
 */
export function truncateReason(reason: string, limit = 240): string {
  if (reason.length <= limit) return reason;
  
  const truncated = reason.slice(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return (lastSpace > limit * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '...';
}
