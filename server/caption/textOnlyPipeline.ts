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

export async function generateVariantsTextOnly(params:TextOnlyVariantParams){
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("variants_textonly.txt")
  ]);

  let attempts = 0;
  let currentHint = params.hint;
  let variants: z.infer<typeof CaptionItem>[] = [];
  const keyIndex = new Map<string, number>();

  while (attempts < VARIANT_RETRY_LIMIT && variants.length < VARIANT_TARGET) {
    attempts += 1;
    const voiceContext = formatVoiceContext(params.voice);
    const user = `PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${voiceContext ? `${voiceContext}\n` : ''}${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}THEME: ${serializePromptField(params.theme)}\nCONTEXT: ${serializePromptField(params.context || "")}\nNSFW: ${params.nsfw || false}${currentHint ? `\nHINT:${currentHint}` : ''}`;

    let res;
    try {
      res = await textModel.generateContent([{ text: `${sys}\n${guard}\n${prompt}\n${user}` }]);
    } catch (error) {
      console.error('Gemini textModel.generateContent failed:', error);
      throw error;
    }

    const raw = stripToJSON(res.response.text());
    const items = Array.isArray(raw) ? raw : [raw];
    const iterationDuplicates: string[] = [];
    let hasBannedWords = false;

    items.forEach(item => {
      const candidate = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      const normalized = normalizeVariantFields(candidate, params.platform, params.theme, params.context);
      
      // Check for banned words after normalization
      if (variantContainsBannedWord(normalized)) {
        hasBannedWords = true;
        return; // Skip this variant
      }
      
      const key = uniqueCaptionKey(normalized.caption);
      const existingIndex = keyIndex.get(key);

      if (existingIndex === undefined) {
        variants.push(normalized);
        keyIndex.set(key, variants.length - 1);
      } else {
        iterationDuplicates.push(normalized.caption);
        const existing = variants[existingIndex];
        if (normalized.caption.length > existing.caption.length) {
          variants[existingIndex] = normalized;
        }
      }
    });

    variants = dedupeCaptionVariants(variants as { caption: string }[]).slice(0, VARIANT_TARGET);
    keyIndex.clear();
    variants.forEach((variant, index) => {
      keyIndex.set(uniqueCaptionKey(variant.caption), index);
    });

    if (variants.length < VARIANT_TARGET) {
      const needed = VARIANT_TARGET - variants.length;
      let retryHint = buildRetryHint(params.hint, iterationDuplicates, needed);
      
      // Add banned words hint if banned words were detected
      if (hasBannedWords) {
        retryHint = retryHint ? `${retryHint}. ${BANNED_WORDS_HINT}` : BANNED_WORDS_HINT;
      }
      
      currentHint = retryHint;
    }
  }

  if (variants.length !== VARIANT_TARGET) {
    throw new Error(`Failed to generate ${VARIANT_TARGET} unique caption variants.`);
  }

  return CaptionArray.parse(variants);
}

async function requestTextOnlyRanking(
  variantsInput: unknown[],
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
      final: winner ?? variantsInput[0]
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
  const serializedVariants = JSON.stringify(variants);

  const first = await requestTextOnlyRanking(variants, serializedVariants, promptBlock, params?.platform);
  let parsed = RankResult.parse(first);
  const violations = detectVariantViolations(parsed.final);
  
  if (violations.length === 0) {
    return parsed;
  }

  const rerank = await requestTextOnlyRanking(
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

  return { variants, ranked, final: out };
}