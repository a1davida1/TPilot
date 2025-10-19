import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";

import { logger } from "../bootstrap/logger.js";
import {
  generateVision,
  generateText,
  isOpenRouterEnabled,
  GROK_4_FAST,
} from "../lib/openrouter-client.js";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema.js";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel.js";
import { BANNED_WORDS_HINT, variantContainsBannedWord } from "./bannedWords.js";
import { extractToneOptions } from "./toneOptions.js";
import { buildVoiceGuideBlock } from "./stylePack.js";
import { serializePromptField } from "./promptUtils.js";
import { formatVoiceContext } from "./voiceTraits.js";
import { ensureFactCoverage } from "./ensureFactCoverage.js";
import {
  ensureFallbackCompliance,
  inferFallbackFromFacts,
} from "./inferFallbackFromFacts.js";
import { dedupeVariantsForRanking } from "./dedupeVariants.js";
import {
  HUMAN_CTA,
  buildRerankHint,
  detectVariantViolations,
  fallbackHashtags,
  formatViolationSummary,
  sanitizeFinalVariant,
} from "./rankGuards.js";
import type { Violation } from "./rankGuards.js";

const VARIANT_TARGET = 5;
const VARIANT_RETRY_LIMIT = 4;

const FALLBACK_CAPTIONS = [
  "Check out this amazing content!",
  "Excited to share this with you today!",
  "Something special I wanted to show you!",
  "Here's what I've been working on!",
  "Can't wait for you to see this!",
];

const SAFE_FALLBACK_ALT = "Engaging alt text describing the visual story.";

const TITLE_MAX_WORDS = 9;
const TITLE_MAX_LENGTH = 64;
const TITLE_MIN_LENGTH = 4;
const LOWERCASE_TITLE_WORDS = new Set([
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
  "by",
]);

const FACT_DEFAULTS: Record<string, unknown> = {
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

const promptCache = new Map<string, string>();

export class OpenRouterError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OpenRouterError";
  }
}

interface CaptionResult {
  provider: string;
  final: z.infer<typeof CaptionItem>;
  facts: Record<string, unknown>;
  variants: z.infer<typeof CaptionArray>;
  ranked: z.infer<typeof RankResult>;
  titles?: string[];
  topVariants?: z.infer<typeof CaptionItem>[];  // Top 2 for user selection
}

type CaptionPlatform = "instagram" | "x" | "reddit" | "tiktok";

interface VariantParams {
  platform: CaptionPlatform;
  voice: string;
  facts: Record<string, unknown>;
  nsfw: boolean;
  style?: string;
  mood?: string;
  toneExtras?: Record<string, string>;
  hint?: string;
  existingCaption?: string;
  mandatoryTokens?: string[];
}

interface RankingParams {
  platform?: CaptionPlatform;
  facts?: Record<string, unknown>;
}

async function loadPrompt(name: string): Promise<string> {
  const cached = promptCache.get(name);
  if (cached) {
    return cached;
  }
  const promptPath = path.join(process.cwd(), "prompts", name);
  const contents = await fs.readFile(promptPath, "utf8");
  promptCache.set(name, contents);
  return contents;
}

function stripToJSON(text: string): unknown {
  const startIndexes = [text.indexOf("{"), text.indexOf("[")].filter(index => index >= 0);
  const start = Math.min(...startIndexes);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (!Number.isFinite(start) || start === Infinity || end < start) {
    throw new OpenRouterError("Invalid JSON response: no JSON payload found");
  }
  const snippet = text.slice(start, end + 1);
  try {
    return JSON.parse(snippet);
  } catch (error) {
    throw new OpenRouterError("Invalid JSON response: failed to parse", error);
  }
}

function toTitleCase(input: string): string {
  return input
    .split(" ")
    .map((word, index) => {
      const trimmed = word.trim();
      if (!trimmed) {
        return trimmed;
      }
      const lower = trimmed.toLowerCase();
      if (index > 0 && LOWERCASE_TITLE_WORDS.has(lower)) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function normalizeTitleSource(text: string | undefined): string | null {
  if (!text) {
    return null;
  }
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/#[^\s]+/g, "")
    .replace(/@[^\s]+/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return null;
  }
  const sentences = cleaned
    .split(/(?:[.!?]+|\n+)/g)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const base = sentences[0] ?? cleaned;
  const words = base.split(" ").filter(Boolean).slice(0, TITLE_MAX_WORDS);
  const joined = words.join(" ").replace(/[,:;.!?]+$/g, "").trim();
  if (!joined || joined.length < TITLE_MIN_LENGTH) {
    return null;
  }
  const normalized = joined.length > TITLE_MAX_LENGTH ? joined.slice(0, TITLE_MAX_LENGTH).trim() : joined;
  return normalized.length >= TITLE_MIN_LENGTH ? toTitleCase(normalized) : null;
}

function generateTitleCandidates(params: {
  final?: z.infer<typeof CaptionItem>;
  ranked?: z.infer<typeof RankResult>;
  variants?: z.infer<typeof CaptionArray>;
}): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();
  const register = (caption?: string) => {
    const candidate = normalizeTitleSource(caption);
    if (!candidate) {
      return;
    }
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    titles.push(candidate);
  };

  register(params.final?.caption);
  if (params.ranked?.final && params.ranked.final !== params.final) {
    register(params.ranked.final.caption);
  }
  if (params.variants && params.variants.length > 0) {
    for (const variant of params.variants.slice(0, 3)) {
      register(variant.caption);
    }
  }
  if (titles.length === 0 && params.final?.caption) {
    const fallback = normalizeTitleSource(params.final.caption);
    if (fallback) {
      titles.push(fallback);
    }
  }
  return titles;
}

function enrichWithTitleCandidates(
  final: z.infer<typeof CaptionItem>,
  context: { variants?: z.infer<typeof CaptionArray>; ranked?: z.infer<typeof RankResult> },
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

function truncateForHint(caption: string): string {
  const normalized = caption.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
}

function buildRetryHint(baseHint: string | undefined, duplicates: string[], needed: number): string {
  const parts: string[] = [];
  if (baseHint && baseHint.trim().length > 0) {
    parts.push(baseHint.trim());
  }
  if (duplicates.length > 0) {
    const last = duplicates[duplicates.length - 1];
    parts.push(`You already wrote "${truncateForHint(last)}". Deliver a fresh angle and add ${needed} more unique caption${needed > 1 ? "s" : ""}.`);
  } else {
    parts.push(`Need ${needed} more unique caption${needed > 1 ? "s" : ""}. Explore different concrete imagery, explicit NSFW detail, and CTA variety while staying subreddit-compliant.`);
  }
  return parts.join(" ").trim();
}

function sanitizeToneExtras(extras: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!extras) {
    return undefined;
  }
  const entries = Object.entries(extras)
    .map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : ""] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

interface DuplicatePromptConfig {
  captions: string[];
  mode?: "avoid" | "rewrite";
}

interface BuildPromptParams {
  platform: CaptionPlatform;
  voice: string;
  style?: string;
  mood?: string;
  toneExtras?: Record<string, string>;
  facts?: Record<string, unknown>;
  nsfw?: boolean;
  hint?: string;
  duplicates?: DuplicatePromptConfig;
  voiceContext?: string;
  existingCaption?: string;
  mandatoryTokens?: string[];
}

function formatDuplicateHint(duplicates: DuplicatePromptConfig | undefined): string | undefined {
  if (!duplicates) {
    return undefined;
  }
  const sanitized = duplicates.captions
    .map(caption => caption.trim())
    .filter(caption => caption.length > 0);
  if (sanitized.length === 0) {
    return undefined;
  }
  if (duplicates.mode === "rewrite") {
    const latest = sanitized[sanitized.length - 1];
    return `You already wrote "${truncateForHint(latest)}". Provide a completely different approach.`;
  }
  return `Avoid repeating or lightly editing these captions: ${sanitized.join(" | ")}.`;
}

function buildVariantPrompt(params: BuildPromptParams): string {
  const toneLines: string[] = [];
  if (params.style && params.style.trim().length > 0) {
    toneLines.push(`STYLE: ${params.style.trim()}`);
  }
  if (params.mood && params.mood.trim().length > 0) {
    toneLines.push(`MOOD: ${params.mood.trim()}`);
  }
  if (params.toneExtras) {
    for (const [key, value] of Object.entries(params.toneExtras)) {
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
  const combinedHint = hintSegments
    .filter((segment): segment is string => Boolean(segment && segment.trim().length > 0))
    .join(" ");
  const hintLine = combinedHint.length > 0 ? `HINT:${serializePromptField(combinedHint, { block: true })}` : undefined;

  const lines: Array<string | undefined> = [
    `PLATFORM: ${params.platform}`,
    `VOICE: ${params.voice}`,
    params.voiceContext && params.voiceContext.trim().length > 0 ? params.voiceContext.trim() : undefined,
    ...toneLines,
    params.existingCaption ? `EXISTING_CAPTION: ${serializePromptField(params.existingCaption, { block: true })}` : undefined,
    params.facts ? `IMAGE_FACTS: ${JSON.stringify(params.facts)}` : undefined,
    `NSFW: ${params.nsfw ?? false}`,
    params.nsfw ? "CRITICAL: Write AS the woman in the image using I/me/my - first person only!" : undefined,
    params.mandatoryTokens && params.mandatoryTokens.length > 0
      ? `MANDATORY TOKENS: ${params.mandatoryTokens.join(" | ")}`
      : undefined,
    hintLine,
  ];

  return lines
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n");
}

function normalizeVariantFields(
  variant: Record<string, unknown>,
  platform: CaptionPlatform,
  facts?: Record<string, unknown>,
  existingCaption?: string,
): z.infer<typeof CaptionItem> {
  const next: Record<string, unknown> = { ...variant };
  next.safety_level = normalizeSafetyLevel(typeof next.safety_level === "string" ? next.safety_level : "normal");
  next.mood = typeof next.mood === "string" && next.mood.trim().length >= 2 ? next.mood.trim() : "engaging";
  next.style = typeof next.style === "string" && next.style.trim().length >= 2 ? next.style.trim() : "authentic";

  const fallback = ensureFallbackCompliance(
    {
      caption: typeof next.caption === "string" ? next.caption : undefined,
      hashtags: Array.isArray(next.hashtags) ? next.hashtags.filter((tag): tag is string => typeof tag === "string") : undefined,
      cta: typeof next.cta === "string" ? next.cta : undefined,
      alt: typeof next.alt === "string" ? next.alt : undefined,
    },
    {
      platform,
      facts,
      existingCaption: existingCaption || (typeof next.caption === "string" ? next.caption : undefined),
    },
  );

  next.hashtags = fallback.hashtags;
  next.cta = fallback.cta;
  next.alt = fallback.alt;
  next.caption = typeof next.caption === "string" && next.caption.trim().length > 0
    ? next.caption.trim()
    : existingCaption || "Here's something I'm proud of today.";
  next.nsfw = typeof next.nsfw === "boolean" ? next.nsfw : false;

  if (platform === "x" && Array.isArray(next.hashtags)) {
    next.hashtags = next.hashtags.slice(0, 2);
  }
  if (platform === "reddit") {
    next.hashtags = [];
  }

  return CaptionItem.parse(next);
}

function buildFallbackBatch(params: { platform: CaptionPlatform; facts?: Record<string, unknown>; nsfw?: boolean }): z.infer<typeof CaptionArray> {
  const inferred = inferFallbackFromFacts({ platform: params.platform, facts: params.facts });
  const variants = Array.from({ length: VARIANT_TARGET }, (_, index) => CaptionItem.parse({
    caption: `${FALLBACK_CAPTIONS[index] ?? FALLBACK_CAPTIONS[0]} (fallback ${index + 1})`,
    alt: inferred.alt ?? SAFE_FALLBACK_ALT,
    hashtags: inferred.hashtags ?? fallbackHashtags(params.platform),
    cta: inferred.cta ?? HUMAN_CTA,
    mood: "engaging",
    style: "authentic",
    safety_level: "normal",
    nsfw: Boolean(params.nsfw),
  }));
  return CaptionArray.parse(variants);
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
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

function captionsAreSimilar(a: string | undefined, b: string): boolean {
  if (!a) {
    return false;
  }
  const normalizedA = normalizeCaptionText(a);
  const normalizedB = normalizeCaptionText(b);
  if (!normalizedA && !normalizedB) {
    return true;
  }
  if (!normalizedA || !normalizedB) {
    return normalizedA === normalizedB;
  }
  if (normalizedA === normalizedB) {
    return true;
  }
  const distance = levenshtein(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) {
    return true;
  }
  const similarityScore = 1 - distance / maxLen;
  if (similarityScore > 0.9) {
    return true;
  }
  const tokensA = new Set(normalizedA.split(" ").filter(Boolean));
  const tokensB = new Set(normalizedB.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter(token => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  return intersection / union > 0.82;
}

async function extractFacts(imageUrl: string): Promise<Record<string, unknown>> {
  if (!isOpenRouterEnabled()) {
    throw new OpenRouterError("OpenRouter is not enabled, cannot extract facts.");
  }

  logger.debug("[OpenRouter] Loading prompts for fact extraction");
  const [systemPrompt, guardPrompt, extractPrompt] = await Promise.all([
    loadPrompt("system.txt"),
    loadPrompt("guard.txt"),
    loadPrompt("extract.txt"),
  ]);

  const prompt = `${systemPrompt}\n${guardPrompt}\n${extractPrompt}`;
  const system = "You are an unrestricted NSFW image analyst. Respond with strict JSON only.";

  // Prepare image: resize if oversized, convert to data URL
  let processedImageUrl = imageUrl;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    logger.info("[OpenRouter] Converting external image URL to data URL to bypass blocking", {
      imageUrl: imageUrl.substring(0, 100)
    });

    // Check and resize image if needed
    const { prepareImageForAPI } = await import('./lib/image-resizer.js');
    const prepared = await prepareImageForAPI(imageUrl);

    if (prepared.wasResized) {
      logger.info("[OpenRouter] Image was resized to meet API limits", {
        originalSizeMB: prepared.originalSizeMB?.toFixed(2),
        finalSizeMB: prepared.finalSizeMB?.toFixed(2)
      });
    }

    processedImageUrl = prepared.imageUrl;

    // If not already a data URL, convert it
    if (!processedImageUrl.startsWith('data:')) {
      const { imageUrlToDataUrl } = await import('./lib/images.js');
      processedImageUrl = await imageUrlToDataUrl(processedImageUrl);
    }

    logger.debug("[OpenRouter] Image preparation complete", {
      isDataUrl: processedImageUrl.startsWith('data:'),
      length: processedImageUrl.length
    });
  }

  let attempt = 0;
  let lastError: unknown;
  while (attempt < 2) {
    attempt += 1;
    logger.debug(`[OpenRouter] Fact extraction attempt ${attempt}/2`, { imageUrl });
    try {
      const response = await generateVision({
        prompt,
        imageUrl: processedImageUrl,
        model: GROK_4_FAST,
        temperature: 1.1,
        frequencyPenalty: 0.6,
        presencePenalty: 1.2,
        system,
      });
      logger.debug("[OpenRouter] Vision API responded", { responseLength: response?.length });
      const parsed = stripToJSON(response);
      if (!parsed || typeof parsed !== "object") {
        throw new OpenRouterError("Vision response did not contain a JSON object");
      }
      const facts = { ...FACT_DEFAULTS, ...(parsed as Record<string, unknown>) };
      logger.info("[OpenRouter] Fact extraction successful", { attempt });
      return facts;
    } catch (error) {
      lastError = error;

      // Check for 413 Payload Too Large error
      const errorObj = error as any;
      const is413Error = errorObj?.status === 413 || errorObj?.code === 413 ||
                        (errorObj?.message && /payload.*large|413|length.*exceed/i.test(errorObj.message));

      if (is413Error) {
        logger.error("[OpenRouter] Image too large for API (413 error)", {
          attempt,
          imageUrl: imageUrl.substring(0, 100),
          errorStatus: errorObj?.status,
          errorCode: errorObj?.code,
          errorMessage: errorObj?.message
        });
        // Don't retry on 413 - throw immediately with specific error
        throw new OpenRouterError("Image is too large for processing. Please use a smaller image or reduce the image quality.", error);
      }

      logger.warn("[OpenRouter] Fact extraction attempt failed", {
        attempt,
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  logger.error("[OpenRouter] Failed to extract facts after all retries", {
    imageUrl,
    attempts: 2,
    lastError: lastError instanceof Error ? lastError.message : String(lastError)
  });
  throw new OpenRouterError("Failed to extract facts from image after retries", lastError);
}

async function requestVariantsOnce(params: VariantParams & {
  promptBlocks: string[];
  voiceContext?: string;
  hint?: string;
  duplicates?: DuplicatePromptConfig;
}): Promise<unknown> {
  const userPrompt = buildVariantPrompt({
    platform: params.platform,
    voice: params.voice,
    style: params.style,
    mood: params.mood,
    toneExtras: params.toneExtras,
    facts: params.facts,
    nsfw: params.nsfw,
    hint: params.hint,
    duplicates: params.duplicates,
    voiceContext: params.voiceContext,
    existingCaption: params.existingCaption,
    mandatoryTokens: params.mandatoryTokens,
  });

  const payload = [...params.promptBlocks, userPrompt].join("\n");

  const system = "You are a fearless NSFW social caption writer. Return STRICT JSON arrays only.";
  const response = await generateText({
    prompt: payload,
    model: GROK_4_FAST,
    temperature: 1.25,
    system,
  });
  return stripToJSON(response);
}

async function generateVariants(params: VariantParams): Promise<z.infer<typeof CaptionArray>> {
  if (!isOpenRouterEnabled()) {
    throw new OpenRouterError("OpenRouter is not enabled, cannot generate variants.");
  }

  const toneOptions = extractToneOptions({ style: params.style, mood: params.mood });
  const toneLines = [];
  const style = toneOptions.style || params.style;
  const mood = toneOptions.mood || params.mood;
  if (style && style.trim().length > 0) {
    toneLines.push(`STYLE: ${style.trim()}`);
  }
  if (mood && mood.trim().length > 0) {
    toneLines.push(`MOOD: ${mood.trim()}`);
  }
  const toneExtras = toneOptions.toneExtras || {};
  for (const [key, value] of Object.entries(toneExtras)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      toneLines.push(`${key.toUpperCase()}: ${value.trim()}`);
    }
  }
  
  // Use NSFW-specific prompts when appropriate
  const baseSystemPrompt = params.nsfw 
    ? await loadPrompt("nsfw-system.txt")
    : await loadPrompt("system.txt");
  
  const systemWithTone = toneLines.length > 0 ? `${baseSystemPrompt}\n${toneLines.join("\n")}` : baseSystemPrompt;
  const voiceContext = formatVoiceContext(params.voice);
  const voiceGuide = buildVoiceGuideBlock(params.voice);

  // Load the appropriate variants prompt based on NSFW status
  const variantsPrompt = params.nsfw
    ? await loadPrompt("nsfw-variants.txt") 
    : await loadPrompt("variants.txt");
  
  const promptBlocks = [systemWithTone, await loadPrompt("guard.txt"), variantsPrompt];
  if (voiceGuide) {
    promptBlocks.push(voiceGuide);
  }

  const collected: z.infer<typeof CaptionItem>[] = [];
  const capturedCaptions: string[] = [];
  const duplicatesForHint: string[] = [];
  let hasBannedWords = false;

  for (let attempt = 0; attempt < VARIANT_RETRY_LIMIT && collected.length < VARIANT_TARGET; attempt += 1) {
    const needed = VARIANT_TARGET - collected.length;
    const initialHint = params.hint ? sanitizeHintForRetry(params.hint) : undefined;
    const baseHint = hasBannedWords
      ? `${initialHint ?? ""} ${BANNED_WORDS_HINT}`.trim()
      : initialHint;
    const retryHint = attempt === 0
      ? baseHint
      : buildRetryHint(baseHint, duplicatesForHint, needed);

    let raw: unknown;
    try {
      raw = await requestVariantsOnce({
        ...params,
        style,
        mood,
        toneExtras,
        promptBlocks,
        voiceContext,
        hint: retryHint,
        duplicates: duplicatesForHint.length > 0
          ? { captions: [duplicatesForHint[duplicatesForHint.length - 1]], mode: "rewrite" }
          : undefined,
      });
    } catch (error) {
      logger.warn("[OpenRouter] Variant request failed", { attempt: attempt + 1, error });
      continue;
    }

    if (!Array.isArray(raw)) {
      logger.warn("[OpenRouter] Variant response was not an array", { attempt: attempt + 1 });
      continue;
    }

    for (const entry of raw) {
      if (collected.length >= VARIANT_TARGET) {
        break;
      }
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const normalized = normalizeVariantFields(entry as Record<string, unknown>, params.platform, params.facts, params.existingCaption);
      if (variantContainsBannedWord(normalized)) {
        hasBannedWords = true;
        continue;
      }
      if (
        captionsAreSimilar(params.existingCaption, normalized.caption) ||
        capturedCaptions.some(existing => captionsAreSimilar(existing, normalized.caption))
      ) {
        duplicatesForHint.push(normalized.caption);
        continue;
      }
      collected.push(normalized);
      capturedCaptions.push(normalized.caption);
    }
  }

  if (collected.length < VARIANT_TARGET) {
    logger.warn("[OpenRouter] Insufficient unique variants, padding with fallbacks");
    const fallbackBatch = buildFallbackBatch({ platform: params.platform, facts: params.facts, nsfw: params.nsfw });
    while (collected.length < VARIANT_TARGET) {
      collected.push(fallbackBatch[collected.length % fallbackBatch.length]);
    }
  }

  const deduped = dedupeVariantsForRanking(collected, VARIANT_TARGET, { platform: params.platform, facts: params.facts });
  return CaptionArray.parse(deduped.slice(0, VARIANT_TARGET));
}

async function rankAndSelect(
  variants: z.infer<typeof CaptionArray>,
  params?: RankingParams,
): Promise<z.infer<typeof RankResult>> {
  const [systemPrompt, guardPrompt, rankPrompt] = await Promise.all([
    loadPrompt("system.txt"),
    loadPrompt("guard.txt"),
    loadPrompt("rank.txt"),
  ]);

  const promptBlock = `${systemPrompt}\n${guardPrompt}\n${rankPrompt}`;
  const serializedVariants = JSON.stringify(variants);

  const requestRanking = async (extraHint?: string): Promise<unknown> => {
    const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
    const payload = `${promptBlock}${hintBlock}\n${serializedVariants}`;
    const system = "You are an unapologetic NSFW strategist. Return STRICT JSON objects only.";
    const response = await generateText({
      prompt: payload,
      model: GROK_4_FAST,
      system,
      temperature: 0.9,
    });
    return stripToJSON(response);
  };

  let result: z.infer<typeof RankResult> | undefined;
  let violations: Violation[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const hint = attempt === 0 ? undefined : buildRerankHint(violations);
    const raw = await requestRanking(hint);
    const parsed = RankResult.safeParse(raw);
    if (!parsed.success) {
      logger.warn("[OpenRouter] Ranking parse failed", { attempt: attempt + 1, error: parsed.error });
      continue;
    }
    result = parsed.data;
    violations = detectVariantViolations(result.final);
    if (violations.length === 0) {
      break;
    }
  }

  if (!result) {
    throw new OpenRouterError("Failed to rank variants");
  }

  if (violations.length > 0) {
    const sanitizedFinal = sanitizeFinalVariant(result.final, params?.platform);
    const summary = formatViolationSummary(violations) || result.reason;
    result = RankResult.parse({
      ...result,
      final: sanitizedFinal,
      reason: summary,
    });
  }

  const finalRecord = { ...result.final } as Record<string, unknown>;
  if (params?.platform) {
    finalRecord.safety_level = normalizeSafetyLevel(
      typeof finalRecord.safety_level === "string" ? finalRecord.safety_level : "normal",
    );
  }
  return RankResult.parse({ ...result, final: finalRecord });
}

export async function pipeline(params: {
  imageUrl: string;
  platform: CaptionPlatform;
  voice?: string;
  nsfw?: boolean;
  style?: string;
  mood?: string;
  toneExtras?: Record<string, string>;
  mandatoryTokens?: string[];
}): Promise<CaptionResult> {
  logger.info("[OpenRouter] Starting pipeline", { 
    platform: params.platform, 
    voice: params.voice,
    imageUrl: params.imageUrl?.substring(0, 100) + '...',
    nsfw: params.nsfw,
    style: params.style,
    mood: params.mood
  });

  if (!params.voice || params.voice.trim().length === 0) {
    throw new OpenRouterError("Voice is required for OpenRouter pipeline");
  }

  const voice = params.voice.trim();
  const nsfw = Boolean(params.nsfw);

  const baseTone = extractToneOptions({ style: params.style, mood: params.mood });
  const baseStyle = baseTone.style?.trim();
  const baseMood = baseTone.mood?.trim();
  const toneExtras = sanitizeToneExtras(params.toneExtras);

  let facts: Record<string, unknown> = {};
  let variants: z.infer<typeof CaptionArray> = [];
  let ranked: z.infer<typeof RankResult>;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < 2) {
    attempt += 1;
    logger.info(`[OpenRouter] Pipeline attempt ${attempt}/2`);
    try {
      logger.debug("[OpenRouter] Extracting facts from image", { imageUrl: params.imageUrl });
      facts = await extractFacts(params.imageUrl);
      logger.info("[OpenRouter] Facts extracted successfully", { factCount: Object.keys(facts).length });
      logger.debug("[OpenRouter] Generating variants");
      variants = await generateVariants({
        platform: params.platform,
        voice,
        facts,
        nsfw,
        style: baseStyle,
        mood: baseMood,
        toneExtras,
        mandatoryTokens: params.mandatoryTokens,
      });
      logger.info("[OpenRouter] Variants generated", { variantCount: variants.length });

      logger.debug("[OpenRouter] Ranking and selecting variants");
      ranked = await rankAndSelect(variants, { platform: params.platform, facts });
      logger.info("[OpenRouter] Ranking complete", { selectedCaption: ranked.final.caption?.substring(0, 50) + '...' });

      const ensureCoverage = async () => {
        let coverage = ensureFactCoverage({ facts, caption: ranked.final.caption, alt: ranked.final.alt });
        let coverageAttempts = 0;
        while (!coverage.ok && coverage.hint && coverageAttempts < 2) {
          coverageAttempts += 1;
          variants = await generateVariants({
            platform: params.platform,
            voice,
            facts,
            nsfw,
            style: baseStyle,
            mood: baseMood,
            toneExtras,
            hint: coverage.hint,
            mandatoryTokens: params.mandatoryTokens,
          });
          ranked = await rankAndSelect(variants, { platform: params.platform, facts });
          coverage = ensureFactCoverage({ facts, caption: ranked.final.caption, alt: ranked.final.alt });
        }
      };

      await ensureCoverage();

      const platformError = platformChecks(params.platform, ranked.final);
      if (platformError) {
        variants = await generateVariants({
          platform: params.platform,
          voice,
          facts,
          nsfw,
          style: baseStyle,
          mood: baseMood,
          toneExtras,
          hint: `Fix: ${platformError}. Use IMAGE_FACTS nouns/colors/setting explicitly.`,
          mandatoryTokens: params.mandatoryTokens,
        });
        ranked = await rankAndSelect(variants, { platform: params.platform, facts });
      }

      const enriched = enrichWithTitleCandidates(ranked.final, { variants, ranked });
      const final = enriched.final;
      ranked = enriched.ranked ?? ranked;

      // Select top 2 variants for user choice (Quick Post workflow)
      // The ranked object contains the best caption (final), so we use that as #1
      // For #2, we select the next best variant that's sufficiently different
      const topVariants: z.infer<typeof CaptionItem>[] = [final];

      if (variants.length > 1) {
        // Find the second-best variant that's different enough from #1
        for (const variant of variants) {
          if (topVariants.length >= 2) break;

          // Skip if it's too similar to the top choice
          const isSimilar = variant.caption === final.caption ||
                           captionsAreSimilar(final.caption, variant.caption);

          if (!isSimilar) {
            topVariants.push(variant);
          }
        }
      }

      logger.info("[OpenRouter] Selected top variants for user choice", {
        topCount: topVariants.length,
        top1: topVariants[0]?.caption.substring(0, 50) + '...',
        top2: topVariants[1]?.caption.substring(0, 50) + '...'
      });

      return {
        provider: "openrouter",
        facts,
        variants,
        ranked,
        final,
        titles: final.titles,
        topVariants: topVariants.slice(0, 2), // Ensure max 2
      };
    } catch (error) {
      lastError = error;

      // Check for 413 Payload Too Large error
      const errorObj = error as any;
      const is413Error = errorObj?.status === 413 || errorObj?.code === 413 ||
                        (errorObj?.message && /payload.*large|413|length.*exceed|too large/i.test(errorObj.message));

      if (is413Error) {
        logger.error("[OpenRouter] Image too large (413), falling back to template captions", {
          attempt,
          imageUrl: params.imageUrl.substring(0, 100),
          platform: params.platform,
          errorStatus: errorObj?.status,
          errorMessage: errorObj?.message
        });

        // Fall back to template captions immediately
        const fallbackVariants = buildFallbackBatch({ platform: params.platform, facts, nsfw });
        const fallbackFinal = fallbackVariants[0];
        const fallbackRanked = RankResult.parse({
          final: fallbackFinal,
          reason: "Image was too large for AI analysis. Generated template-based captions.",
          runner_up: fallbackVariants[1],
        });

        return {
          provider: "template-fallback",
          facts: {},
          variants: fallbackVariants,
          ranked: fallbackRanked,
          final: fallbackFinal,
          titles: fallbackFinal.titles,
          topVariants: fallbackVariants.slice(0, 2),
        };
      }

      const errorDetails = {
        attempt,
        imageUrl: params.imageUrl,
        platform: params.platform,
        voice: params.voice,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCause: error instanceof Error ? error.cause : undefined
      };
      logger.error("[OpenRouter] Pipeline attempt failed", errorDetails);
    }
  }

  logger.error("[OpenRouter] All pipeline attempts exhausted", {
    attempts: 2,
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
    params: {
      imageUrl: params.imageUrl,
      platform: params.platform,
      voice: params.voice
    }
  });
  throw new OpenRouterError("OpenRouter pipeline failed after retries", lastError);
}
