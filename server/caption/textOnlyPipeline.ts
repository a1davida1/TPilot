import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { textModel } from "../lib/gemini";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { BANNED_WORDS_HINT, variantContainsBannedWord } from "./bannedWords";
import { buildVoiceGuideBlock } from "./stylePack";
import { formatVoiceContext } from "./voiceTraits";
import { serializePromptField } from "./promptUtils";
import { inferFallbackFromFacts, ensureFallbackCompliance } from "./inferFallbackFromFacts";
import { dedupeVariantsForRanking } from "./dedupeVariants";
import { dedupeCaptionVariants } from "./dedupeCaptionVariants";
import {
  HUMAN_CTA,
  buildRerankHint,
  detectVariantViolations,
  fallbackHashtags,
  formatViolationSummary,
  sanitizeFinalVariant
} from "./rankGuards";

const MAX_VARIANT_ATTEMPTS = 4;
const VARIANT_TARGET = 5;
const VARIANT_RETRY_LIMIT = 4;
const CAPTION_KEY_LENGTH = 80;

// Fallback values for when generation fails or is incomplete
const safeFallbackCaption = "Here's something I'm proud of today.";
const safeFallbackAlt = "Engaging description that highlights the visual story.";
const safeFallbackHashtags = ["#creative", "#inspiration", "#contentcreation"];
const safeFallbackCta = "Learn More";

function captionKey(caption: string): string {
  return caption.trim().slice(0, 80).toLowerCase();
}

function hintSnippet(caption: string): string {
  const normalized = caption.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
}

function uniqueCaptionKey(caption: string): string {
  return caption.trim().slice(0, CAPTION_KEY_LENGTH).toLowerCase();
}

function truncateForHint(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length <= 60) {
    return trimmed;
  }
  return `${trimmed.slice(0, 57)}...`;
}

function buildRetryHint(
  baseHint: string | undefined,
  duplicates: string[],
  needed: number
): string {
  const parts: string[] = [];
  if (baseHint && baseHint.trim().length > 0) {
    parts.push(baseHint.trim());
  }
  if (duplicates.length > 0) {
    const lastDuplicate = duplicates[duplicates.length - 1];
    parts.push(
      `You already wrote "${truncateForHint(lastDuplicate)}". Deliver a fresh angle and add ${needed} more unique caption${needed > 1 ? "s" : ""}.`
    );
  } else {
    parts.push(
      `Need ${needed} more unique caption${needed > 1 ? "s" : ""}. Explore a different perspective with new imagery details.`
    );
  }
  return parts.join(" ").trim();
}

function sanitizeHintForRetry(hint: string | undefined): string | undefined {
  if (!hint) {
    return undefined;
  }

  let sanitized = "";
  for (let index = 0; index < hint.length; index += 1) {
    const char = hint[index];
    const code = hint.charCodeAt(index);
    if (char === "\n") {
      sanitized += char;
    } else if (code < 32 || code === 127) {
      sanitized += " ";
    } else {
      sanitized += char;
    }
  }

  return sanitized;
}

function normalizeVariantFields(
  variant: Record<string, unknown>, 
  platform: "instagram" | "x" | "reddit" | "tiktok",
  theme?: string,
  context?: string,
  existingCaption?: string
): z.infer<typeof CaptionItem> {
  const next: Record<string, unknown> = { ...variant };
  next.safety_level = normalizeSafetyLevel(
    typeof next.safety_level === "string" ? next.safety_level : "normal"
  );
  if (typeof next.mood !== "string" || next.mood.trim().length < 2) next.mood = "engaging";
  if (typeof next.style !== "string" || next.style.trim().length < 2) next.style = "authentic";

  // Use helper for contextual fallbacks
  const fallback = ensureFallbackCompliance(
    {
      caption: typeof next.caption === 'string' ? next.caption : undefined,
      hashtags: Array.isArray(next.hashtags) ? next.hashtags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      cta: typeof next.cta === 'string' ? next.cta : undefined,
      alt: typeof next.alt === 'string' ? next.alt : undefined,
    },
    {
      platform,
      theme,
      context,
      existingCaption: existingCaption || (typeof next.caption === 'string' ? next.caption : undefined),
    }
  );

  next.hashtags = fallback.hashtags;
  next.cta = fallback.cta;
  next.alt = fallback.alt;

  if (typeof next.caption !== "string" || next.caption.trim().length < 1) {
    next.caption = existingCaption || "Here's something I'm proud of today.";
  }

  return CaptionItem.parse(next);
}

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

function normalizeCaptionText(caption: string): string {
  return caption
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols);
    row[0] = i;
    return row;
  });

  for (let j = 0; j < cols; j += 1) {
    dist[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost
      );
    }
  }

  return dist[rows - 1][cols - 1];
}

function captionsAreSimilar(a: string, b: string): boolean {
  const normalizedA = normalizeCaptionText(a);
  const normalizedB = normalizeCaptionText(b);

  if (!normalizedA && !normalizedB) return true;
  if (!normalizedA || !normalizedB) return normalizedA === normalizedB;
  if (normalizedA === normalizedB) return true;

  const distance = levenshtein(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return true;

  const similarityScore = 1 - distance / maxLen;
  if (similarityScore > 0.9) return true;

  const tokensA = new Set(normalizedA.split(" ").filter(Boolean));
  const tokensB = new Set(normalizedB.split(" ").filter(Boolean));
  const intersectionSize = [...tokensA].filter(token => tokensB.has(token)).length;
  const unionSize = new Set([...tokensA, ...tokensB]).size || 1;
  const jaccard = intersectionSize / unionSize;

  return jaccard > 0.82;
}

type TextOnlyVariantParams = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice:string;
  theme:string;
  context?:string;
  hint?:string;
  nsfw?:boolean;
  style?: string;
  mood?: string;
};

export async function generateVariantsTextOnly(params: TextOnlyVariantParams): Promise<z.infer<typeof CaptionArray>> {
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("variants_textonly.txt")
  ]);

  const voiceGuide = buildVoiceGuideBlock(params.voice, params.theme, params.context);

  const sanitizeVariant = (item: Record<string, unknown>): Record<string, unknown> => {
    const variant = { ...item } as Record<string, unknown>;

    variant.safety_level = normalizeSafetyLevel(
      typeof variant.safety_level === "string" ? variant.safety_level : "normal"
    );

    const caption = typeof variant.caption === "string" && variant.caption.trim().length > 0
      ? variant.caption
      : "Sharing something I'm proud of today.";
    variant.caption = caption;

    variant.mood = typeof variant.mood === "string" && variant.mood.trim().length >= 2
      ? variant.mood
      : "engaging";
    variant.style = typeof variant.style === "string" && variant.style.trim().length >= 2
      ? variant.style
      : "authentic";
    variant.cta = typeof variant.cta === "string" && variant.cta.trim().length >= 2
      ? variant.cta
      : HUMAN_CTA;

    const alt = typeof variant.alt === "string" && variant.alt.trim().length >= 20
      ? variant.alt
      : "Engaging description that highlights the visual story.";
    variant.alt = alt;

    const hashtags = Array.isArray(variant.hashtags)
      ? variant.hashtags
          .map(tag => (typeof tag === "string" ? tag.trim() : ""))
          .filter(tag => tag.length > 0)
      : [];
    const fallbackTags = fallbackHashtags(params.platform);
    variant.hashtags = hashtags.length > 0 ? hashtags.slice(0, 10) : [...fallbackTags];

    variant.nsfw = typeof variant.nsfw === "boolean" ? variant.nsfw : false;

    return variant;
  };

  const buildUserPrompt = (varietyHint: string | undefined, existingCaptions: string[]): string => {
    const lines = [
      `PLATFORM: ${params.platform}`,
      `VOICE: ${params.voice}`,
      `THEME: ${serializePromptField(params.theme)}`,
      `CONTEXT: ${serializePromptField(params.context || "")}`
    ];

    if (params.style) lines.push(`STYLE: ${params.style}`);
    if (params.mood) lines.push(`MOOD: ${params.mood}`);

    lines.push(`NSFW: ${params.nsfw ?? false}`);

    const hintParts: string[] = [];
    if (varietyHint) {
      hintParts.push(varietyHint.trim());
    }
    if (existingCaptions.length > 0) {
      const sanitizedExistingCaptions = existingCaptions.map(existing =>
        serializePromptField(existing, { block: true })
      );
      hintParts.push(
        `Avoid repeating or lightly editing these captions: ${sanitizedExistingCaptions.join(" | ")}.`
      );
    }
    hintParts.push("Provide five options that vary tone, structure, and specific content themes.");

    const combinedHint = hintParts.filter(Boolean).join(" ");
    const serializedHint = serializePromptField(combinedHint, { block: true });
    lines.push(`HINT:${serializedHint}`);

    return lines.join("\n");
  };

  const fetchVariants = async (varietyHint: string | undefined, existingCaptions: string[]) => {
    const user = buildUserPrompt(varietyHint, existingCaptions);
    try {
      const promptSections = [sys, guard, prompt, user];
      if (voiceGuide) promptSections.push(voiceGuide);
      const res = await textModel.generateContent([
        { text: promptSections.join("\n") }
      ]);
      const json = stripToJSON(res.response.text());
      return Array.isArray(json) ? json : [];
    } catch (error) {
      console.error("Gemini textModel.generateContent failed:", error);
      throw error;
    }
  };

  const uniqueVariants: z.infer<typeof CaptionItem>[] = [];
  const existingCaptions: string[] = [];
  const seenKeys = new Set<string>();
  const duplicatesForHint: string[] = [];
  let needsBannedHint = false;
  const isTest = process.env.NODE_ENV === 'test';
  const maxAttempts = isTest ? Math.max(3, VARIANT_RETRY_LIMIT) : VARIANT_RETRY_LIMIT;

  let attempt = 0;
  while (uniqueVariants.length < VARIANT_TARGET && attempt < maxAttempts) {
    const needed = VARIANT_TARGET - uniqueVariants.length;
    const baseHintWithVariety = `${params.hint ? `${params.hint} ` : ""}Need much more variety across tone, structure, and themes.`.trim();
    let varietyHint = attempt === 0
      ? params.hint
      : buildRetryHint(baseHintWithVariety, duplicatesForHint, needed);

    if (needsBannedHint) {
      varietyHint = [varietyHint, BANNED_WORDS_HINT].filter(Boolean).join(' ');
    }

    const rawVariants = await fetchVariants(varietyHint, existingCaptions);
    duplicatesForHint.length = 0;
    let bannedDetected = false;

    for (const raw of rawVariants) {
      if (uniqueVariants.length >= VARIANT_TARGET) break;
      if (typeof raw !== "object" || raw === null) continue;

      const sanitized = sanitizeVariant(raw as Record<string, unknown>);
      const captionText = sanitized.caption as string;
      const key = uniqueCaptionKey(captionText);

      if (!key) {
        continue;
      }

      if (seenKeys.has(key)) {
        duplicatesForHint.push(captionText);
        continue;
      }

      const hasBannedWord = variantContainsBannedWord({
        caption: sanitized.caption,
        hashtags: sanitized.hashtags,
        cta: sanitized.cta,
        alt: sanitized.alt,
      });

      if (hasBannedWord) {
        bannedDetected = true;
        continue;
      }

      seenKeys.add(key);
      uniqueVariants.push(sanitized as z.infer<typeof CaptionItem>);
      existingCaptions.push(captionText);
    }

    if (duplicatesForHint.length === 0 && uniqueVariants.length < VARIANT_TARGET) {
      const fallbackDuplicate = rawVariants.find(
        candidate => typeof candidate === "object" && candidate !== null && typeof (candidate as Record<string, unknown>).caption === "string"
      ) as { caption: string } | undefined;
      if (fallbackDuplicate) {
        duplicatesForHint.push(fallbackDuplicate.caption);
      }
    }

    needsBannedHint = bannedDetected;

    attempt += 1;
  }

  if (uniqueVariants.length < VARIANT_TARGET) {
    const baseVariant = uniqueVariants[0] || {
      caption: safeFallbackCaption,
      alt: safeFallbackAlt,
      hashtags: [...safeFallbackHashtags],
      cta: safeFallbackCta,
      mood: "engaging",
      style: "authentic",
      safety_level: "normal",
      nsfw: false,
    } as z.infer<typeof CaptionItem>;

    while (uniqueVariants.length < VARIANT_TARGET) {
      const index = uniqueVariants.length + 1;
      const captionSeed = baseVariant.caption || safeFallbackCaption;
      uniqueVariants.push({
        ...baseVariant,
        caption: `${captionSeed} (retry filler ${index})`,
        alt: `${baseVariant.alt} (retry filler ${index})`,
      });
    }
  }

  return CaptionArray.parse(uniqueVariants.slice(0, VARIANT_TARGET));
}

// Helper function to prepare variants for ranking, ensuring correct count and deduplication
function prepareVariantsForRanking(
  variants: z.infer<typeof CaptionArray>,
  params: { platform?: string; theme?: string; context?: string },
  options: { targetLength: number }
): z.infer<typeof CaptionArray> {
  let preparedVariants = variants.slice(0, options.targetLength);
  if (preparedVariants.length < options.targetLength) {
    // If not enough variants, duplicate existing ones or add fallbacks if none exist
    const baseVariant = preparedVariants[0] || {
      caption: safeFallbackCaption,
      alt: safeFallbackAlt,
      hashtags: [...safeFallbackHashtags],
      cta: safeFallbackCta,
      mood: "engaging",
      style: "authentic",
      safety_level: "normal",
      nsfw: false,
    } as z.infer<typeof CaptionItem>;

    while (preparedVariants.length < options.targetLength) {
      const index = preparedVariants.length + 1;
      const captionSeed = baseVariant.caption || safeFallbackCaption;
      preparedVariants.push({
        ...baseVariant,
        caption: `${captionSeed} (filler ${index})`,
        alt: `${baseVariant.alt} (filler ${index})`,
      });
    }
  }
  // Deduplicate variants based on similarity if needed, though `generateVariantsTextOnly` already aims for uniqueness
  return dedupeCaptionVariants(preparedVariants, options.targetLength);
}


async function requestTextOnlyRanking(
  variants: unknown[],
  serializedVariants: string,
  promptBlock: string,
  platform?: string,
  extraHint?: string
): Promise<unknown> {
  const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
  let res;
  try {
    res = await textModel.generateContent([{ text: `${promptBlock}${hintBlock}\n${serializedVariants}` }]);
  } catch (error) {
    console.error('Text-only textModel.generateContent failed:', error);
    throw error;
  }
  let json = stripToJSON(res.response.text()) as unknown;

  if(Array.isArray(json)) {
    const winner = json[0] as Record<string, unknown> | undefined;
    json = {
      winner_index: 0,
      scores: [5, 4, 3, 2, 1],
      reason: "Selected based on engagement potential",
      final: winner ?? variants[0]
    };
  }

  return json;
}

export async function rankAndSelect(
  variants: unknown[],
  params?: { platform?: string; theme?: string; context?: string }
): Promise<z.infer<typeof RankResult>> {
  const sys = await load("system.txt"), guard = await load("guard.txt"), prompt = await load("rank.txt");
  const promptBlock = `${sys}\n${guard}\n${prompt}`;

  const runRanking = async (variantsInput: unknown[], hint?: string) => {
    const serialized = JSON.stringify(variantsInput);
    const response = await requestTextOnlyRanking(
      variantsInput,
      serialized,
      promptBlock,
      params?.platform,
      hint
    );
    return RankResult.parse(response);
  };

  let activeVariants = variants;
  let parsed = await runRanking(activeVariants);
  let violations = detectVariantViolations(parsed.final);

  const hasBannedPhrase = violations.some((violation) => violation.type === "banned_phrase");
  if (hasBannedPhrase && typeof parsed.winner_index === "number") {
    const filtered = Array.isArray(activeVariants)
      ? activeVariants.filter((_, index) => index !== parsed.winner_index)
      : activeVariants;
    if (Array.isArray(filtered) && filtered.length > 0) {
      activeVariants = filtered;
      const hint = buildRerankHint(violations) ||
        "Drop the filler pick and highlight the most natural-sounding caption left.";
      parsed = await runRanking(activeVariants, hint);
      violations = detectVariantViolations(parsed.final);
    }
  }

  if (violations.length === 0) {
    // Always sanitize final variant to ensure required fields like alt are present
    const sanitizedFinal = sanitizeFinalVariant(parsed.final, params?.platform);
    return RankResult.parse({
      ...parsed,
      final: sanitizedFinal
    });
  }

  const rerank = await runRanking(activeVariants, buildRerankHint(violations));
  parsed = rerank;
  const rerankViolations = detectVariantViolations(parsed.final);

  if (rerankViolations.length === 0) {
    const sanitizedFinal = sanitizeFinalVariant(parsed.final, params?.platform);
    return RankResult.parse({
      ...parsed,
      final: sanitizedFinal
    });
  }

  const sanitizedFinal = sanitizeFinalVariant(parsed.final, params?.platform);
  const summary = formatViolationSummary(rerankViolations) || parsed.reason;
  return RankResult.parse({
    ...parsed,
    final: sanitizedFinal,
    reason: summary
  });
}

type TextOnlyPipelineArgs = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice?:string;
  theme:string;
  context?:string;
  nsfw?:boolean;
} & ToneOptions;

/**
 * Text-only caption pipeline for brainstorming without an image upload.
 *
 * @remarks
 * Persona settings (`style`, `mood`, etc.) are forwarded to every Gemini retry so the
 * voice remains consistent even when a platform validation retry is required.
 */
export async function pipelineTextOnly({ platform, voice="flirty_playful", theme, context, nsfw=false, ...toneRest }:TextOnlyPipelineArgs){
  const tone = extractToneOptions(toneRest);
  let variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone });
  variants = prepareVariantsForRanking(variants, { platform, theme, context }, { targetLength: VARIANT_TARGET });
  let ranked = await rankAndSelect(variants, { platform, theme, context });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone, hint:`Fix: ${err}. Be specific and engaging.` });
    variants = dedupeVariantsForRanking(variants, 5, { platform, theme, context });
    ranked = await rankAndSelect(variants, { platform, theme, context });
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}