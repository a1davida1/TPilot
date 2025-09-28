import { z } from "zod";
import { CaptionArray } from "./schema";
import { inferFallbackFromFacts } from "./inferFallbackFromFacts";
import { fallbackHashtags, HUMAN_CTA } from "./rankGuards";

const LENGTH_GAP_THRESHOLD = 8;
const SAFE_DEFAULT_CAPTION = "Sharing a moment that means a lot to me.";
const SAFE_DEFAULT_ALT = "Detailed description available for everyone.";
const REDDIT_FALLBACK_TAGS = ["community spotlight"];

function minimumHashtagCount(platform?: string): number {
  switch (platform) {
    case "instagram":
      return 3;
    case "tiktok":
      return 2;
    case "reddit":
      return 1;
    case "x":
    default:
      return 1;
  }
}

function resolveFallbackHashtags(platform?: string): string[] {
  const fallback = fallbackHashtags(platform);
  if (fallback.length > 0) {
    return [...fallback];
  }
  if (platform === "reddit") {
    return [...REDDIT_FALLBACK_TAGS];
  }
  return ["#thoughts"];
}

function sanitizeHashtagList(hashtags: string[] | undefined, min: number): string[] {
  if (!Array.isArray(hashtags)) return [];
  const sanitized = hashtags
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  return sanitized.length >= min ? sanitized : [];
}

type CaptionVariant = z.infer<typeof CaptionArray>[number];

function normalizeCaption(caption: string): string {
  return caption.trim().toLowerCase();
}

function isNearDuplicate(existing: string, candidate: string): boolean {
  if (existing === candidate) return true;

  const lengthGap = Math.abs(existing.length - candidate.length);
  if (lengthGap > LENGTH_GAP_THRESHOLD) return false;

  const shorter = existing.length <= candidate.length ? existing : candidate;
  const longer = existing.length > candidate.length ? existing : candidate;
  return shorter.length > 0 && longer.startsWith(shorter);
}

function buildFreshCaption(baseCaption: string, index: number): string {
  const cleaned = baseCaption.trim();
  const root = cleaned.length > 0 ? cleaned : SAFE_DEFAULT_CAPTION;
  return `Fresh POV ${index}: ${root}`;
}

export function dedupeVariantsForRanking(
  variants: z.infer<typeof CaptionArray>,
  targetLength = 5,
  context?: {
    platform?: "instagram" | "x" | "reddit" | "tiktok";
    facts?: Record<string, unknown>;
    theme?: string;
    context?: string;
    includeHashtags?: boolean;
  }
): z.infer<typeof CaptionArray> {
  const uniques: CaptionVariant[] = [];
  const duplicates: CaptionVariant[] = [];

  for (const variant of variants) {
    const normalized = normalizeCaption(variant.caption);
    if (!normalized) {
      duplicates.push(variant);
      continue;
    }

    const hasMatch = uniques.some(existing =>
      isNearDuplicate(normalizeCaption(existing.caption), normalized)
    );

    if (hasMatch) {
      duplicates.push(variant);
    } else {
      uniques.push(variant);
    }
  }

  // Get contextual fallback data for padding if needed
  const includeHashtags = context?.includeHashtags ?? true;
  const fallbackData = context?.platform
    ? inferFallbackFromFacts({
        platform: context.platform,
        facts: context.facts,
        theme: context.theme,
        context: context.context,
      })
    : null;
  const platform = context?.platform;
  const minHashtags = includeHashtags ? minimumHashtagCount(platform) : 0;
  const inferredHashtags = sanitizeHashtagList(fallbackData?.hashtags, minHashtags);
  const fallbackTags = includeHashtags
    ? (inferredHashtags.length >= minHashtags
        ? inferredHashtags
        : resolveFallbackHashtags(platform))
    : [];
  const fallbackAlt =
    typeof fallbackData?.alt === "string" && fallbackData.alt.trim().length >= 20
      ? fallbackData.alt.trim()
      : SAFE_DEFAULT_ALT;
  const fallbackCta =
    typeof fallbackData?.cta === "string" && fallbackData.cta.trim().length >= 2
      ? fallbackData.cta.trim()
      : HUMAN_CTA;
  const base = uniques[0] ?? duplicates[0] ?? {
    caption: SAFE_DEFAULT_CAPTION,
    alt: fallbackAlt,
    hashtags: includeHashtags ? [...fallbackTags] : [],
    cta: fallbackCta,
    mood: "engaging",
    style: "authentic",
    safety_level: "normal",
    nsfw: false,
  } as CaptionVariant;

  while (uniques.length < targetLength) {
    const source = duplicates.shift() ?? base;
    const index = uniques.length + 1;
    const freshCaption = buildFreshCaption(source.caption, index);
    uniques.push({
      ...source,
      caption: freshCaption,
      hashtags: includeHashtags ? [...fallbackTags] : [],
      cta: fallbackCta,
      alt: fallbackAlt,
    });
  }

  if (uniques.length > targetLength) {
    uniques.length = targetLength;
  }

  return uniques;
}