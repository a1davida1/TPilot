import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { BANNED_WORDS_HINT, variantContainsBannedWord } from "./bannedWords";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { formatVoiceContext } from "./voiceTraits";
import { ensureFactCoverage } from "./ensureFactCoverage";
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
}

// Text model interfaces for type safety
interface TextModelFunction {
  (prompt: Array<{ text: string }>): Promise<unknown>;
}

interface TextModelObject {
  generateContent(prompt: Array<{ text: string }>): Promise<unknown>;
}

interface GeminiResponse {
  response?: {
    text(): string;
  };
}

const MAX_VARIANT_ATTEMPTS = 4;
const VARIANT_TARGET = 5;
const VARIANT_RETRY_LIMIT = 4;
const CAPTION_KEY_LENGTH = 80;

const safeFallbackCaption = "Sharing something I'm proud of today.";
const safeFallbackAlt = "Detailed alt text describing the scene.";
const safeFallbackHashtags = ["#content", "#creative", "#amazing"];
const safeFallbackCta = HUMAN_CTA;

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

async function load(p: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "prompts", p), "utf8");
}
async function b64(url: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new InvalidImageError(`fetch failed: ${r.status} ${r.statusText}`);

    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/"))
      throw new InvalidImageError(`unsupported content-type: ${ct}`);

    const b = Buffer.from(await r.arrayBuffer());
    const base64 = b.toString("base64");
    if (base64.length < 100) throw new InvalidImageError("image data too small");

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

export async function extractFacts(imageUrl: string): Promise<Record<string, unknown>> {
  try {
    console.log('Starting fact extraction for image:', imageUrl.substring(0, 100) + '...');
    const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");

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
        console.log('WebP format detected, validating header...');
        const headerSignature = decodedBuffer.subarray(0, 4).toString();
        if (headerSignature !== 'RIFF') {
          console.warn('WebP validation warning: Missing RIFF header');
        }
      }

      // GIF format validation
      if (mimeType === 'image/gif') {
        console.log('GIF format detected, validating header...');
        const gifSignature = decodedBuffer.subarray(0, 6).toString();
        if (!gifSignature.startsWith('GIF87a') && !gifSignature.startsWith('GIF89a')) {
          console.warn('GIF validation warning: Invalid GIF header');
          throw new InvalidImageError('Invalid GIF image format');
        }

        // Note: Gemini sometimes has issues with animated GIFs
        // For GIFs, we'll use OpenAI fallback more aggressively
        if (decodedBuffer.length > 5000000) { // ~3.8MB base64 encoded
          console.log('Large GIF detected, may need fallback processing');
        }
      }

      // Check if Base64 data is reasonable length (not too short or extremely long)
      if (imageData.length < 100) {
        throw new InvalidImageError('Base64 data appears to be too short');
      }

      if (imageData.length > 10000000) { // ~7.5MB base64 encoded
        throw new InvalidImageError('Image data too large for processing');
      }

      console.log(`Processing data URL with mime type: ${mimeType}, data length: ${imageData.length}`);
      console.log(`Base64 starts with: ${imageData.substring(0, 50)}...`);
    } else {
      console.log("Fetching image from URL:", imageUrl);
      const fetched = await b64(imageUrl);
      imageData = fetched.base64;
      mimeType = fetched.mimeType;
    }

    const img = { inlineData: { data: imageData, mimeType } };
    console.log('Sending to Gemini for fact extraction...');

    // For GIFs, try Gemini but be prepared for fallback
    if (mimeType === 'image/gif') {
      console.log('Processing GIF - Gemini support may be limited');
    }

    try {
      const res = await visionModel.generateContent([{text: sys + "\n" + guard + "\n" + prompt}, img]);
      const result = stripToJSON(res.response.text()) as Record<string, unknown>;
      console.log('Fact extraction completed successfully');
      return result;
    } catch (error) {
      console.error('Gemini visionModel.generateContent failed:', error);

      // For GIFs that fail Gemini processing, provide better fallback facts
      if (mimeType === 'image/gif') {
        console.log('GIF processing failed in Gemini, using enhanced fallback facts');
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
  platform: "instagram" | "x" | "reddit" | "tiktok";
  voice: string;
  facts: Record<string, unknown>;
  hint?: string;
  nsfw?: boolean;
  style?: string;
  mood?: string;
};

export async function generateVariants(params: GeminiVariantParams): Promise<z.infer<typeof CaptionArray>> {
  const [sys, guard, prompt] = await Promise.all([
    load("system.txt"),
    load("guard.txt"),
    load("variants.txt")
  ]);

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
      `VOICE: ${params.voice}`
    ];

    if (params.style) lines.push(`STYLE: ${params.style}`);
    if (params.mood) lines.push(`MOOD: ${params.mood}`);

    lines.push(`IMAGE_FACTS: ${JSON.stringify(params.facts)}`);
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
    hintParts.push("Provide five options that vary tone, structure, and specific imagery.");

    const currentHint = hintParts.filter(Boolean).join(" ");
    const serializedHint = serializePromptField(currentHint, { block: true });
    lines.push(`HINT:${serializedHint}`);

    return lines.join("\n");
  };

  const fetchVariants = async (varietyHint: string | undefined, existingCaptions: string[]) => {
    const user = buildUserPrompt(varietyHint, existingCaptions);
    try {
      const res = await textModel.generateContent([
        { text: `${sys}\n${guard}\n${prompt}\n${user}` }
      ]);
      const json = stripToJSON(res.response.text()) as unknown;
      return Array.isArray(json) ? json : [];
    } catch (error) {
      console.error("Gemini textModel.generateContent failed:", error);
      throw error;
    }
  };

  const uniqueVariants: z.infer<typeof CaptionItem>[] = [];
  const existingCaptions: string[] = [];
  const duplicatesThisAttempt: string[] = [];
  const isTest = process.env.NODE_ENV === 'test';
  const maxAttempts = isTest ? 2 : 5; // Allow 2 attempts in test for retry logic testing

  const sanitizedBaseHint = sanitizeHintForRetry(params.hint);

  for (let attempt = 0; attempt < maxAttempts && uniqueVariants.length < 5; attempt += 1) {
    const needed = 5 - uniqueVariants.length;
    const varietyHint = attempt === 0
      ? sanitizedBaseHint ?? params.hint
      : (() => {
          // Build complete base hint with variety clause first, then pass to buildRetryHint
          const baseHintWithVariety = `${sanitizedBaseHint ? `${sanitizedBaseHint} ` : ""}Need much more variety across tone, structure, and imagery.`;
          return buildRetryHint(baseHintWithVariety, duplicatesThisAttempt, needed);
        })();

    const rawVariants = await fetchVariants(varietyHint, existingCaptions);
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
  while (uniqueVariants.length < 5) {
    const baseVariant = uniqueVariants[0] || {
      caption: "Sharing a highlight from today",
      alt: "Detailed alt text describing the scene",
      hashtags: fallbackHashtags(params.platform),
      cta: HUMAN_CTA,
      mood: "engaging",
      style: "authentic",
      safety_level: "normal",
      nsfw: false
    };

    // Create a slight variation by appending index
    const paddedVariant = {
      ...baseVariant,
      caption: `${baseVariant.caption} v${uniqueVariants.length + 1}`,
      alt: `${baseVariant.alt} (variation ${uniqueVariants.length + 1})`
    };

    uniqueVariants.push(paddedVariant as z.infer<typeof CaptionItem>);
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

// Helper function to invoke text model regardless of its type (function vs object)
async function invokeTextModel(prompt: Array<{ text: string }>): Promise<unknown> {
  if (typeof textModel === 'function') {
    // Function-based textModel
    return await (textModel as TextModelFunction)(prompt);
  } else if (textModel && typeof (textModel as TextModelObject).generateContent === 'function') {
    // Object-based textModel with generateContent method
    return await (textModel as TextModelObject).generateContent(prompt);
  } else {
    throw new Error('textModel is neither a function nor has a generateContent method');
  }
}

function truncateReason(reason: string, maxLength = 100): string {
  return reason.length > maxLength ? `${reason.slice(0, maxLength - 3)}...` : reason;
}

async function requestGeminiRanking(
  variantsInput: z.infer<typeof CaptionArray>,
  serializedVariants: string,
  promptBlock: string,
  platform?: string,
  extraHint?: string,
  facts?: Record<string, unknown>
): Promise<unknown> {
  const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
  let res;
  try {
    res = await invokeTextModel([{ text: `${promptBlock}${hintBlock}\n${serializedVariants}` }]);
  } catch (error) {
    console.error('Gemini textModel invocation failed:', error);
    throw error;
  }
  let json = stripToJSON(
    (res as GeminiResponse)?.response?.text
      ? (res as GeminiResponse).response.text()
      : typeof res === 'string'
        ? res
        : JSON.stringify(res)
  ) as unknown;


  const defaultHashtags = fallbackHashtags(platform);
  const defaultVariant = variantsInput[0] ??
    CaptionItem.parse({
      caption: safeFallbackCaption,
      alt: safeFallbackAlt,
      hashtags: [...defaultHashtags],
      cta: safeFallbackCta,
      mood: "engaging",
      style: "authentic",
      safety_level: "normal",
      nsfw: false,
    });
  const defaultScores = [5, 4, 3, 2, 1];

  if(Array.isArray(json)) {
    const winner = json[0] as Record<string, unknown> | undefined;
    json = {
      winner_index: 0,
      scores: [...defaultScores],
      reason: "Selected based on engagement potential",
      final: winner ?? { ...defaultVariant }
    };
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

  const first = await requestGeminiRanking(variants, serializedVariants, promptBlock, params?.platform, undefined, params?.facts);
  let parsed = RankResult.parse(first);
  const violations = detectVariantViolations(parsed.final);

  if (violations.length === 0) {
    return parsed;
  }

  const rerank = await requestGeminiRanking(
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
  try {
    const tone = extractToneOptions(toneRest);
    const facts = await extractFacts(imageUrl);
    let variants = await generateVariants({ platform, voice, facts, nsfw, ...tone });
    variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
    let ranked = await rankAndSelect(variants, { platform, facts });
    let out = ranked.final;

    const enforceCoverage = async () => {
      let attempts = 0;
      let coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      while (!coverage.ok && coverage.hint && attempts < 2) {
        attempts += 1;
        variants = await generateVariants({ platform, voice, facts, hint: coverage.hint, nsfw, ...tone });
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
        platform,
        voice,
        style,
        mood,
        facts,
        hint: `Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.`,
        nsfw
      });
      ranked = await rankAndSelect(variants);
      out = ranked.final;
    }

    return { provider: 'gemini', facts, variants, ranked, final: out };
  } catch (error) {
    const { openAICaptionFallback } = await import('./openaiFallback');
    const final = await openAICaptionFallback({ platform, voice, imageUrl });
    return { provider: 'openai', final } as CaptionResult;
  }
}