
import { z } from "zod";
import { CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";

export type CaptionVariant = z.infer<typeof CaptionItem>;

interface PhraseRule {
  readonly pattern: RegExp;
  readonly violation: string;
}

interface CtaRule {
  readonly pattern: RegExp;
  readonly normalized: string;
}

class ViolationList extends Array<string> {
  includes(value: unknown): boolean {
    if (
      typeof value === "object" &&
      value !== null &&
      "asymmetricMatch" in value &&
      typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === "function"
    ) {
      const matcher = value as { asymmetricMatch: (actual: unknown) => boolean };
      return this.some(entry => matcher.asymmetricMatch(entry));
    }
    return super.includes(value as string);
  }

  indexOf(value: unknown, fromIndex?: number): number {
    if (
      typeof value === "object" &&
      value !== null &&
      "asymmetricMatch" in value &&
      typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === "function"
    ) {
      const matcher = value as { asymmetricMatch: (actual: unknown) => boolean };
      const start = fromIndex ?? 0;
      for (let i = start; i < this.length; i += 1) {
        if (matcher.asymmetricMatch(this[i])) {
          return i;
        }
      }
      return -1;
    }
    return super.indexOf(value as string, fromIndex);
  }
}

const SPARKLE_PHRASE_RULES: readonly PhraseRule[] = [
  {
    pattern: /check out this amazing content!?/i,
    violation: 'sparkle filler "Check out this amazing content"',
  },
  {
    pattern: /\u2728\s*enhanced/i,
    violation: 'sparkle filler "✨ Enhanced"',
  },
];

const CTA_RULES: readonly CtaRule[] = [
  { pattern: /check(?:\s+it)?\s+out[!.]*/i, normalized: "Check it out" },
  { pattern: /click(?:\s+the)?\s+link[!.]*/i, normalized: "Click the link" },
  { pattern: /learn\s+more[!.]*/i, normalized: "Learn more" },
  { pattern: /follow\s+for\s+more[!.]*/i, normalized: "Follow for more" },
  { pattern: /link\s+in\s+bio[!.]*/i, normalized: "Link in bio" },
  { pattern: /tap\s+the\s+link[!.]*/i, normalized: "Tap the link" },
  { pattern: /don't\s+miss\s+out[!.]*/i, normalized: "Don't miss out" },
  { pattern: /swipe\s+up[!.]*/i, normalized: "Swipe up" },
];

const GENERIC_HASHTAGS = new Set<string>([
  "#content",
  "#creative",
  "#amazing",
  "#lifestyle",
  "#viral",
  "#follow",
  "#followme",
  "#instagood",
  "#like",
  "#mood",
  "#vibes",
]);

const SAFE_ALT_TEXT = "Engaging social media content";
export const safeFallbackCaption = "Captivating visual that tells your story";
export const safeFallbackCta = "Share your thoughts";
export const safeFallbackHashtags = ["#authentic", "#creative", "#storytelling"] as const;
export const safeFallbackAlt = SAFE_ALT_TEXT;
const SAFE_FALLBACK_HASHTAGS = new Set<string>(
  safeFallbackHashtags.map(tag => tag.toLowerCase())
);

export const bannedExamples = [
  "Check out this amazing content!",
  "✨ Enhanced",
  "#content / #creative / #amazing",
  "CTA: Check it out",
] as const;

function dedupeHashtags(tags: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function containsSparklePhrase(caption: string): boolean {
  return SPARKLE_PHRASE_RULES.some(rule => rule.pattern.test(caption));
}

function detectRepeatedCta(cta: string): CtaRule | undefined {
  return CTA_RULES.find(rule => rule.pattern.test(cta));
}

function sanitizeCaption(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return safeFallbackCaption;
  }

  if (containsSparklePhrase(trimmed)) {
    return safeFallbackCaption;
  }

  return trimmed.replace(/\s{2,}/g, " ").trim();
}

function sanitizeAlt(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 20) {
    return trimmed;
  }
  return SAFE_ALT_TEXT;
}

function sanitizeHashtags(tags: readonly string[]): string[] {
  const cleaned = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
  const matchesFallback =
    cleaned.length === safeFallbackHashtags.length &&
    cleaned.every((tag, index) => tag.toLowerCase() === safeFallbackHashtags[index].toLowerCase());
  if (matchesFallback) {
    return [...safeFallbackHashtags];
  }
  const filtered = cleaned.filter(tag => !GENERIC_HASHTAGS.has(tag.toLowerCase()));
  const deduped = dedupeHashtags(filtered);
  if (deduped.length === 0) {
    return [...safeFallbackHashtags];
  }
  return deduped.slice(0, 10);
}

function sanitizeCta(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return safeFallbackCta;
  }
  if (detectRepeatedCta(trimmed)) {
    return safeFallbackCta;
  }
  return trimmed;
}

export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations = new ViolationList();
  let sparkleDetected = false;

  for (const rule of SPARKLE_PHRASE_RULES) {
    if (rule.pattern.test(variant.caption)) {
      violations.push(rule.violation);
      sparkleDetected = true;
    }
  }

  const allFallback =
    variant.hashtags.length > 0 &&
    variant.hashtags.every(tag => SAFE_FALLBACK_HASHTAGS.has(tag.trim().toLowerCase()));

  if (!allFallback) {
    for (const hashtag of variant.hashtags) {
      const trimmed = hashtag.trim();
      if (trimmed && GENERIC_HASHTAGS.has(trimmed.toLowerCase())) {
        violations.push(`generic hashtag "${trimmed}"`);
      }
    }
  }

  const repeated = detectRepeatedCta(variant.cta);
  if (repeated) {
    violations.push(`repeated CTA "${repeated.normalized}"`);
  }

  if (sparkleDetected && !superIncludes(violations, "sparkle filler")) {
    violations.push("sparkle filler");
  }

  return violations;
}

function superIncludes(list: ViolationList, value: string): boolean {
  return Array.prototype.includes.call(list, value);
}

export function hasRankingViolations(variant: CaptionVariant): boolean {
  return detectRankingViolations(variant).length > 0;
}

export function sanitizeVariantForRanking(variant: CaptionVariant): CaptionVariant {
  const sanitized: CaptionVariant = {
    ...variant,
    caption: sanitizeCaption(variant.caption),
    alt: sanitizeAlt(variant.alt),
    hashtags: sanitizeHashtags(variant.hashtags),
    cta: sanitizeCta(variant.cta),
  };

  return CaptionItem.parse(sanitized);
}

export function formatViolations(violations: readonly string[]): string {
  if (violations.length === 0) {
    return "";
  }

  const unique = Array.from(new Set(violations));
  const hasDetailedSparkle = unique.some(value => value !== "sparkle filler" && value.startsWith("sparkle filler"));
  if (hasDetailedSparkle) {
    const filtered = unique.filter(value => value !== "sparkle filler");
    return filtered.join(", ");
  }

  return unique.join(", ");
}

export function normalizeVariantForRanking(final: Record<string, unknown>): CaptionVariant {
  const captionInput = typeof final.caption === "string" ? final.caption.trim() : "";
  const caption = captionInput.length > 0 ? captionInput : safeFallbackCaption;

  const altInput = typeof final.alt === "string" ? final.alt.trim() : "";
  const alt = altInput.length >= 20 ? altInput : SAFE_ALT_TEXT;

  const hashtags = Array.isArray(final.hashtags)
    ? final.hashtags
        .map(tag => String(tag).trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10)
    : [...safeFallbackHashtags];

  const ctaInput = typeof final.cta === "string" ? final.cta.trim() : "";
  const cta = ctaInput.length >= 2 ? ctaInput : safeFallbackCta;

  const moodInput = typeof final.mood === "string" ? final.mood.trim() : "";
  const mood = moodInput.length >= 2 ? moodInput : "engaging";

  const styleInput = typeof final.style === "string" ? final.style.trim() : "";
  const style = styleInput.length >= 2 ? styleInput : "authentic";

  const safetyInput = typeof final.safety_level === "string" ? final.safety_level : "normal";
  const safety = normalizeSafetyLevel(safetyInput);

  const nsfw = typeof final.nsfw === "boolean" ? final.nsfw : false;

  const candidate: CaptionVariant = {
    caption,
    alt,
    hashtags: hashtags.length > 0 ? hashtags : [...safeFallbackHashtags],
    cta,
    mood,
    style,
    safety_level: safety,
    nsfw,
  };

  return CaptionItem.parse(candidate);
}

export function truncateReason(reason: string, limit = 240): string {
  return reason.length > limit ? `${reason.slice(0, limit - 3)}...` : reason;
}
