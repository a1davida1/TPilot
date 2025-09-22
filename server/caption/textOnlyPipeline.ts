import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { formatVoiceContext } from "./voiceTraits";
import { serializePromptField } from "./promptUtils";
import { inferFallbackFromFacts } from "./inferFallbackFromFacts";
import { dedupeVariantsForRanking } from "./dedupeVariants";
import {
  bannedExamples,
  detectRankingViolations,
  formatViolations,
  sanitizeVariantForRanking,
  safeFallbackCaption,
  safeFallbackCta,
  safeFallbackHashtags,
  normalizeVariantForRanking,
  truncateReason,
  type CaptionVariant,
} from "./rankingGuards";

const MAX_VARIANT_ATTEMPTS = 4;

function captionKey(caption: string): string {
  return caption.trim().slice(0, 80).toLowerCase();
}

function hintSnippet(caption: string): string {
  const normalized = caption.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
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
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants_textonly.txt");
  
  const hints: string[] = [];
  if (params.hint) hints.push(params.hint);

  const defaultHashtags = params.platform === 'instagram'
    ? ["#content", "#creative", "#amazing", "#lifestyle"]
    : ["#content", "#creative", "#amazing"];

  const defaults: Record<string, unknown> = {
    caption: "Check out this amazing content!",
    alt: "Engaging social media content",
    hashtags: defaultHashtags,
    cta: "Check it out",
    mood: "engaging",
    style: "authentic",
    safety_level: normalizeSafetyLevel('normal'),
    nsfw: false,
  };

  const sanitizeVariant = (item: unknown): Record<string, unknown> => {
    const variant = typeof item === 'object' && item !== null ? { ...(item as Record<string, unknown>) } : {};
    const fallback = inferFallbackFromFacts({
      platform: params.platform,
      theme: params.theme,
      context: params.context,
      existingCaption: typeof variant.caption === 'string' ? variant.caption : undefined,
    });
    
    const hashtagsSource = Array.isArray((variant as { hashtags?: unknown }).hashtags)
      ? ((variant as { hashtags: unknown[] }).hashtags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0))
      : [];
    const sanitizedHashtags = hashtagsSource.length >= (params.platform === 'instagram' ? 4 : 3)
      ? hashtagsSource
      : fallback.hashtags;

    return {
      ...variant,
      caption: typeof (variant as { caption?: unknown }).caption === 'string' && (variant as { caption?: string }).caption.trim().length > 0
        ? (variant as { caption: string }).caption
        : defaults.caption,
      alt: typeof (variant as { alt?: unknown }).alt === 'string' && (variant as { alt?: string }).alt.length >= 20
        ? (variant as { alt: string }).alt
        : fallback.alt,
      hashtags: sanitizedHashtags,
      cta: typeof (variant as { cta?: unknown }).cta === 'string' && (variant as { cta?: string }).cta.length >= 2
        ? (variant as { cta: string }).cta
        : fallback.cta,
      mood: typeof (variant as { mood?: unknown }).mood === 'string' && (variant as { mood?: string }).mood.length >= 2
        ? (variant as { mood: string }).mood
        : defaults.mood,
      style: typeof (variant as { style?: unknown }).style === 'string' && (variant as { style?: string }).style.length >= 2
        ? (variant as { style: string }).style
        : defaults.style,
      safety_level: normalizeSafetyLevel(
        typeof (variant as { safety_level?: unknown }).safety_level === 'string'
          ? (variant as { safety_level: string }).safety_level
          : defaults.safety_level as string
      ),
      nsfw: typeof (variant as { nsfw?: unknown }).nsfw === 'boolean'
        ? (variant as { nsfw: boolean }).nsfw
        : defaults.nsfw,
    };
  };

  const seenKeys = new Set<string>();
  const collected: Record<string, unknown>[] = [];

  for (let attempt = 0; attempt < MAX_VARIANT_ATTEMPTS && collected.length < 5; attempt += 1) {
    const voiceContext = formatVoiceContext(params.voice);
    const user = [
      `PLATFORM: ${params.platform}`,
      `VOICE: ${params.voice}`,
      voiceContext,
      params.style ? `STYLE: ${params.style}` : "",
      params.mood ? `MOOD: ${params.mood}` : "",
      `THEME: ${serializePromptField(params.theme)}`,
      `CONTEXT: ${serializePromptField(params.context || "")}`,
      `NSFW: ${params.nsfw || false}`,
      ...hints.map(hint => `HINT: ${hint}`),
    ].filter((line): line is string => Boolean(line)).join("\n");
    const voiceGuide = buildVoiceGuideBlock(params.voice);
    const promptSections = [sys, guard, prompt, user];
    if (voiceGuide) promptSections.push(voiceGuide);
    
    let res;
    try {
      res=await textModel.generateContent([{ text: promptSections.join("\n") }]);
    } catch (error) {
      console.error('Gemini textModel.generateContent failed on attempt', attempt + 1, ':', error);
      const errorHint = 'Previous attempt failed; produce 5 fresh, distinct variants.';
      if (!hints.includes(errorHint)) {
        hints.push(errorHint);
      }
      continue;
    }
    const raw=stripToJSON(res.response.text());
    const arr = Array.isArray(raw) ? raw : [raw];
    let duplicateForHint: string | undefined;

    for (const item of arr) {
      const variant = sanitizeVariant(item);
      const caption = typeof variant.caption === 'string' ? variant.caption : '';
      const key = captionKey(caption);
      if (!key) continue;
      if (seenKeys.has(key)) {
        if (!duplicateForHint) duplicateForHint = caption;
        continue;
      }
      seenKeys.add(key);
      collected.push(variant);
      if (collected.length === 5) break;
    }

    if (collected.length >= 5) break;

    const nextHint = duplicateForHint
      ? `You already wrote "${hintSnippet(duplicateForHint)}"; deliver a fresh angle.`
      : 'You already wrote very similar captions; deliver a fresh angle.';
    if (!hints.includes(nextHint)) {
      hints.push(nextHint);
      // Keep HINT list bounded to prevent prompt bloat
      if (hints.length > 3) {
        hints.splice(0, hints.length - 3);
      }
    }
  }

  const baseVariant = collected[0] ?? defaults;
  while (collected.length < 5) {
    const index = collected.length + 1;
    const baseCaption = typeof baseVariant.caption === 'string' ? baseVariant.caption : String(defaults.caption);
    let freshCaption = `Fresh POV ${index}: ${baseCaption}`;
    let freshKey = captionKey(freshCaption);
    let collisionCount = 1;
    while (seenKeys.has(freshKey)) {
      collisionCount += 1;
      freshCaption = `Fresh POV ${index}.${collisionCount}: ${baseCaption}`;
      freshKey = captionKey(freshCaption);
    }
    const newVariant = {
      ...baseVariant,
      hashtags: Array.isArray(baseVariant.hashtags) ? baseVariant.hashtags : defaultHashtags,
      caption: freshCaption,
    };
    collected.push(newVariant);
    seenKeys.add(freshKey);
  }

  if (collected.length > 5) {
    collected.splice(5);
  }

  // Apply dedupe helper for final consistency
  const deduped = dedupeVariantsForRanking(CaptionArray.parse(collected), 5, { platform: params.platform, theme: params.theme, context: params.context });
  return deduped;
}

const MAX_RANK_ATTEMPTS = 3;

interface PromptBundle {
  sys: string;
  guard: string;
  prompt: string;
}

interface RankingAttemptResult {
  parsed: z.infer<typeof RankResult>;
  normalizedFinal: CaptionVariant;
  violations: string[];
}

async function executeRankingAttempt(
  variants: unknown[],
  prompts: PromptBundle,
  retryHint?: string
): Promise<RankingAttemptResult> {
  let res;
  try {
    const payload = {
      variants,
      retry_hint: retryHint ?? null,
      banned_examples: bannedExamples,
    };
    res = await textModel.generateContent([
      { text: `${prompts.sys}\n${prompts.guard}\n${prompts.prompt}\n${JSON.stringify(payload)}` },
    ]);
  } catch (error) {
    console.error('Text-only textModel.generateContent failed:', error);
    throw error;
  }
  let json = stripToJSON(res.response.text()) as unknown;

  if (Array.isArray(json)) {
    const winner = (json[0] as CaptionVariant | undefined) ?? variants[0];
    json = {
      winner_index: 0,
      scores: [5, 4, 3, 2, 1],
      reason: "Selected based on engagement potential",
      final: winner,
    };
  }

  if (!json || typeof json !== 'object') {
    throw new Error('Ranking response missing body');
  }

  const container = json as { final?: Record<string, unknown> };
  if (!container.final || typeof container.final !== 'object') {
    throw new Error('Ranking response missing final caption');
  }

  const normalizedFinal = normalizeVariantForRanking(container.final);
  const violations = detectRankingViolations(normalizedFinal);
  const sanitizedFinal = sanitizeVariantForRanking(normalizedFinal);
  container.final = sanitizedFinal;

  const parsed = RankResult.parse(json);

  return { parsed, normalizedFinal, violations };
}

async function rankAndSelectWithRetry(
  variants: unknown[],
  attempt: number,
  prompts: PromptBundle,
  retryHint?: string
): Promise<z.infer<typeof RankResult>> {
  const { parsed, normalizedFinal, violations } = await executeRankingAttempt(variants, prompts, retryHint);

  if (violations.length === 0) {
    return parsed;
  }

  if (attempt + 1 >= MAX_RANK_ATTEMPTS) {
    const safeIndex = variants.findIndex((variant) => detectRankingViolations(variant as CaptionVariant).length === 0);
    if (safeIndex >= 0) {
      const safeVariant = sanitizeVariantForRanking(variants[safeIndex] as CaptionVariant);
      return {
        ...parsed,
        winner_index: safeIndex,
        final: safeVariant,
        reason: truncateReason(
          `Fallback to variant ${safeIndex + 1} after violations: ${formatViolations(violations)}`
        ),
      };
    }

    const sanitized = sanitizeVariantForRanking(normalizedFinal);
    return {
      ...parsed,
      final: sanitized,
      reason: truncateReason(`Sanitized disqualified caption (${formatViolations(violations)})`),
    };
  }

  const hint = `Previous winner broke rules (${formatViolations(violations)}). Ignore those entries and pick the most human alternative.`;
  return rankAndSelectWithRetry(variants, attempt + 1, prompts, hint);
}

export async function rankAndSelect(
  variants: unknown[],
  params?: {
    platform?: "instagram" | "x" | "reddit" | "tiktok";
    nsfw?: boolean;
    theme?: string;
    context?: string;
    facts?: Record<string, unknown>;
    existingCaption?: string;
  }
): Promise<z.infer<typeof RankResult>> {
  const prompts: PromptBundle = {
    sys: await load("system.txt"),
    guard: await load("guard.txt"),
    prompt: await load("rank.txt"),
  };
  
  const result = await rankAndSelectWithRetry(variants, 0, prompts);
  
  // Enforce platform hashtag limits
  if (params?.platform && result.final?.hashtags) {
    const platformLimit = params.platform === 'x' ? 2 : params.platform === 'instagram' ? 30 : 5;
    if (Array.isArray(result.final.hashtags) && result.final.hashtags.length > platformLimit) {
      result.final.hashtags = result.final.hashtags.slice(0, platformLimit);
    }
  }
  
  return result;
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
  let ranked = await rankAndSelect(variants, { platform, nsfw, theme, context });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone, hint:`Fix: ${err}. Be specific and engaging.` });
    variants = dedupeVariantsForRanking(variants, 5, { platform, theme, context });
    ranked = await rankAndSelect(variants, { platform, nsfw, theme, context });
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}