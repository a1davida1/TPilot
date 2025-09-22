import fs from "node:fs/promises";
import path from "node:path";
import { textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { formatVoiceContext } from "./voiceTraits";
import { serializePromptField } from "./promptUtils";
import { inferFallbackFromFacts } from "./inferFallbackFromFacts";
import { dedupeVariantsForRanking } from "./dedupeVariants";

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
){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  let json=stripToJSON(res.response.text()) as unknown;

  // Handle case where AI returns array instead of ranking object
  if(Array.isArray(json)) {
    const winner = json[0] || variants[0];
    json = {
      winner_index: 0,
      scores: [5, 4, 3, 2, 1],
      reason: "Selected based on engagement potential",
      final: winner
    };
  }

  // Fix safety_level in final result
  if((json as Record<string, unknown>).final){
    const final = (json as { final: Record<string, unknown> }).final;
    const fallback = params?.platform
      ? inferFallbackFromFacts({
          platform: params.platform,
          facts: params.facts,
          theme: params.theme,
          context: params.context,
          existingCaption: typeof final.caption === 'string' ? final.caption : params.existingCaption,
        })
      : undefined;
    const fallbackHashtags = fallback?.hashtags ?? ["#content", "#creative", "#amazing"];
    const fallbackCta = fallback?.cta ?? "Check it out";
    const fallbackAlt = fallback?.alt ?? "Engaging social media content";
    final.safety_level = normalizeSafetyLevel(
      typeof final.safety_level === 'string' ? final.safety_level : 'normal'
    );
    if(typeof final.mood !== 'string' || final.mood.length<2) final.mood="engaging";
    if(typeof final.style !== 'string' || final.style.length<2) final.style="authentic";
    if(typeof final.cta !== 'string' || final.cta.length<2) final.cta=fallbackCta;
    if(typeof final.alt !== 'string' || final.alt.length<20) final.alt=fallbackAlt;
    const finalHashtags = Array.isArray(final.hashtags)
      ? (final.hashtags as unknown[])
          .filter((tag): tag is string => typeof tag === 'string')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      : [];
    if(finalHashtags.length === 0 || finalHashtags.length < fallbackHashtags.length) {
      final.hashtags = fallbackHashtags;
    } else {
      final.hashtags = finalHashtags;
    }
    if(typeof final.caption !== 'string' || final.caption.length<1) final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
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