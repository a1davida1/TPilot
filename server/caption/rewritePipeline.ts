import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { textModel, visionModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
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
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { formatVoiceContext } from "./voiceTraits";
import { ensureFactCoverage } from "./ensureFactCoverage";
import { inferFallbackFromFacts } from "./inferFallbackFromFacts";

// CaptionResult interface for type safety
interface CaptionResult {
  provider: string;
  final: unknown;
  facts?: unknown;
  variants?: unknown;
  ranked?: unknown;
}

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
async function b64(url:string){ const r=await fetch(url); if(!r.ok) throw new Error("fetch failed"); const b=Buffer.from(await r.arrayBuffer()); return b.toString("base64"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

const brandStopwords = new Set(["And", "For", "With", "Your", "This", "That", "The"]);

interface EntityMatch {
  token: string;
  index: number;
  length: number;
  priority: number;
}

interface MatchOptions {
  protect?: boolean;
  filter?: (match: RegExpMatchArray) => boolean;
  transform?: (match: RegExpMatchArray) => string;
}

const withinRange = (index: number, ranges: Array<{ start: number; end: number }>) =>
  ranges.some((range) => index >= range.start && index < range.end);

export function extractKeyEntities(existingCaption: string): string[] {
  if (!existingCaption) {
    return [];
  }

  const matches: EntityMatch[] = [];
  const protectedRanges: Array<{ start: number; end: number }> = [];

  const collectMatches = (regex: RegExp, priority: number, options?: MatchOptions) => {
    for (const match of existingCaption.matchAll(regex)) {
      if (!match[0]) {
        continue;
      }
      if (options?.filter && !options.filter(match)) {
        continue;
      }
      const index = match.index ?? existingCaption.indexOf(match[0]);
      if (index < 0) {
        continue;
      }
      const token = options?.transform ? options.transform(match) : match[0];
      if (!token.trim()) {
        continue;
      }
      matches.push({ token, index, length: token.length, priority });
      if (options?.protect) {
        protectedRanges.push({ start: index, end: index + token.length });
      }
    }
  };

  collectMatches(/https?:\/\/[^\s"']+|www\.[^\s"']+/gi, 0, { protect: true });
  collectMatches(/@[A-Za-z0-9_.]+/g, 1, { protect: true });
  collectMatches(/#[A-Za-z0-9_]+/g, 2, { protect: true });
  collectMatches(/"[^"]+"|"[^"]+"|'[^']+'|'[^']+'/g, 3, { protect: true });
  collectMatches(/\b\d{1,4}(?:[\/.-]\d{1,4})+\b/g, 4, { protect: true });
  collectMatches(/\b\d+(?:[.,]\d+)?%?\b/g, 5, {
    filter: (match) => {
      const index = match.index ?? 0;
      return !withinRange(index, protectedRanges);
    }
  });
  collectMatches(/\b[\w&-]*(?:®|™|©)\b/g, 6, {
    filter: (match) => {
      const index = match.index ?? 0;
      return !withinRange(index, protectedRanges);
    }
  });
  collectMatches(/\b[A-Z][A-Za-z0-9]*(?:[A-Z][A-Za-z0-9]+)+\b/g, 7, {
    filter: (match) => {
      const index = match.index ?? 0;
      if (index > 0) {
        const prev = existingCaption[index - 1];
        if (prev === '@' || prev === '#') {
          return false;
        }
      }
      return !withinRange(index, protectedRanges);
    }
  });
  collectMatches(/\b(?:[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){1,2})\b/g, 8, {
    filter: (match) => {
      const index = match.index ?? 0;
      if (withinRange(index, protectedRanges)) {
        return false;
      }
      const words = match[0].split(/\s+/u);
      return words.some((word) => word.length > 3 && !brandStopwords.has(word));
    }
  });

  matches.sort((a, b) => (a.index - b.index) || (a.priority - b.priority));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of matches) {
    const normalized = match.token.trim();
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export async function extractFacts(imageUrl:string){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");
  const img={ inlineData:{ data: await b64(imageUrl), mimeType:"image/jpeg" } };
  try {
    const res=await visionModel.generateContent([{text:sys+"\n"+guard+"\n"+prompt}, img]);
    return stripToJSON(res.response.text());
  } catch (error) {
    console.error('Gemini visionModel.generateContent failed:', error);
    throw error;
  }
}

type RewriteVariantsParams = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice:string;
  existingCaption:string;
  facts?:Record<string, unknown>;
  hint?:string;
  nsfw?:boolean;
  doNotDrop?: string[];
  style?: string;
  mood?: string
};

export async function variantsRewrite(params:RewriteVariantsParams){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rewrite.txt");
  const voiceContext = formatVoiceContext(params.voice);
  const user = [
    `PLATFORM: ${params.platform}`,
    `VOICE: ${params.voice}`,
    voiceContext,
    params.style ? `STYLE: ${params.style}` : "",
    params.mood ? `MOOD: ${params.mood}` : "",
    `EXISTING_CAPTION: ${serializePromptField(params.existingCaption)}`,
    params.facts ? `IMAGE_FACTS: ${JSON.stringify(params.facts)}` : "",
    `NSFW: ${params.nsfw || false}`,
    params.hint ? `HINT:${serializePromptField(params.hint, { block: true })}` : "",
  ].filter((line): line is string => Boolean(line)).join("\n");
  const voiceGuide = buildVoiceGuideBlock(params.voice);
  const promptSections = [sys, guard, prompt, user];
  if (voiceGuide) promptSections.push(voiceGuide);
  let res;
  try {
    res=await textModel.generateContent([{ text: promptSections.join("\n") }]);
  } catch (error) {
    console.error('Gemini textModel.generateContent failed:', error);
    throw error;
  }
  const json=stripToJSON(res.response.text()) as unknown;
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item) => {
      const variant = item as Record<string, unknown>;
      variant.safety_level = normalizeSafetyLevel(
        typeof variant.safety_level === 'string' ? variant.safety_level : 'normal'
      );
      // Fix other fields
      if(typeof variant.mood !== 'string' || variant.mood.length<2) variant.mood="engaging";
      if(typeof variant.style !== 'string' || variant.style.length<2) variant.style="authentic";
      if(typeof variant.cta !== 'string' || variant.cta.length<2) variant.cta="Check it out";
      if(typeof variant.alt !== 'string' || variant.alt.length<20) variant.alt="Engaging social media content";
      if(!Array.isArray(variant.hashtags)) variant.hashtags=["#content", "#creative", "#amazing"];
      if(typeof variant.caption !== 'string' || variant.caption.length<1) variant.caption="Check out this amazing content, you'll love it and want more!";
    });

    // Ensure exactly 5 variants by padding with variations if needed
    while(json.length < 5) {
      const template = (json[0] as Record<string, unknown>) || {
        caption: "Check out this amazing content, you'll love it and want more!",
        alt: "Engaging social media content",
        hashtags: ["#content", "#creative", "#amazing"],
        cta: "Check it out",
        mood: "engaging",
        style: "authentic",
        safety_level: normalizeSafetyLevel('normal'),
        nsfw: false
      };
      json.push({
        ...template,
        caption: `${template.caption as string} This enhanced version provides much more engaging content and better call-to-action for your audience! (Variant ${json.length + 1})`
      });
    }

    // Trim to exactly 5 if more than 5
    if(json.length > 5) {
      json.splice(5);
    }
  }
  return CaptionArray.parse(json);
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
    console.error('Rewrite textModel.generateContent failed:', error);
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

type RewritePipelineArgs = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice?:string;
  existingCaption:string;
  imageUrl?:string;
  nsfw?:boolean;
  style?: string;
  mood?: string;
};

/**
 * Caption rewriting pipeline that enhances existing captions while preserving tone.
 *
 * @remarks
 * Persona controls such as `style`, `mood`, and future tone keys must persist through
 * retries. When platform validation fails we re-run Gemini with the exact same tone
 * payload so the caller's requested persona stays intact.
 */
export async function pipelineRewrite({ platform, voice="flirty_playful", style, mood, existingCaption, imageUrl, nsfw=false }:{
  platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, style?:string, mood?:string, existingCaption:string, imageUrl?:string, nsfw?:boolean }){
  try {
    const facts = imageUrl ? await extractFacts(imageUrl) : undefined;
    const doNotDrop = extractKeyEntities(existingCaption);
    const tone = { style, mood };
    let variants = await variantsRewrite({ platform, voice, ...tone, existingCaption, facts, nsfw, doNotDrop });
    let ranked = await rankAndSelect(variants);
    let out = ranked.final;

    const retryHints = [
      'Make it 20% longer with a natural hook and CTA; keep it human, no sparkle clichés.',
      'Focus on expanding the middle section with vivid details or specific context.',
      'Add personality and character-specific phrasing while being more descriptive.'
    ];

    const enforceCoverage = async () => {
      if (!facts) return;
      let attempts = 0;
      let coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      while (!coverage.ok && coverage.hint && attempts < 2) {
        attempts += 1;
        variants = await variantsRewrite({ platform, voice, ...tone, existingCaption, facts, hint: coverage.hint, nsfw, doNotDrop });
        ranked = await rankAndSelect(variants);
        out = ranked.final;
        coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      }
    };

    const enforceMandatoryTokens = async (extraHint?: string) => {
      if (doNotDrop.length === 0) {
        return;
      }
      const missing = doNotDrop.filter((token) => !out.caption.includes(token));
      if (missing.length === 0) {
        return;
      }
      const messageParts = [
        extraHint,
        `ABSOLUTE RULE: Keep these tokens verbatim in the caption: ${doNotDrop.join(', ')}`,
        `Previous attempt removed: ${missing.join(', ')}`
      ].filter((part): part is string => Boolean(part && part.trim()));
      variants = await variantsRewrite({
        platform,
        voice,
        ...tone,
        existingCaption,
        facts,
        nsfw,
        doNotDrop,
        hint: messageParts.join(' ')
      });
      ranked = await rankAndSelect(variants);
      out = ranked.final;
      const retryMissing = doNotDrop.filter((token) => !out.caption.includes(token));
      if (retryMissing.length > 0) {
        throw new Error(`Missing mandatory tokens after retry: ${retryMissing.join(', ')}`);
      }
    };

    const runRewrite = async (hint?: string) => {
      variants = await variantsRewrite({ platform, voice, existingCaption, facts, hint, nsfw, doNotDrop, ...tone });
      ranked = await rankAndSelect(variants);
      out = ranked.final;
    };

    const ensureLongerCaption = async (baseHint?: string) => {
      if (out.caption.length > existingCaption.length) {
        return;
      }
      for (const hint of retryHints) {
        const combinedHint = baseHint ? `${baseHint} ${hint}` : hint;
        await runRewrite(combinedHint);
        if (out.caption.length > existingCaption.length) {
          return;
        }
      }
      throw new Error("rewrite-too-short");
    };

    await ensureLongerCaption();
    await enforceCoverage();

    const err = platformChecks(platform, out);
    if (err) {
      await runRewrite(`Fix: ${err}. Be specific and engaging.`);
      await ensureLongerCaption(`Fix: ${err}. Be specific and engaging.`);
      await enforceMandatoryTokens(`Fix platform issue: ${err}.`);
      await enforceCoverage();
    }

    return { provider: 'gemini', facts, variants, ranked, final: out };
  } catch (error) {
    const { openAICaptionFallback } = await import('./openaiFallback');
    const final = await openAICaptionFallback({ platform, voice, existingCaption, imageUrl });
    return { provider: 'openai', final } as CaptionResult;
  }
}