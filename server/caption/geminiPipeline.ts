import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";
import { serializePromptField } from "./promptUtils";
import { formatVoiceContext } from "./voiceTraits";
import { ensureFactCoverage } from "./ensureFactCoverage";
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

const MAX_VARIANT_ATTEMPTS = 4;

function captionKey(caption: string): string {
  return caption.trim().slice(0, 80).toLowerCase();
}

function hintSnippet(caption: string): string {
  const normalized = caption.trim().replace(/\s+/g, " ");
  return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized;
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
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants.txt");
  
  const hints: string[] = [];
  if (params.hint) hints.push(params.hint);

  const defaults: Record<string, unknown> = {
    caption: "Check out this amazing content!",
    alt: "Engaging social media content",
    hashtags: ["#content", "#creative", "#amazing"],
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
      facts: params.facts,
      existingCaption: typeof variant.caption === 'string' ? variant.caption : params.hint,
    });
    
    const hashtagsSource = Array.isArray((variant as { hashtags?: unknown }).hashtags)
      ? ((variant as { hashtags: unknown[] }).hashtags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0))
      : [];
    const sanitizedHashtags = hashtagsSource.length > 0 ? hashtagsSource : fallback.hashtags;

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
      `IMAGE_FACTS: ${JSON.stringify(params.facts)}`,
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

    const parsed = stripToJSON(res.response.text());
    const arr = Array.isArray(parsed) ? parsed : [parsed];
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
      caption: freshCaption,
    };
    collected.push(newVariant);
    seenKeys.add(freshKey);
  }

  if (collected.length > 5) {
    collected.splice(5);
  }

  // Apply dedupe helper for final consistency
  const deduped = dedupeVariantsForRanking(CaptionArray.parse(collected), 5, { platform: params.platform, facts: params.facts });
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
  variants: z.infer<typeof CaptionArray>,
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
    console.error('Gemini textModel.generateContent failed:', error);
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
  variants: z.infer<typeof CaptionArray>,
  attempt: number,
  prompts: PromptBundle,
  retryHint?: string
): Promise<z.infer<typeof RankResult>> {
  const { parsed, normalizedFinal, violations } = await executeRankingAttempt(variants, prompts, retryHint);

  if (violations.length === 0) {
    return parsed;
  }

  if (attempt + 1 >= MAX_RANK_ATTEMPTS) {
    const safeIndex = variants.findIndex((variant) => detectRankingViolations(variant).length === 0);
    if (safeIndex >= 0) {
      const safeVariant = sanitizeVariantForRanking(variants[safeIndex]);
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
  variants: z.infer<typeof CaptionArray>,
  context?: {
    platform: "instagram" | "x" | "reddit" | "tiktok";
    facts?: Record<string, unknown>;
    existingCaption?: string;
    theme?: string;
  }
): Promise<z.infer<typeof RankResult>> {
  const prompts: PromptBundle = {
    sys: await load("system.txt"),
    guard: await load("guard.txt"),
    prompt: await load("rank.txt"),
  };
  
  const result = await rankAndSelectWithRetry(variants, 0, prompts);
  
  // Enforce platform hashtag limits
  if (context?.platform && result.final?.hashtags) {
    const platformLimit = context.platform === 'x' ? 2 : context.platform === 'instagram' ? 30 : 5;
    if (Array.isArray(result.final.hashtags) && result.final.hashtags.length > platformLimit) {
      result.final.hashtags = result.final.hashtags.slice(0, platformLimit);
    }
  }
  
  return result;
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
export async function pipeline({ imageUrl, platform, voice = "flirty_playful", nsfw = false, ...toneRest }: GeminiPipelineArgs): Promise<CaptionResult> {
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
      variants = await generateVariants({ platform, voice, facts, nsfw, ...tone, hint:`Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.` });
      variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
      ranked = await rankAndSelect(variants, { platform, facts });
      out = ranked.final;
      await enforceCoverage();
    }

    return { provider: 'gemini', facts, variants, ranked, final: out };
  } catch (error) {
    const { openAICaptionFallback } = await import('./openaiFallback');
    const final = await openAICaptionFallback({ platform, voice, imageUrl });
    return { provider: 'openai', final } as CaptionResult;
  }
}