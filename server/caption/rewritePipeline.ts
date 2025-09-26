import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { visionModel, textModel } from "../lib/gemini";
import { rankAndSelect } from "./geminiPipeline";
import { CaptionArray, RankResult, platformChecks, CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { BANNED_WORDS_HINT, variantContainsBannedWord } from "./bannedWords";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { formatVoiceContext } from "./voiceTraits";
import { ensureFactCoverage } from "./ensureFactCoverage";
import { inferFallbackFromFacts, ensureFallbackCompliance } from "./inferFallbackFromFacts";
import { detectRankingViolations, formatViolations } from "./rankingGuards";

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
  platform: "instagram" | "x" | "reddit" | "tiktok";
  voice: string;
  existingCaption: string;
  facts?: Record<string, unknown>;
  hint?: string;
  nsfw?: boolean;
  doNotDrop?: string[];
  style?: string;
  mood?: string;
  toneExtras?: Record<string, string>;
};

const VARIANT_TARGET = 5;
const VARIANT_RETRY_LIMIT = 3;

const sanitizeHintForRetry = (hint: string | undefined): string | undefined => {
  if (!hint) return undefined;
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
};

export async function variantsRewrite(params: RewriteVariantsParams) {
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("rewrite.txt")
  ]);

  let attempts = 0;
  const baseHint = sanitizeHintForRetry(params.hint);
  let currentHint = baseHint;
  const mandatoryTokens = params.doNotDrop && params.doNotDrop.length > 0
    ? `MANDATORY TOKENS: ${params.doNotDrop.join(" | ")}`
    : "";

  const collected: Array<Record<string, unknown>> = [];

  while (attempts < VARIANT_RETRY_LIMIT && collected.length < VARIANT_TARGET) {
    attempts += 1;

    const voiceContext = formatVoiceContext(params.voice);
    const lines: string[] = [
      `PLATFORM: ${params.platform}`,
      `VOICE: ${params.voice}`,
      voiceContext
    ];

    if (params.style) lines.push(`STYLE: ${params.style}`);
    if (params.mood) lines.push(`MOOD: ${params.mood}`);
    if (params.toneExtras) {
      for (const [key, value] of Object.entries(params.toneExtras)) {
        lines.push(`${key.toUpperCase()}: ${value}`);
      }
    }

    lines.push(`EXISTING_CAPTION: ${serializePromptField(params.existingCaption)}`);
    if (params.facts) {
      lines.push(`IMAGE_FACTS: ${JSON.stringify(params.facts)}`);
    }
    lines.push(`NSFW: ${params.nsfw ?? false}`);
    if (mandatoryTokens) {
      lines.push(mandatoryTokens);
    }
    if (currentHint && currentHint.trim().length > 0) {
      lines.push(`HINT:${serializePromptField(currentHint, { block: true })}`);
    }

    const promptLines = lines.filter((line): line is string => Boolean(line && line.trim()));
    const voiceGuide = buildVoiceGuideBlock(params.voice);
    const promptSections = [sys, guard, prompt, promptLines.join("\n")];
    if (voiceGuide) {
      promptSections.push(voiceGuide);
    }

    let response;
    try {
      response = await textModel.generateContent([{ text: promptSections.join("\n") }]);
    } catch (error) {
      console.error('Gemini textModel.generateContent failed:', error);
      throw error;
    }

    const parsed = stripToJSON(response.response.text());
    let hasBannedWords = false;

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") {
          continue;
        }

        const variant = { ...(entry as Record<string, unknown>) };

        variant.safety_level = normalizeSafetyLevel(
          typeof variant.safety_level === "string" ? variant.safety_level : "normal"
        );

        if (typeof variant.mood !== "string" || variant.mood.trim().length < 2) {
          variant.mood = params.mood ?? "engaging";
        }
        if (typeof variant.style !== "string" || variant.style.trim().length < 2) {
          variant.style = params.style ?? "authentic";
        }

        const fallback = ensureFallbackCompliance(
          {
            caption: typeof variant.caption === "string" ? variant.caption : undefined,
            hashtags: Array.isArray(variant.hashtags)
              ? variant.hashtags.filter((tag): tag is string => typeof tag === "string")
              : undefined,
            cta: typeof variant.cta === "string" ? variant.cta : undefined,
            alt: typeof variant.alt === "string" ? variant.alt : undefined
          },
          {
            platform: params.platform,
            facts: params.facts,
            existingCaption: params.existingCaption
          }
        );

        variant.hashtags = fallback.hashtags;
        variant.cta = fallback.cta;
        variant.alt = fallback.alt;

        if (typeof variant.caption !== "string" || variant.caption.trim().length < 1) {
          variant.caption = params.existingCaption || "Here's something I'm proud of today.";
        }

        variant.nsfw = typeof variant.nsfw === "boolean" ? variant.nsfw : Boolean(params.nsfw);

        if (variantContainsBannedWord(variant)) {
          hasBannedWords = true;
          continue;
        }

        collected.push(variant);
        if (collected.length >= VARIANT_TARGET) {
          break;
        }
      }
    }

    if (collected.length < VARIANT_TARGET) {
      const needed = VARIANT_TARGET - collected.length;
      const retryParts: string[] = [`Generate ${needed} more unique, distinct variants.`];
      if (hasBannedWords) {
        retryParts.push(BANNED_WORDS_HINT);
      }
      if (baseHint && baseHint !== currentHint) {
        retryParts.push(baseHint);
      }
      currentHint = retryParts.join(" ").trim();
    }
  }

  while (collected.length < VARIANT_TARGET) {
    const fallbackContent = inferFallbackFromFacts({
      platform: params.platform,
      facts: params.facts,
      existingCaption: params.existingCaption
    });

    const template = collected[0] ? { ...collected[0] } : {
      caption: params.existingCaption || "Here's something I'm proud of today.",
      alt: fallbackContent.alt,
      hashtags: fallbackContent.hashtags,
      cta: fallbackContent.cta,
      mood: params.mood ?? "engaging",
      style: params.style ?? "authentic",
      safety_level: normalizeSafetyLevel("normal"),
      nsfw: Boolean(params.nsfw)
    };

    template.caption = `${typeof template.caption === "string" ? template.caption : params.existingCaption} Enhanced version ${
      collected.length + 1
    }`;
    template.alt = fallbackContent.alt;
    template.hashtags = fallbackContent.hashtags;
    template.cta = fallbackContent.cta;
    template.mood = typeof template.mood === "string" && template.mood.trim().length >= 2
      ? template.mood
      : params.mood ?? "engaging";
    template.style = typeof template.style === "string" && template.style.trim().length >= 2
      ? template.style
      : params.style ?? "authentic";
    template.safety_level = normalizeSafetyLevel(
      typeof template.safety_level === "string" ? template.safety_level : "normal"
    );
    template.nsfw = typeof template.nsfw === "boolean" ? template.nsfw : Boolean(params.nsfw);

    collected.push(template);
  }

  const trimmed = collected.slice(0, VARIANT_TARGET).map((variant) => CaptionItem.parse(variant));
  return CaptionArray.parse(trimmed);
}

type RewriteToneArgs = {
  style?: string;
  mood?: string
};

async function requestRewriteRanking(
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
    console.error('Rewrite textModel.generateContent failed:', error);
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

async function rerankVariants(
  variants: unknown[],
  params?: { platform?: string }
): Promise<z.infer<typeof RankResult>> {
  const sys = await load("system.txt"), guard = await load("guard.txt"), prompt = await load("rank.txt");
  const promptBlock = `${sys}\n${guard}\n${prompt}`;
  const serializedVariants = JSON.stringify(variants);

  const first = await requestRewriteRanking(variants, serializedVariants, promptBlock, params?.platform);
  let parsed = RankResult.parse(first);
  const violations = detectRankingViolations(parsed.final);

  if (violations.length === 0) {
    return parsed;
  }

  const rerank = await requestRewriteRanking(
    variants,
    serializedVariants,
    promptBlock,
    params?.platform,
    "Previous attempt had violations. Try again with better compliance."
  );
  parsed = RankResult.parse(rerank);
  const rerankViolations = detectRankingViolations(parsed.final);

  if (rerankViolations.length === 0) {
    return parsed;
  }

  const sanitizedFinal = parsed.final;
  const summary = formatViolations(rerankViolations) || parsed.reason;
  return RankResult.parse({
    ...parsed,
    final: sanitizedFinal,
    reason: summary
  });
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
type CaptionItemType = z.infer<typeof CaptionItem>;
type CaptionArrayResult = z.infer<typeof CaptionArray>;
type RankResultType = z.infer<typeof RankResult>;

export async function pipelineRewrite({ platform, voice="flirty_playful", style, mood, existingCaption, imageUrl, nsfw=false }:{
  platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, style?:string, mood?:string, existingCaption:string, imageUrl?:string, nsfw?:boolean }){
  try {
    const facts = imageUrl ? await extractFacts(imageUrl) : undefined;

    const doNotDrop = extractKeyEntities(existingCaption);

    const attemptHints: (string | undefined)[] = [
      undefined,
      "Make it 20% longer with a natural hook and CTA; keep it human, no sparkle clichés.",
      facts
        ? "Make it 25% longer with a natural hook and CTA; rewrite with concrete imagery from IMAGE_FACTS and stay grounded."
        : "Make it 25% longer with a natural hook and CTA; weave in concrete sensory imagery and stay grounded.",
    ];

    const baseParams = { platform, voice, style, mood, existingCaption, facts, nsfw, doNotDrop } as const;

    type AttemptResult = { variants: CaptionArrayResult; ranked: RankResultType; final: CaptionItemType };

    const performAttempt = async (hint?: string): Promise<AttemptResult> => {
      const attemptVariants = await variantsRewrite({ ...baseParams, hint });
      const attemptRanked = await rankAndSelect(attemptVariants, { platform, facts });
      return { variants: attemptVariants, ranked: attemptRanked, final: attemptRanked.final };
    };

    const enforceMandatoryTokens = async (
      attempt: AttemptResult,
      priorHint?: string
    ): Promise<AttemptResult> => {
      if (doNotDrop.length === 0) {
        return attempt;
      }
      const missing = doNotDrop.filter((token) => !attempt.final.caption.includes(token));
      if (missing.length === 0) {
        return attempt;
      }
      const messageParts = [
        priorHint,
        `ABSOLUTE RULE: Keep these tokens verbatim in the caption: ${doNotDrop.join(", ")}`,
        `Previous attempt removed: ${missing.join(", ")}`
      ].filter((part): part is string => Boolean(part && part.trim()));
      const retried = await performAttempt(messageParts.join(" "));
      const retryMissing = doNotDrop.filter((token) => !retried.final.caption.includes(token));
      if (retryMissing.length > 0) {
        throw new Error(`Missing mandatory tokens after retry: ${retryMissing.join(", ")}`);
      }
      return retried;
    };

    let lastAttempt: { variants: CaptionArrayResult; ranked: RankResultType; final: CaptionItemType } | undefined;
    let successfulAttempt: { variants: CaptionArrayResult; ranked: RankResultType; final: CaptionItemType } | undefined;

    for (const hint of attemptHints) {
      let attempt = await performAttempt(hint);
      attempt = await enforceMandatoryTokens(attempt, hint);
      lastAttempt = attempt;
      if (attempt.final.caption.length > existingCaption.length) {
        successfulAttempt = attempt;
        break;
      }
    }

    const chosenAttempt = successfulAttempt ?? lastAttempt;

    if (!chosenAttempt || chosenAttempt.final.caption.length <= existingCaption.length) {
      throw new Error('Rewrite did not produce a longer caption');
    }

    let { variants, ranked, final: out } = chosenAttempt;

    const enforceCoverage = async () => {
      if (!facts) {
        return;
      }
      let attempts = 0;
      let coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      while (!coverage.ok && coverage.hint && attempts < 2) {
        attempts += 1;
        let nextAttempt = await performAttempt(coverage.hint);
        nextAttempt = await enforceMandatoryTokens(nextAttempt, coverage.hint);
        ({ variants, ranked, final: out } = nextAttempt);
        coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      }
    };

    await enforceCoverage();

    if (out.caption.length <= existingCaption.length) {
      throw new Error('Rewrite did not produce a longer caption');
    }

    const err = platformChecks(platform, out);
    if (err) {
      let platformAttempt = await performAttempt(`Fix: ${err}. Be specific, human, and avoid clichés while staying platform safe.`);
      platformAttempt = await enforceMandatoryTokens(platformAttempt, `Fix: ${err}. Be specific, human, and avoid clichés while staying platform safe.`);
      if (platformAttempt.final.caption.length <= existingCaption.length) {
        throw new Error('Platform-specific rewrite failed to improve length');
      }
      const platformErr = platformChecks(platform, platformAttempt.final);
      if (platformErr) {
        throw new Error(platformErr);
      }
      ({ variants, ranked, final: out } = platformAttempt);
      await enforceCoverage();
      if (out.caption.length <= existingCaption.length) {
        throw new Error('Platform-specific rewrite failed to improve length');
      }
    }

    return { provider: 'gemini', facts, variants, ranked, final: out };
  } catch (error) {
    const { openAICaptionFallback } = await import('./openaiFallback');
    const final = await openAICaptionFallback({ platform, voice, existingCaption, imageUrl });
    return { provider: 'openai', final } as CaptionResult;
  }
}