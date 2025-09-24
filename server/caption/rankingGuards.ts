
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
  '#internet'
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

const SAFE_FALLBACK_HASHTAG_SET = new Set(
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
    .map(tag => tag.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(tag => tag.length >= 2 && tag.length <= 30)
    .filter(tag => !GENERIC_HASHTAGS.has(`#${tag}`))
    .filter(tag => !bannedExamples.some(banned => 
      tag.includes(banned.toLowerCase().replace(/[^a-z0-9]/g, ''))
    ));

  return cleaned.length > 0 
    ? Array.from(new Set(cleaned)).slice(0, 10).map(tag => `#${tag}`)
    : Array.from(SAFE_FALLBACK_HASHTAG_SET);
}

/**
 * Detect content that violates ranking guidelines
 */
export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations: string[] = [];
  
  const caption = variant.caption || '';
  const cta = variant.cta || '';
  const hashtags = variant.hashtags || [];

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
  const caption = (variant.caption || '').slice(0, 2200);
  const cta = variant.cta || safeFallbackCta;
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
  
  return violations.slice(0, -1).join(', ') + ` and ${violations[violations.length - 1]}`;
}

/**
 * Normalize unknown objects to ranking variants
 */
export function normalizeVariantForRanking(final: Record<string, unknown>): CaptionVariant {
  const safetyLevel = normalizeSafetyLevel(final.safetyLevel);
  
  return {
    caption: typeof final.caption === 'string' ? final.caption : safeFallbackCaption,
    cta: typeof final.cta === 'string' ? final.cta : safeFallbackCta,
    hashtags: Array.isArray(final.hashtags) 
      ? final.hashtags.filter((tag): tag is string => typeof tag === 'string')
      : [...safeFallbackHashtags],
    safetyLevel,
    photoInstructions: typeof final.photoInstructions === 'string' 
      ? final.photoInstructions 
      : undefined
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
