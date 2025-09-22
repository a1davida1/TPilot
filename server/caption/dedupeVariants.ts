import { z } from "zod";
import { CaptionArray } from "./schema";
import { inferFallbackFromFacts } from "./inferFallbackFromFacts";

const LENGTH_GAP_THRESHOLD = 8;

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
  const root = cleaned.length > 0 ? cleaned : "Check out this amazing content!";
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
  const fallbackData = context && context.platform ? inferFallbackFromFacts(context as Required<Pick<typeof context, 'platform'>> & typeof context) : null;
  const base = uniques[0] ?? duplicates[0] ?? {
    caption: "Check out this amazing content!",
    alt: fallbackData?.alt ?? "Engaging social media content",
    hashtags: fallbackData?.hashtags ?? ["#content", "#creative", "#amazing"],
    cta: fallbackData?.cta ?? "Check it out",
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
      hashtags: fallbackData?.hashtags ?? source.hashtags,
      cta: fallbackData?.cta ?? source.cta,
      alt: fallbackData?.alt ?? source.alt,
    });
  }

  if (uniques.length > targetLength) {
    uniques.length = targetLength;
  }

  return uniques;
}