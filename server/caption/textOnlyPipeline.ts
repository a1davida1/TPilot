import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";

import { getTextModel, type GeminiModel } from "../lib/gemini-client.js";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { enrichWithTitleCandidates } from "./geminiPipeline";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions } from "./toneOptions";
import { variantContainsBannedWord } from "./bannedWords";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { ensureFallbackCompliance } from "./inferFallbackFromFacts";
import { dedupeVariantsForRanking } from "./dedupeVariants";
import { dedupeCaptionVariants } from "./dedupeCaptionVariants";
import {
  buildRerankHint,
  detectVariantViolations,
  fallbackHashtags,
  formatViolationSummary,
  sanitizeFinalVariant
} from "./rankGuards";
import { logger } from '../bootstrap/logger.js';

type GeminiResponse = {
  text?: (() => unknown) | string;
  response?: unknown;
};

const _MAX_VARIANT_ATTEMPTS = 4;
const VARIANT_TARGET = 5;
const _VARIANT_RETRY_LIMIT = 4;
const CAPTION_KEY_LENGTH = 80;

function _captionKey(caption: string): string {
  return caption.trim().slice(0, 80).toLowerCase();
}

function _hintSnippet(caption: string): string {
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

function _normalizeVariantFields(
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

type ResponseTextFunction = () => unknown;

interface GeminiTextEnvelope {
  text?: ResponseTextFunction | string;
  response?: unknown;
}

async function _invokeTextModel(prompt: Array<{ text: string }>): Promise<unknown> {
  const model = getTextModel();
  return model.generateContent(prompt);
}

async function resolveResponseText(payload: unknown): Promise<string | undefined> {
  const ensureNonEmpty = (value: string): string => {
    if (value.trim().length === 0) {
      throw new Error("Gemini: empty response");
    }
    return value;
  };

  const extractFromCandidates = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const container = value as Record<string, unknown>;
    if (!('candidates' in container)) {
      return undefined;
    }

    const rawCandidates = container['candidates'];
    const candidateList = Array.isArray(rawCandidates) ? rawCandidates : [rawCandidates];
    const outputs: string[] = [];

    for (const candidate of candidateList) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }
      const candidateRecord = candidate as Record<string, unknown>;
      const segments: string[] = [];

      const directText = candidateRecord['text'];
      if (typeof directText === "string") {
        segments.push(directText);
      }

      const contentValue = candidateRecord['content'];
      const contentEntries = Array.isArray(contentValue)
        ? contentValue
        : contentValue
          ? [contentValue]
          : [];

      for (const content of contentEntries) {
        if (!content || typeof content !== "object") {
          continue;
        }
        const contentRecord = content as Record<string, unknown>;
        const partsValue = contentRecord['parts'];
        const parts = Array.isArray(partsValue)
          ? partsValue
          : partsValue
            ? [partsValue]
            : [];

        for (const part of parts) {
          if (!part || typeof part !== "object") {
            continue;
          }
          const partRecord = part as Record<string, unknown>;
          const partText = partRecord['text'];
          if (typeof partText === "string") {
            segments.push(partText);
          }
        }
      }

      const combined = segments.join("");
      if (combined.trim().length > 0) {
        outputs.push(combined.trim());
      }
    }

    const aggregated = outputs.join("\n").trim();
    return aggregated.length > 0 ? aggregated : undefined;
  };

  if (typeof payload === "string") {
    return ensureNonEmpty(payload);
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const candidateText = extractFromCandidates(payload);
  if (candidateText) {
    return ensureNonEmpty(candidateText);
  }

  const { text, response } = payload as GeminiTextEnvelope;
  if (typeof text === "string") {
    return ensureNonEmpty(text);
  }
  if (typeof text === "function") {
    const value = await Promise.resolve(text());
    return typeof value === "string" ? ensureNonEmpty(value) : undefined;
  }
  if (response) {
    return resolveResponseText(response);
  }
  return undefined;
}

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
  const textModel = getTextModel();

  const voiceGuide = buildVoiceGuideBlock(params.voice);
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const sanitizeVariant = (item: Record<string, unknown>): z.infer<typeof CaptionItem> => {
    const candidateCaption = typeof item.caption === "string" ? item.caption : undefined;
    return _normalizeVariantFields(
      item,
      params.platform,
      params.theme,
      params.context,
      candidateCaption
    );
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
      hintParts.push(
        `Avoid repeating or lightly editing these captions: ${existingCaptions.join(" | ")}.`
      );
    }
    hintParts.push("Provide five options that vary tone, structure, and specific content themes.");

    const combinedHint = hintParts.filter(Boolean).join(" ");
    lines.push(`HINT: ${combinedHint}`);

    return lines.join("\n");
  };

  const safeFallbackCaption = "Here's something I'm proud of today.";
  const _safeFallbackAlt = "Engaging description that highlights the visual story.";
  const _safeFallbackHashtags = fallbackHashtags(params.platform);
  const _safeFallbackCta = "Comment your thoughts below! 💭";

  const buildFallbackBatch = () =>
    Array.from({ length: VARIANT_TARGET }, (_, index) => {
      const fallbackCaption = `${safeFallbackCaption} (fallback ${index + 1})`;
      return _normalizeVariantFields(
        {
          caption: fallbackCaption,
          alt: "",
          hashtags: [],
          cta: "",
          mood: params.mood ?? "engaging",
          style: params.style ?? "authentic",
          safety_level: "normal" as const,
          nsfw: params.nsfw ?? false,
        },
        params.platform,
        params.theme,
        params.context,
        fallbackCaption
      );
    });

  const fetchVariants = async (varietyHint: string | undefined, existingCaptions: string[]) => {
    const user = buildUserPrompt(varietyHint, existingCaptions);

    // Apply tone to system prompt if available
    const toneLines: string[] = [];
    if (params.style) toneLines.push(`STYLE: ${params.style}`);
    if (params.mood) toneLines.push(`MOOD: ${params.mood}`);
    const sysWithTone = toneLines.length > 0 ? `${sys}\n${toneLines.join('\n')}` : sys;

    const fallbackBatch = buildFallbackBatch();
    let candidates: unknown[] = fallbackBatch;

    const promptSections = [sysWithTone, guard, prompt, user];
    if (voiceGuide) {
      promptSections.push(voiceGuide);
    }

    let response: unknown;
    try {
      response = await textModel.generateContent([
        { text: promptSections.join("\n") }
      ]);
    } catch (error) {
      logger.error("Gemini textModel.generateContent failed:", error);
      throw error;
    }

    let rawText: string | undefined;
    try {
      rawText = await resolveResponseText(response);
    } catch (_error) {
      logger.error("Gemini: empty response received in text-only pipeline, using fallback variants");
      return candidates;
    }
    if (!rawText) {
      logger.error("Gemini: undefined response received in text-only pipeline, using fallback variants");
      return candidates;
    }

    try {
      const json = stripToJSON(rawText);
      if (Array.isArray(json)) {
        return json;
      }
      logger.error("Gemini: variant payload was not an array in text-only pipeline");
    } catch (parseError) {
      logger.error("Gemini text-only variant parsing failed:", parseError);
    }

    return candidates;
  };

  const uniqueVariants: z.infer<typeof CaptionItem>[] = [];
  const existingCaptions: string[] = [];
  const duplicatesThisAttempt: string[] = [];
  const isTest = process.env.NODE_ENV === 'test';
  const maxAttempts = isTest ? 2 : 5; // Allow 2 attempts in test for retry logic testing
  
  // Track seen keys and duplicates for retry logic
  const seenKeys = new Set<string>();
  const duplicatesForHint: string[] = [];
  let bannedDetected = false;
  let _needsBannedHint = false;

  for (let attempt = 0; attempt < maxAttempts && uniqueVariants.length < 5; attempt += 1) {
    const needed = 5 - uniqueVariants.length;
    const varietyHint = attempt === 0
      ? params.hint
      : (() => {
          // Build complete base hint with variety clause first, then pass to buildRetryHint
          const baseHintWithVariety = `${params.hint ? `${params.hint} ` : ""}Need much more variety across tone, structure, and themes.`;
          return buildRetryHint(baseHintWithVariety, duplicatesThisAttempt, needed);
        })();

    const rawVariants = await fetchVariants(varietyHint, existingCaptions);
    duplicatesThisAttempt.length = 0; // Reset for this attempt

    for (const raw of rawVariants) {

      if (uniqueVariants.length >= VARIANT_TARGET) break;
      if (!isRecord(raw)) continue;

      const sanitized = sanitizeVariant(raw);
      const captionText = sanitized.caption;
      const key = uniqueCaptionKey(captionText);


      const isDuplicate = existingCaptions.some(existing => captionsAreSimilar(existing, captionText));
      if (isDuplicate) {
        duplicatesThisAttempt.push(captionText); // Track duplicates for retry hint
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
      uniqueVariants.push(sanitized);
      existingCaptions.push(captionText);
    }

    if (duplicatesForHint.length === 0 && uniqueVariants.length < VARIANT_TARGET) {
      const fallbackDuplicate = rawVariants.find((candidate): candidate is Record<string, unknown> & { caption: string } => {
        if (!isRecord(candidate)) return false;
        return typeof candidate.caption === "string";
      });
      if (fallbackDuplicate) {
        duplicatesForHint.push(fallbackDuplicate.caption);
      }
    }

    const _needsBannedHint = bannedDetected;
  }

  if (uniqueVariants.length < VARIANT_TARGET) {
    const fallbackBatch = buildFallbackBatch();

    const baseVariant = uniqueVariants[0] ?? fallbackBatch[0];

    while (uniqueVariants.length < VARIANT_TARGET) {
      const index = uniqueVariants.length + 1;
      const source = fallbackBatch[(index - 1) % fallbackBatch.length];
      uniqueVariants.push(
        CaptionItem.parse({
          ...baseVariant,
          ...source,
          caption: `${source.caption} (retry filler ${index})`,
          alt: source.alt,
        })
      );

    }
  }

  return CaptionArray.parse(uniqueVariants);
}

// Helper function to prepare variants for ranking, ensuring correct count and deduplication
function _prepareVariantsForRanking(
  variants: z.infer<typeof CaptionArray>,
  params: { platform?: string; theme?: string; context?: string },
  options: { targetLength: number }
): z.infer<typeof CaptionArray> {
  let preparedVariants = variants.slice(0, options.targetLength);
  if (preparedVariants.length < options.targetLength) {
    // If not enough variants, duplicate existing ones or add fallbacks if none exist
    const safeFallbackCaption = "Here's something I'm proud of today.";
    const _safeFallbackAlt = "Engaging description that highlights the visual story.";
    const _safeFallbackHashtags = fallbackHashtags(params.platform || 'instagram');
    const _safeFallbackCta = "Comment your thoughts below! 💭";


    const fallbackPlatform: "instagram" | "x" | "reddit" | "tiktok" = (() => {
      switch (params.platform) {
        case "instagram":
        case "x":
        case "reddit":
        case "tiktok":
          return params.platform;
        default:
          return "instagram";
      }
    })();
    const baseVariant = preparedVariants[0] ?? _normalizeVariantFields(
      {
        caption: safeFallbackCaption,
        alt: "",
        hashtags: [],
        cta: "",
        mood: "engaging",
        style: "authentic",
        safety_level: "normal" as const,
        nsfw: false,
      },
      fallbackPlatform,
      params.theme,
      params.context,
      safeFallbackCaption

    );

    while (preparedVariants.length < options.targetLength) {
      const index = preparedVariants.length + 1;
      const captionSeed = baseVariant.caption || "Here's something I'm proud of today.";

      preparedVariants.push(
        CaptionItem.parse({
          ...baseVariant,
          caption: `${captionSeed} (filler ${index})`,
          alt: `${baseVariant.alt} (filler ${index})`,
        })
      );

    }
  }
  // Deduplicate variants based on similarity if needed, though `generateVariantsTextOnly` already aims for uniqueness
  return dedupeCaptionVariants(preparedVariants).slice(0, options.targetLength);
}

async function requestTextOnlyRanking(
  model: GeminiModel,
  variantsInput: unknown[],
  serializedVariants: string,
  promptBlock: string,
  platform?: string,
  extraHint?: string
): Promise<unknown> {
  const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
  const safeFallbackCaption = "Here's something I'm proud of today.";
  const safeFallbackAlt = "Engaging description that highlights the visual story.";
  const safeFallbackHashtags = fallbackHashtags(platform || "instagram");
  const safeFallbackCta = "Comment your thoughts below! 💭";
  const defaultScores = [5, 4, 3, 2, 1] as const;

  const fallbackFinalVariant = CaptionItem.parse({
    caption: safeFallbackCaption,
    alt: safeFallbackAlt,
    hashtags: [...safeFallbackHashtags],
    cta: safeFallbackCta,
    mood: "engaging",
    style: "authentic",
    safety_level: "normal",
    nsfw: false,
  });

  const fallbackResult = () => ({
    winner_index: 0,
    scores: [...defaultScores],
    reason: "Gemini unavailable - using fallback ranking",
    final: { ...fallbackFinalVariant },
  });

  let res: unknown;
  try {
    res = await model.generateContent([{ text: `${promptBlock}${hintBlock}\n${serializedVariants}` }]);
  } catch (error) {
    logger.error("Text-only textModel.generateContent failed:", error);
    return fallbackResult();
  }

  let textOutput: string | null = null;
  const resolved = await resolveResponseText(res);
  if (typeof resolved === "string") {
    textOutput = resolved;
  } else if (res && typeof res === "object") {
    const geminiRes = res as GeminiResponse;
    if (geminiRes.response && typeof geminiRes.response === "object" && "text" in geminiRes.response && typeof geminiRes.response.text === "function") {
      try {
        const raw = geminiRes.response.text();
        textOutput = typeof raw === "string" ? raw : null;
      } catch (invokeError) {
        logger.error("Gemini: failed to read text-only ranking response:", invokeError);
      }
    }
  } else if (typeof res === "string") {
    textOutput = res;
  }

  if (typeof textOutput !== "string" || textOutput.trim().length === 0) {
    logger.error("Gemini: empty text-only ranking response");
    return fallbackResult();
  }

  let json: unknown;
  try {
    json = stripToJSON(textOutput) as unknown;
  } catch (parseError) {
    logger.error("Gemini text-only ranking parsing failed:", parseError);
    return fallbackResult();
  }

  if (Array.isArray(json)) {
    const winner = json[0] as Record<string, unknown> | undefined;
    return {
      winner_index: 0,
      scores: [...defaultScores],
      reason: "Selected based on engagement potential",
      final: winner ?? { ...fallbackFinalVariant },
    };
  }

  if (!json || typeof json !== "object") {
    return fallbackResult();
  }

  return json;
}

export async function rankAndSelect(
  variants: unknown[],
  params?: { platform?: string; theme?: string; context?: string }
): Promise<z.infer<typeof RankResult>> {
  const sys = await load("system.txt"), guard = await load("guard.txt"), prompt = await load("rank.txt");
  const promptBlock = `${sys}\n${guard}\n${prompt}`;
  const serializedVariants = JSON.stringify(variants);
  const textModel = getTextModel();

  const first = await requestTextOnlyRanking(textModel, variants, serializedVariants, promptBlock, params?.platform);
  let parsed = RankResult.parse(first);
  const violations = detectVariantViolations(parsed.final);
  
  if (violations.length === 0) {
    // Always sanitize final variant to ensure required fields like alt are present
    const sanitizedFinal = sanitizeFinalVariant(parsed.final, params?.platform);
    return RankResult.parse({
      ...parsed,
      final: sanitizedFinal
    });
  }

  const rerank = await requestTextOnlyRanking(
    textModel,
    variants,
    serializedVariants,
    promptBlock,
    params?.platform,
    buildRerankHint(violations)
  );
  parsed = RankResult.parse(rerank);
  const rerankViolations = detectVariantViolations(parsed.final);
  
  if (rerankViolations.length === 0) {
    return parsed;
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
  style?: string;
  mood?: string;
};

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
  variants = dedupeVariantsForRanking(variants, 5, { platform, theme, context });
  let ranked = await rankAndSelect(variants, { platform, theme, context });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone, hint:`Fix: ${err}. Be specific and engaging.` });
    variants = dedupeVariantsForRanking(variants, 5, { platform, theme, context });
    ranked = await rankAndSelect(variants, { platform, theme, context });
    out = ranked.final;
  }

  const enriched = enrichWithTitleCandidates(out, { variants, ranked });
  out = enriched.final;
  if (enriched.ranked) {
    ranked = enriched.ranked;
  }

  return { variants, ranked, final: out, titles: out.titles };
}