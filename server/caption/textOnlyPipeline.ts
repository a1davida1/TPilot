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
  HUMAN_CTA,
  buildRerankHint,
  detectVariantViolations,
  fallbackHashtags,
  formatViolationSummary,
  sanitizeFinalVariant
} from "./rankGuards";

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

  const defaults: Record<string, unknown> = {
    caption: "Sharing something I'm genuinely proud of.",
    alt: "Detailed social media alt text describing the scene.",
    hashtags: fallbackHashtags(params.platform),
    cta: HUMAN_CTA,
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
      hashtags: Array.isArray(baseVariant.hashtags) ? baseVariant.hashtags : fallbackHashtags(params.platform),
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
  params?: { platform?: string }
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
  let ranked = await rankAndSelect(variants, { platform });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone, hint:`Fix: ${err}. Be specific and engaging.` });
    variants = dedupeVariantsForRanking(variants, 5, { platform, theme, context });
    ranked = await rankAndSelect(variants, { platform });
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}