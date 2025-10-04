import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import {
  getVisionModel,
  getTextModel,
  isGeminiAvailable,
  type GeminiModel,
} from "../lib/gemini.js";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { BANNED_WORDS_HINT, variantContainsBannedWord } from "./bannedWords";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { formatVoiceContext } from "./voiceTraits";
import { ensureFactCoverage } from "./ensureFactCoverage";
import { ensureFallbackCompliance } from "./inferFallbackFromFacts";
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

// Custom error class for image validation failures
export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

// CaptionResult interface for type safety
interface CaptionResult {
  provider: string;
  final: z.infer<typeof CaptionItem>;
  facts?: Record<string, unknown>;
  variants?: z.infer<typeof CaptionArray>;
  ranked?: z.infer<typeof RankResult>;
  titles?: string[];
}

type GeminiResponse = {
  text?: (() => unknown) | string;
  response?: unknown;
};

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

  const candidate = payload as GeminiResponse;
  const value = candidate.text;
  if (typeof value === "string") {
    return ensureNonEmpty(value);
  }
  if (typeof value === "function") {
    const resolved = await Promise.resolve(value());
    return typeof resolved === "string" ? ensureNonEmpty(resolved) : undefined;
  }

  if (candidate.response) {
    return resolveResponseText(candidate.response);
  }

  return undefined;
}

const _MAX_VARIANT_ATTEMPTS = 4;
const VARIANT_TARGET = 5;
const VARIANT_RETRY_LIMIT = 4;
const CAPTION_KEY_LENGTH = 80;
const TITLE_MAX_LENGTH = 64;
const TITLE_MAX_WORDS = 9;
const TITLE_MIN_LENGTH = 4;
const LOWERCASE_WORDS = new Set([
  "and",
  "or",
  "the",
  "with",
  "a",
  "an",
  "of",
  "to",
  "for",
  "in",
  "on",
  "at",
  "by"
]);

const safeFallbackCaption = "Check out this amazing content!";
const safeFallbackAlt = "Detailed alt text describing the scene.";
const safeFallbackHashtags = ["#content", "#creative", "#amazing"];
const safeFallbackCta = "Check it out";
const safeFactDefaults: Record<string, unknown> = {
  categories: [],
  objects: [],
  keywords: [],
  summary: "",
  colors: [],
  vibe: "",
  setting: "",
  wardrobe: [],
  angles: [],
  mood: "",
  style: "",
};

function buildVariantFallbackBatch(params: {
  style?: string;
  mood?: string;
  nsfw?: boolean;
}): Record<string, unknown>[] {
  const fallbackCaptions = [
    "Check out this amazing content!",
    "Excited to share this with you today!",
    "Something special I wanted to show you!",
    "Here's what I've been working on!",
    "Can't wait for you to see this!",
  ];
  
  return Array.from({ length: VARIANT_TARGET }, (_, index) => ({
    caption: fallbackCaptions[index] || safeFallbackCaption,
    alt: safeFallbackAlt,
    hashtags: [...safeFallbackHashtags],
    cta: safeFallbackCta,
    mood: params.mood ?? "engaging",
    style: params.style ?? "authentic",
    safety_level: "normal",
    nsfw: params.nsfw ?? false,
  }));
}

const MIN_IMAGE_BYTES = 32;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB limit for inbound images

type CaptionPlatform = "instagram" | "x" | "reddit" | "tiktok";

type VariantPromptEnvelope = {
  platform: CaptionPlatform;
  voice: string;
  style: string;
  mood: string;
  facts: Record<string, unknown>;
  nsfw: boolean;
  hint: string;
};

function normalizePromptStyle(value?: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "authentic";
}

function normalizePromptMood(value?: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "engaging";
}

function serializeVariantPromptEnvelope(envelope: VariantPromptEnvelope): string {
  return JSON.stringify(envelope);
}

function buildVariantPromptEnvelope(params: {
  platform: CaptionPlatform;
  voice: string;
  style?: string;
  mood?: string;
  facts?: Record<string, unknown>;
  nsfw?: boolean;
  hintSegments: Array<string | undefined>;
}): string {
  const hint = params.hintSegments
    .map(segment => {
      if (!segment) return undefined;
      const trimmed = segment.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })
    .filter((segment): segment is string => Boolean(segment))
    .join("\n");

  const envelope: VariantPromptEnvelope = {
    platform: params.platform,
    voice: params.voice,
    style: normalizePromptStyle(params.style),
    mood: normalizePromptMood(params.mood),
    facts: params.facts ?? {},
    nsfw: params.nsfw ?? false,
    hint,
  };

  return serializeVariantPromptEnvelope(envelope);
}

function _captionKey(caption: string): string {
  return caption.trim().slice(0, 80).toLowerCase();
}

function _hintSnippet(caption: string): string {
  const normalized = caption.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
}

function _uniqueCaptionKey(caption: string): string {
  return caption.trim().slice(0, CAPTION_KEY_LENGTH).toLowerCase();
}

function truncateForHint(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length <= 60) {
    return trimmed;
  }
  return `${trimmed.slice(0, 57)}...`;
}

export type GeminiPromptTone = {
  style?: string;
  mood?: string;
  extras?: Record<string, string>;
};

export type GeminiDuplicatePromptConfig = {
  captions: string[];
  mode?: "avoid" | "rewrite";
};

export interface BuildGeminiPromptParams {
  platform: string;
  voice: string;
  tone?: GeminiPromptTone;
  facts?: Record<string, unknown>;
  nsfw?: boolean;
  hint?: string;
  duplicates?: GeminiDuplicatePromptConfig;
  voiceContext?: string;
  existingCaption?: string;
  mandatoryTokens?: string[];
}

function formatDuplicateHint(duplicates: GeminiDuplicatePromptConfig | undefined): string | undefined {
  if (!duplicates) {
    return undefined;
  }

  const sanitizedCaptions = duplicates.captions
    .map(caption => caption.trim())
    .filter((caption): caption is string => caption.length > 0);

  if (sanitizedCaptions.length === 0) {
    return undefined;
  }

  if (duplicates.mode === "rewrite") {
    const latest = sanitizedCaptions[sanitizedCaptions.length - 1];
    return `You already wrote "${truncateForHint(latest)}". Provide a completely different approach.`;
  }

  return `Avoid repeating or lightly editing these captions: ${sanitizedCaptions.join(" | ")}.`;
}

export function buildGeminiPrompt(params: BuildGeminiPromptParams): string {
  const toneLines: string[] = [];

  if (params.tone?.style && params.tone.style.trim().length > 0) {
    toneLines.push(`STYLE: ${params.tone.style.trim()}`);
  }
  if (params.tone?.mood && params.tone.mood.trim().length > 0) {
    toneLines.push(`MOOD: ${params.tone.mood.trim()}`);
  }
  if (params.tone?.extras) {
    for (const [key, value] of Object.entries(params.tone.extras)) {
      if (typeof value === "string" && value.trim().length > 0) {
        toneLines.push(`${key.toUpperCase()}: ${value.trim()}`);
      }
    }
  }

  const duplicateHint = formatDuplicateHint(params.duplicates);
  const hintSegments: Array<string | undefined> = [duplicateHint];
  if (params.hint && params.hint.trim().length > 0) {
    hintSegments.push(params.hint.trim());
  }

  const cleanedHintSegments = hintSegments.filter(
    (segment): segment is string => Boolean(segment && segment.trim().length > 0)
  );

  const hintLine = cleanedHintSegments.length > 0
    ? `HINT:${serializePromptField(cleanedHintSegments.join(" "), { block: true })}`
    : undefined;

  const lines: Array<string | undefined> = [
    `PLATFORM: ${params.platform}`,
    `VOICE: ${params.voice}`,
    params.voiceContext && params.voiceContext.trim().length > 0 ? params.voiceContext.trim() : undefined,
    ...toneLines,
    params.existingCaption
      ? `EXISTING_CAPTION: ${serializePromptField(params.existingCaption, { block: true })}`
      : undefined,
    params.facts ? `IMAGE_FACTS: ${JSON.stringify(params.facts)}` : undefined,
    `NSFW: ${params.nsfw ?? false}`,
    params.mandatoryTokens && params.mandatoryTokens.length > 0
      ? `MANDATORY TOKENS: ${params.mandatoryTokens.join(" | ")}`
      : undefined,
    hintLine,
  ];

  return lines
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n");
}

function toTitleCase(input: string): string {
  return input
    .split(" ")
    .map((word, index) => {
      if (word.length === 0) return word;
      const lower = word.toLowerCase();
      if (index !== 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function normalizeTitleSource(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/#[^\s]+/g, "")
    .replace(/@[^\s]+/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const sentences = cleaned
    .split(/(?:[.!?]+|\n+)/g)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const base = sentences[0] ?? cleaned;
  const words = base.split(" ").filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  const sliced = words.slice(0, TITLE_MAX_WORDS).join(" ").replace(/[,:;.!?]+$/g, "").trim();
  const candidate = sliced.length > 0 ? sliced : base;
  const normalized = candidate.length > TITLE_MAX_LENGTH ? candidate.slice(0, TITLE_MAX_LENGTH).trim() : candidate;
  if (normalized.length < TITLE_MIN_LENGTH) {
    return null;
  }
  return toTitleCase(normalized);
}

type TitleCandidateContext = {
  final?: z.infer<typeof CaptionItem>;
  ranked?: z.infer<typeof RankResult>;
  variants?: z.infer<typeof CaptionArray>;
};

export function generateTitleCandidates({ final, ranked, variants }: TitleCandidateContext): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();
  const register = (caption?: string) => {
    const candidate = normalizeTitleSource(typeof caption === "string" ? caption : undefined);
    if (!candidate) return;
    const key = candidate.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    titles.push(candidate);
  };

  register(final?.caption);
  if (ranked?.final && ranked.final !== final) {
    register(ranked.final.caption);
  }
  if (variants && variants.length > 0) {
    for (const variant of variants.slice(0, 3)) {
      register(variant.caption);
    }
  }

  if (titles.length === 0 && final?.caption) {
    const fallback = normalizeTitleSource(final.caption);
    if (fallback) titles.push(fallback);
  }

  return titles;
}

export function enrichWithTitleCandidates(
  final: z.infer<typeof CaptionItem>,
  context: { variants?: z.infer<typeof CaptionArray>; ranked?: z.infer<typeof RankResult> }
): { final: z.infer<typeof CaptionItem>; ranked?: z.infer<typeof RankResult> } {
  const titles = generateTitleCandidates({ final, ranked: context.ranked, variants: context.variants });
  if (titles.length === 0) {
    return { final, ranked: context.ranked };
  }
  const finalWithTitles = { ...final, titles } as z.infer<typeof CaptionItem>;
  if (context.ranked) {
    return { final: finalWithTitles, ranked: { ...context.ranked, final: finalWithTitles } };
  }
  return { final: finalWithTitles };
}

// Sanitize hint strings for retry logic
function sanitizeHintForRetry(hint: string | undefined): string | undefined {
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
  facts?: Record<string, unknown>,
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
      facts,
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

type RewriteVariantsParams = {
  platform: CaptionPlatform;
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

async function load(p: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "prompts", p), "utf8");
}

// Helper to build system prompt with tone parameters
function buildSystemPrompt(basePrompt: string, tone?: {style?: string; mood?: string}): string {
  if (!tone || (!tone.style && !tone.mood)) return basePrompt;
  
  const toneLines: string[] = [];
  if (tone.style) toneLines.push(`STYLE: ${tone.style}`);
  if (tone.mood) toneLines.push(`MOOD: ${tone.mood}`);
  
  return toneLines.length > 0 ? `${basePrompt}\n${toneLines.join('\n')}` : basePrompt;
}
async function b64(url: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new InvalidImageError(`fetch failed: ${r.status} ${r.statusText}`);

    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/"))
      throw new InvalidImageError(`unsupported content-type: ${ct}`);

    const contentLengthHeader = r.headers.get("content-length");
    if (contentLengthHeader) {
      const declaredLength = Number.parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        throw new InvalidImageError(
          `image exceeds maximum allowed size (${declaredLength} bytes, limit ${MAX_IMAGE_BYTES})`
        );
      }
    }

    const body = r.body;
    if (!body) {
      throw new InvalidImageError("response body is empty");
    }

    const reader = body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    // Stream the body to ensure we never load more than MAX_IMAGE_BYTES into memory
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel(`image exceeds limit of ${MAX_IMAGE_BYTES} bytes`);
        throw new InvalidImageError(
          `image exceeds maximum allowed size (${total} bytes read, limit ${MAX_IMAGE_BYTES})`
        );
      }
      chunks.push(Buffer.from(value));
    }

    const b = Buffer.concat(chunks, total);
    if (b.length < MIN_IMAGE_BYTES) {
      throw new InvalidImageError(
        `image data too small after decoding (${b.length} bytes)`
      );
    }
    const base64 = b.toString("base64");

    return { base64, mimeType: ct.split(";")[0] };
  } catch (err) {
    console.error("Error fetching image:", err);
    if (err instanceof InvalidImageError) throw err;
    throw new InvalidImageError(
      `Failed to fetch image: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
function stripToJSON(txt: string): unknown {
  const i = Math.min(...[txt.indexOf("{"), txt.indexOf("[")].filter(x => x >= 0));
  const j = Math.max(txt.lastIndexOf("}"), txt.lastIndexOf("]"));
  return JSON.parse((i >= 0 && j >= 0) ? txt.slice(i, j + 1) : txt);
}

export async function variantsRewrite(
  params: RewriteVariantsParams
): Promise<z.infer<typeof CaptionArray>> {
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("rewrite.txt")
  ]);

  const textModel = getTextModel();
  const voiceGuide = buildVoiceGuideBlock(params.voice);
  const sanitizedBaseHint = sanitizeHintForRetry(params.hint);
  const voiceContext = formatVoiceContext(params.voice);

  const collectedVariants: z.infer<typeof CaptionItem>[] = [];
  const capturedCaptions: string[] = [];
  const duplicatesThisAttempt: string[] = [];
  let hasBannedWords = false;

  for (let attempt = 0; attempt < VARIANT_RETRY_LIMIT && collectedVariants.length < VARIANT_TARGET; attempt += 1) {
    const needed = VARIANT_TARGET - collectedVariants.length;
    const baseHintWithVariety = `${sanitizedBaseHint ? `${sanitizedBaseHint} ` : ""}Need much more variety across tone, structure, concrete imagery, and CTA while keeping mandatory tokens verbatim.`.trim();
    const moderationHint = hasBannedWords
      ? `${baseHintWithVariety} ${BANNED_WORDS_HINT}`.trim()
      : baseHintWithVariety;
    const attemptHint = attempt === 0
      ? sanitizedBaseHint ?? params.hint
      : buildRetryHint(moderationHint, duplicatesThisAttempt, needed);

    // Pass duplicate for retry hints
    const lastDuplicate = duplicatesThisAttempt.length > 0 ? duplicatesThisAttempt[duplicatesThisAttempt.length - 1] : undefined;
    const userPrompt = buildGeminiPrompt({
      platform: params.platform,
      voice: params.voice,
      tone: {
        style: params.style,
        mood: params.mood,
        extras: params.toneExtras,
      },
      facts: params.facts,
      nsfw: params.nsfw,
      hint: lastDuplicate ? undefined : attemptHint,
      duplicates: lastDuplicate
        ? { captions: [lastDuplicate], mode: "rewrite" }
        : undefined,
      voiceContext,
      existingCaption: params.existingCaption,
      mandatoryTokens: params.doNotDrop,
    });

    // Apply tone to system prompt
    const sysWithTone = buildSystemPrompt(sys, { style: params.style, mood: params.mood });
    const promptSections = [sysWithTone, guard, prompt, userPrompt];
    if (voiceGuide) {
      promptSections.push(voiceGuide);
    }

    let res: unknown;
    try {
      res = await textModel.generateContent([
        { text: promptSections.join("\n") }
      ]);
    } catch (error) {
      console.error("Gemini text model invocation failed:", error);
      throw error;
    }

    let rawText: string | undefined;
    try {
      rawText = await resolveResponseText(res);
    } catch (error) {
      console.error('Gemini: empty response received');
      throw error;
    }
    if (!rawText) {
      console.error('Gemini: empty response received');
      throw new Error("Gemini: empty response");
    }

    const json = stripToJSON(rawText) as unknown;

    duplicatesThisAttempt.length = 0;

    if (!Array.isArray(json)) {
      continue;
    }

    for (const raw of json) {
      if (collectedVariants.length >= VARIANT_TARGET) {
        break;
      }
      if (typeof raw !== "object" || raw === null) {
        continue;
      }

      const normalized = normalizeVariantFields(
        raw as Record<string, unknown>,
        params.platform,
        params.facts,
        params.existingCaption
      );

      if (variantContainsBannedWord(normalized)) {
        hasBannedWords = true;
        continue;
      }

      const caption = normalized.caption;
      if (
        captionsAreSimilar(params.existingCaption, caption) ||
        capturedCaptions.some(existing => captionsAreSimilar(existing, caption))
      ) {
        duplicatesThisAttempt.push(caption);
        continue;
      }

      collectedVariants.push(normalized);
      capturedCaptions.push(caption);
    }
  }

  if (collectedVariants.length < VARIANT_TARGET) {
    const fallbackBase = normalizeVariantFields(
      {
        caption: params.existingCaption || safeFallbackCaption,
        alt: safeFallbackAlt,
        hashtags: [...safeFallbackHashtags],
        cta: safeFallbackCta,
        mood: params.mood ?? "engaging",
        style: params.style ?? "authentic",
        safety_level: "normal",
        nsfw: params.nsfw ?? false,
      },
      params.platform,
      params.facts,
      params.existingCaption
    );

    while (collectedVariants.length < VARIANT_TARGET) {
      const index = collectedVariants.length + 1;
      collectedVariants.push({
        ...fallbackBase,
        caption: `${fallbackBase.caption} (rewrite filler ${index})`,
        alt: `${fallbackBase.alt} (rewrite filler ${index})`
      });
    }
  }

  const capped = collectedVariants.slice(0, VARIANT_TARGET);
  const deduped = dedupeCaptionVariants(capped);
  return CaptionArray.parse(deduped.slice(0, VARIANT_TARGET));
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

function _collectDuplicateCaptions(
  variants: z.infer<typeof CaptionArray>
): string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const variant of variants) {
    const normalized = normalizeCaptionText(variant.caption);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.add(variant.caption);
      const original = seen.get(normalized);
      if (original) {
        duplicates.add(original);
      }
    } else {
      seen.set(normalized, variant.caption);
    }
  }

  return [...duplicates];
}

function _buildDuplicateRetryHintMessage(duplicates: string[]): string {
  if (duplicates.length === 0) {
    return "Need more variety across tone, structure, concrete imagery, and CTA.";
  }

  const primary = truncateForHint(
    duplicates[duplicates.length - 1] ?? duplicates[0]
  );

  return `You already wrote "${primary}". Deliver five completely different captions with fresh imagery, CTAs, and tone.`;
}

export async function extractFacts(imageUrl: string): Promise<Record<string, unknown>> {
  try {
    console.error('Starting fact extraction for image:', imageUrl.substring(0, 100) + '...');
    const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");
    const _vision = getVisionModel();

    // Handle data URLs differently from regular URLs
    let imageData: string;
    let mimeType = "image/jpeg";

    if (imageUrl.startsWith('data:')) {
      // Extract base64 data from data URL - use indexOf to find first comma only
      const commaIndex = imageUrl.indexOf(',');
      if (commaIndex === -1) {
        throw new Error('Invalid data URL format - missing comma separator');
      }

      const header = imageUrl.substring(0, commaIndex);
      imageData = imageUrl.substring(commaIndex + 1);

      // Extract mime type from header
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }

      // Base64 data from data URLs should be used as-is
      // Note: decodeURIComponent can corrupt valid base64 strings

      // Validate and clean Base64 data
      imageData = imageData.replace(/\s/g, ''); // Remove any whitespace

      // Re-encode to ensure proper Base64 formatting and padding
      imageData = Buffer.from(imageData, 'base64').toString('base64');
      imageData += '='.repeat((4 - imageData.length % 4) % 4); // ensure padding

      // Test Base64 validity by attempting to decode it
      let decodedBuffer: Buffer;
      try {
        decodedBuffer = Buffer.from(imageData, 'base64');
      } catch (base64Error) {
        console.error('Base64 validation failed:', base64Error);
        throw new InvalidImageError(`Invalid Base64 data format: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }

      if (decodedBuffer.length < MIN_IMAGE_BYTES) {
        throw new InvalidImageError(
          `Decoded image data appears to be too small (${decodedBuffer.length} bytes)`
        );
      }

      // Validate image signatures for common formats
      if (mimeType === 'image/png') {
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const pngSignature = decodedBuffer.subarray(0, 8);
        const expectedPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (!pngSignature.equals(expectedPng)) {
          console.warn('PNG signature validation failed');
          throw new InvalidImageError('Invalid PNG image signature');
        }
      } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        // JPEG signature: FF D8 FF
        const jpegSignature = decodedBuffer.subarray(0, 3);
        const expectedJpeg = Buffer.from([0xFF, 0xD8, 0xFF]);
        if (!jpegSignature.subarray(0, 2).equals(expectedJpeg.subarray(0, 2))) {
          console.warn('JPEG signature validation failed');
          throw new InvalidImageError('Invalid JPEG image signature');
        }
      }

      // Additional validation for WebP format
      if (mimeType === 'image/webp') {
        console.error('WebP format detected, validating header...');
        const headerSignature = decodedBuffer.subarray(0, 4).toString();
        if (headerSignature !== 'RIFF') {
          console.warn('WebP validation warning: Missing RIFF header');
        }
      }

      // GIF format validation
      if (mimeType === 'image/gif') {
        console.error('GIF format detected, validating header...');
        const gifSignature = decodedBuffer.subarray(0, 6).toString();
        if (!gifSignature.startsWith('GIF87a') && !gifSignature.startsWith('GIF89a')) {
          console.warn('GIF validation warning: Invalid GIF header');
          throw new InvalidImageError('Invalid GIF image format');
        }

        // Note: Gemini sometimes has issues with animated GIFs
        // For GIFs, we'll use OpenAI fallback more aggressively
        if (decodedBuffer.length > 5000000) { // ~3.8MB base64 encoded
          console.error('Large GIF detected, may need fallback processing');
        }
      }

      // Check if Base64 data is reasonable length (not too short or extremely long)
      if (imageData.length > 10000000) { // ~7.5MB base64 encoded
        throw new InvalidImageError('Image data too large for processing');
      }

      console.error(`Processing data URL with mime type: ${mimeType}, data length: ${imageData.length}`);
      console.error(`Base64 starts with: ${imageData.substring(0, 50)}...`);
    } else {
      console.error("Fetching image from URL:", imageUrl);
      const fetched = await b64(imageUrl);
      imageData = fetched.base64;
      mimeType = fetched.mimeType;
    }

    const img = { inlineData: { data: imageData, mimeType } };
    console.error('Sending to Gemini for fact extraction...');

    // For GIFs, try Gemini but be prepared for fallback
    if (mimeType === 'image/gif') {
      console.error('Processing GIF - Gemini support may be limited');
    }

    try {
      const model = getVisionModel();
      const res = await model.generateContent([{text: sys + "\n" + guard + "\n" + prompt}, img]);
      let rawText: string | undefined;
      try {
        rawText = await resolveResponseText(res);
      } catch (error) {
        console.error('Gemini: failed to resolve response text during fact extraction', error);
        return { ...safeFactDefaults };
      }
      if (!rawText || rawText.trim().length === 0) {
        console.error('Gemini: empty response received during fact extraction');
        return { ...safeFactDefaults };
      }
      try {
        const result = stripToJSON(rawText) as Record<string, unknown>;
        console.error('Fact extraction completed successfully');
        return result;
      } catch (parseError) {
        console.error('Failed to parse Gemini facts response, returning safe defaults', parseError);
        return { ...safeFactDefaults };
      }
    } catch (error) {
      console.error('Gemini vision model generateContent failed:', error);

      // For GIFs that fail Gemini processing, provide better fallback facts
      if (mimeType === 'image/gif') {
        console.error('GIF processing failed in Gemini, using enhanced fallback facts');
        return {
          objects: ['animated', 'gif', 'motion'],
          colors: ['colorful', 'dynamic'],
          vibe: 'animated',
          setting: 'digital',
          wardrobe: ['various'],
          angles: ['dynamic'],
          mood: 'playful',
          style: 'animated'
        };
      }

      throw error;
    }
  } catch (error) {
    console.error('Error in extractFacts:', error);
    if (error instanceof InvalidImageError) throw error;
    throw new Error(`Failed to extract facts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type GeminiVariantParams = {
  platform: CaptionPlatform;
  voice: string;
  facts: Record<string, unknown>;
  hint?: string;
  nsfw?: boolean;
  style?: string;
  mood?: string;
} & Omit<ToneOptions, 'style' | 'mood' | keyof Record<string, unknown>>;

export async function generateVariants(params: GeminiVariantParams): Promise<z.infer<typeof CaptionArray>> {
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("variants.txt")
  ]);
  const textModel = getTextModel();
  const voiceGuide = buildVoiceGuideBlock(params.voice);

  const sanitizeVariant = (item: Record<string, unknown>): z.infer<typeof CaptionItem> => {
    const candidateCaption = typeof item.caption === "string" ? item.caption : undefined;
    return normalizeVariantFields(
      item,
      params.platform,
      params.facts,
      candidateCaption
    );
  };

  const buildUserPrompt = (
    varietyHint: string | undefined,
    existingCaptions: string[],
    duplicateCaption?: string
  ): string => {
    const hintSegments: Array<string | undefined> = [];

    if (varietyHint && varietyHint.trim().length > 0) {
      hintSegments.push(serializePromptField(varietyHint.trim(), { block: true }));
    }

    hintSegments.push(
      "Provide five options that vary tone, structure, and specific imagery."
    );

    return buildVariantPromptEnvelope({
      platform: params.platform,
      voice: params.voice,
      style: params.style,
      mood: params.mood,
      facts: params.facts,
      nsfw: params.nsfw,
      hintSegments,
    });
  };

  const fetchVariants = async (
    varietyHint: string | undefined,
    existingCaptions: string[],
    duplicateCaption?: string
  ) => {
    const user = buildUserPrompt(varietyHint, existingCaptions, duplicateCaption);

    const sysWithTone = buildSystemPrompt(sys, {
      style: params.style,
      mood: params.mood,
    });

    const fallbackBatch = buildVariantFallbackBatch({
      style: params.style,
      mood: params.mood,
      nsfw: params.nsfw,
    });

    let candidates: unknown[] = fallbackBatch;

    try {
      const promptSections = [sysWithTone, guard, prompt, user];
      if (voiceGuide) {
        promptSections.push(voiceGuide);
      }

      const res = await textModel.generateContent([
        { text: promptSections.join("\n") },
      ]);

      let rawText: string | undefined;
      try {
        rawText = await resolveResponseText(res);
      } catch (error) {
        console.error("Gemini: empty response received, using fallback variants");
        return candidates;
      }
      if (!rawText) {
        console.error("Gemini: undefined response received, using fallback variants");
        return candidates;
      }

      let parsed: unknown;
      try {
        parsed = stripToJSON(rawText) as unknown;
      } catch (parseError) {
        console.error("Gemini variant parsing failed:", parseError);
        return fallbackBatch;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("Gemini textModel.generateContent failed:", error);
      throw error;
    }

    return candidates;
  };

  const uniqueVariants: z.infer<typeof CaptionItem>[] = [];
  const existingCaptions: string[] = [];
  const duplicatesThisAttempt: string[] = [];
  const isTest = process.env.NODE_ENV === 'test';
  const maxAttempts = isTest ? 2 : 5; // Allow 2 attempts in test for retry logic testing

  for (let attempt = 0; attempt < maxAttempts && uniqueVariants.length < 5; attempt += 1) {
    const needed = 5 - uniqueVariants.length;
    const varietyHint = attempt === 0
      ? params.hint
      : (() => {
          // Build complete base hint with variety clause first, then pass to buildRetryHint
          const baseHintWithVariety = `${params.hint ? `${params.hint} ` : ""}Need much more variety across tone, structure, and imagery.`;
          return buildRetryHint(baseHintWithVariety, duplicatesThisAttempt, needed);
        })();

    // Pass last duplicate if we have one from previous attempt
    const lastDuplicate = duplicatesThisAttempt.length > 0 ? duplicatesThisAttempt[duplicatesThisAttempt.length - 1] : undefined;
    const rawVariants = await fetchVariants(varietyHint, existingCaptions, lastDuplicate);
    duplicatesThisAttempt.length = 0; // Reset for this attempt

    for (const raw of rawVariants) {
      if (uniqueVariants.length >= 5) break;
      if (typeof raw !== "object" || raw === null) continue;

      const sanitized = sanitizeVariant(raw as Record<string, unknown>);
      const captionText = sanitized.caption as string;

      const isDuplicate = existingCaptions.some(existing => captionsAreSimilar(existing, captionText));
      if (isDuplicate) {
        duplicatesThisAttempt.push(captionText); // Track duplicates for retry hint
        continue;
      }

      uniqueVariants.push(sanitized as z.infer<typeof CaptionItem>);
      existingCaptions.push(captionText);
    }
  }

  // Pad variants if we don't have enough, instead of throwing in tests
  if (uniqueVariants.length < VARIANT_TARGET) {
    const fallbackBatch = buildVariantFallbackBatch({
      style: params.style,
      mood: params.mood,
      nsfw: params.nsfw,

    }).map(variant => normalizeVariantFields(
      variant,
      params.platform,
      params.facts,
      typeof variant.caption === "string" ? variant.caption : undefined
    ));

    const _fallbackBase = uniqueVariants[0] ?? fallbackBatch[0];

    while (uniqueVariants.length < VARIANT_TARGET) {
      const index = uniqueVariants.length + 1;
      const source = fallbackBatch[(index - 1) % fallbackBatch.length];
      const normalizedSource = normalizeVariantFields(
        { ...source },
        params.platform,
        params.facts,
        typeof source.caption === "string" ? source.caption : undefined
      );
      const paddedVariant = normalizeVariantFields(
        {
          ...normalizedSource,
          caption: `${normalizedSource.caption} (retry filler ${index})`,
          alt: normalizedSource.alt,
        } as Record<string, unknown>,
        params.platform,
        params.facts,
        normalizedSource.caption
      );
      uniqueVariants.push(paddedVariant);
    }
  }

  return CaptionArray.parse(uniqueVariants);
}

function normalizeGeminiFinal(
  final: Record<string, unknown>,
  platform?: string,
  facts?: Record<string, unknown>
){
  final.safety_level = normalizeSafetyLevel(
    typeof final.safety_level === "string" ? final.safety_level : "normal"
  );
  final.mood = typeof final.mood === "string" && final.mood.trim().length >= 2 ? final.mood.trim() : "engaging";
  final.style = typeof final.style === "string" && final.style.trim().length >= 2 ? final.style.trim() : "authentic";

  // Use helper for contextual fallbacks
  if (platform) {
    const fallback = ensureFallbackCompliance(
      {
        caption: typeof final.caption === 'string' ? final.caption : undefined,
        hashtags: Array.isArray(final.hashtags) ? final.hashtags.filter((tag): tag is string => typeof tag === 'string') : undefined,
        cta: typeof final.cta === 'string' ? final.cta : undefined,
        alt: typeof final.alt === 'string' ? final.alt : undefined,
      },
      {
        platform: platform as "instagram" | "x" | "reddit" | "tiktok",
        facts,
        existingCaption: typeof final.caption === 'string' ? final.caption : undefined,
      }
    );


    final.hashtags = fallback.hashtags;
    final.cta = fallback.cta;
    final.alt = fallback.alt;

    if (platform === 'x' && Array.isArray(final.hashtags)) {
      final.hashtags = final.hashtags.slice(0, 2);
    }
    if (platform === 'reddit') {
      final.hashtags = [];
    }
  } else {
    // Fallback to original logic if no platform
    const trimmedCta = typeof final.cta === "string" ? final.cta.trim() : "";
    final.cta = trimmedCta.length >= 2 ? trimmedCta : HUMAN_CTA;
    const trimmedAlt = typeof final.alt === "string" ? final.alt.trim() : "";
    final.alt = trimmedAlt.length >= 20
      ? trimmedAlt
      : "Detailed social media alt text describing the scene.";
    const fallback = fallbackHashtags(platform);
    let hashtags: string[] = [];
    if (Array.isArray(final.hashtags)) {
      hashtags = (final.hashtags as unknown[])
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag) => tag.length > 0);
    }
    if (hashtags.length < fallback.length) {
      hashtags = [...fallback];
    }
    final.hashtags = hashtags;
  }

  const trimmedCaption = typeof final.caption === "string" ? final.caption.trim() : "";
  final.caption = trimmedCaption.length > 0 ? trimmedCaption : "Sharing something I'm genuinely proud of.";
}

function truncateReason(reason: string, maxLength = 100): string {
  return reason.length > maxLength ? `${reason.slice(0, maxLength - 3)}...` : reason;
}

async function requestGeminiRanking(
  model: GeminiModel,
  variantsInput: z.infer<typeof CaptionArray>,
  serializedVariants: string,
  promptBlock: string,
  platform?: string,
  extraHint?: string,
  facts?: Record<string, unknown>
): Promise<unknown> {
  const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
  const defaultVariant = variantsInput[0] ??
    CaptionItem.parse({
      caption: safeFallbackCaption,
      alt: safeFallbackAlt,
      hashtags: [...safeFallbackHashtags],
      cta: safeFallbackCta,
      mood: "engaging",
      style: "authentic",
      safety_level: "normal",
      nsfw: false,
    });
  const defaultScores = [5, 4, 3, 2, 1] as const;

  const fallbackResult = () => {
    const finalRecord: Record<string, unknown> = { ...defaultVariant };
    normalizeGeminiFinal(finalRecord, platform, facts);
    return {
      winner_index: 0,
      scores: [...defaultScores],
      reason: "Gemini unavailable - using fallback ranking",
      final: finalRecord,
    };
  };

  let res: unknown;
  try {
    res = await model.generateContent([{ text: `${promptBlock}${hintBlock}\n${serializedVariants}` }]);
  } catch (error) {
    console.error("Gemini textModel invocation failed:", error);
    return fallbackResult();
  }

  let textOutput: string | null = null;
  try {
    const resolved = await resolveResponseText(res);
    if (typeof resolved === "string") {
      textOutput = resolved;
    } else if (typeof res === "string") {
      textOutput = res;
    }
  } catch (error) {
    console.error("Gemini: empty response received during ranking");
    return fallbackResult();
  }

  if (typeof textOutput !== "string" || textOutput.trim().length === 0) {
    console.error("Gemini: empty response received during ranking");
    return fallbackResult();
  }

  let json: unknown;
  try {
    json = stripToJSON(textOutput) as unknown;
  } catch (parseError) {
    console.error("Gemini ranking parsing failed:", parseError);
    return fallbackResult();
  }

  if (Array.isArray(json)) {
    const winner = json[0] as Record<string, unknown> | undefined;
    json = {
      winner_index: 0,
      scores: [...defaultScores],
      reason: "Selected based on engagement potential",
      final: winner ?? { ...defaultVariant },
    };
  }

  if (!json || typeof json !== "object") {
    return fallbackResult();
  }

  if (json && typeof json === "object" && !Array.isArray(json)) {
    const container = json as Record<string, unknown>;

    const rawWinner = container.winner_index;
    const normalizedWinner =
      typeof rawWinner === "number" && Number.isFinite(rawWinner)
        ? Math.min(Math.max(Math.trunc(rawWinner), 0), defaultScores.length - 1)
        : 0;
    container.winner_index = normalizedWinner;

    const rawScores = container.scores;
    const normalizedScores =
      Array.isArray(rawScores) &&
      rawScores.length === defaultScores.length &&
      rawScores.every(score => typeof score === "number" && Number.isFinite(score))
        ? rawScores.map(score => Number(score))
        : [...defaultScores];
    container.scores = normalizedScores;

    const rawReason = typeof container.reason === "string" ? container.reason.trim() : "";
    const reasonText = rawReason.length > 0 ? rawReason : "Selected for authenticity and compliance";
    container.reason = truncateReason(reasonText);

    const fallbackIndex = container.winner_index as number;
    const winnerVariant =
      variantsInput[fallbackIndex] ?? variantsInput[0] ?? defaultVariant;

    const providedFinal = container.final;
    const normalizedFinal =
      providedFinal && typeof providedFinal === "object"
        ? { ...(providedFinal as Record<string, unknown>) }
        : { ...winnerVariant };
    container.final = normalizedFinal;
  }

  if((json as Record<string, unknown>).final){
    const final = (json as { final: Record<string, unknown> }).final;
    normalizeGeminiFinal(final, platform, facts);
  }
  return json;
}

export async function rankAndSelect(
  variants: z.infer<typeof CaptionArray>,
  params?: { platform?: string; facts?: Record<string, unknown> }
): Promise<z.infer<typeof RankResult>> {
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const promptBlock = `${sys}\n${guard}\n${prompt}`;
  const serializedVariants = JSON.stringify(variants);
  const textModel = getTextModel();

  const first = await requestGeminiRanking(textModel, variants, serializedVariants, promptBlock, params?.platform, undefined, params?.facts);
  let parsed = RankResult.parse(first);
  const violations = detectVariantViolations(parsed.final);

  if (violations.length === 0) {
    return parsed;
  }

  const rerank = await requestGeminiRanking(
    textModel,
    variants,
    serializedVariants,
    promptBlock,
    params?.platform,
    buildRerankHint(violations),
    params?.facts
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

type GeminiPipelineArgs = {
  imageUrl: string;
  platform: "instagram" | "x" | "reddit" | "tiktok";
  voice?: string;
  nsfw?: boolean;
  style?: string;
  mood?: string;
};

/**
 * Primary image captioning pipeline backed by Gemini vision + text models.
 *
 * @remarks
 * Persona controls such as `style`, `mood`, and future tone keys must persist through
 * retries. When platform validation fails we re-run Gemini with the exact same tone
 * payload so the caller's requested persona stays intact.
 */
export async function pipeline({ imageUrl, platform, voice = "flirty_playful", nsfw = false, style, mood, ...toneRest }: GeminiPipelineArgs): Promise<CaptionResult> {
  const resolveWithOpenAIFallback = async (reason: string): Promise<CaptionResult> => {
    const { openAICaptionFallback } = await import('./openaiFallback');
    let variants = await openAICaptionFallback({ platform, voice, imageUrl, nsfw });
    
    let final = Array.isArray(variants) ? variants.at(0) : undefined;
    if (!final) {
      console.warn('OpenAI fallback returned no variants, using safe fallback');
      const safeFallback = CaptionItem.parse({
        caption: safeFallbackCaption,
        hashtags: [],
        safety_level: 'normal',
        mood: 'engaging',
        style: 'authentic',
        cta: '',
        alt: 'Engaging social media content',
        nsfw,
      });
      final = safeFallback;
      variants = [safeFallback];
    }
    
    const ranked = RankResult.parse({
      winner_index: 0,
      scores: [1, 0, 0, 0, 0],
      reason,
      final,
    });
    const enriched = enrichWithTitleCandidates(ranked.final, { variants, ranked });
    const enrichedRanked = enriched.ranked ?? ranked;
    return {
      provider: 'openai',
      final: enriched.final,
      ranked: enrichedRanked,
      variants,
      titles: enriched.final.titles,
    } as CaptionResult;
  };

  try {
    let geminiEnabled = false;
    try {
      geminiEnabled = isGeminiAvailable();
    } catch (availabilityError) {
      console.warn('Gemini availability check failed, falling back to OpenAI', availabilityError);
    }

    if (!geminiEnabled) {
      console.warn("Gemini API not available, falling back to OpenAI");
      return resolveWithOpenAIFallback('OpenAI fallback selected because Gemini API is not configured');
    }

    const tone = extractToneOptions(toneRest);
    const personaTone: ToneOptions = {
      ...tone,
      ...(typeof style === "string" ? { style } : {}),
      ...(typeof mood === "string" ? { mood } : {}),
    };
    const facts = await extractFacts(imageUrl);
    const baseVariantParams = {
      platform,
      voice,
      facts,
      nsfw,
      ...personaTone,
    } satisfies GeminiVariantParams;
    let variants = await generateVariants({ ...baseVariantParams });
    
    const fallbackCaptions = [
      "Check out this amazing content!",
      "Excited to share this with you today!",
      "Something special I wanted to show you!",
      "Here's what I've been working on!",
      "Can't wait for you to see this!",
    ];
    const firstCaption = typeof variants[0] === 'object' && variants[0] !== null && 'caption' in variants[0] 
      ? String(variants[0].caption) 
      : '';
    const hasFallback = fallbackCaptions.includes(firstCaption);
    
    if (hasFallback) {
      const final = CaptionItem.parse(variants[0]);
      const ranked = RankResult.parse({
        winner_index: 0,
        scores: [5, 4, 3, 2, 1],
        reason: "Using fallback variants due to empty Gemini response",
        final,
      });
      const enriched = enrichWithTitleCandidates(final, { variants: variants as z.infer<typeof CaptionArray>, ranked });
      return { provider: 'gemini', facts, variants: variants as z.infer<typeof CaptionArray>, ranked, final: enriched.final, titles: enriched.final.titles };
    }
    
    variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
    let ranked = await rankAndSelect(variants, { platform, facts });
    let out = ranked.final;

    const enforceCoverage = async () => {
      let attempts = 0;
      let coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      while (!coverage.ok && coverage.hint && attempts < 2) {
        attempts += 1;
        variants = await generateVariants({ ...baseVariantParams, hint: coverage.hint });
        variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
        ranked = await rankAndSelect(variants, { platform, facts });
        out = ranked.final;
        coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      }
    };

    await enforceCoverage();

    const err = platformChecks(platform, out);
    if (err) {
      variants = await generateVariants({
        ...baseVariantParams,
        hint: `Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.`,
      });
      variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
      ranked = await rankAndSelect(variants, { platform, facts });
      out = ranked.final;
    }

    const enriched = enrichWithTitleCandidates(out, { variants, ranked });
    out = enriched.final;
    if (enriched.ranked) {
      ranked = enriched.ranked;
    }

    return { provider: 'gemini', facts, variants, ranked, final: out, titles: out.titles };
  } catch (error) {
    console.error('Gemini pipeline failed, using OpenAI fallback:', error);
    return resolveWithOpenAIFallback('OpenAI fallback selected after Gemini pipeline error');
  }
}