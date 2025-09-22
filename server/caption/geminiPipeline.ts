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

function normalizeVariantFields(variant: Record<string, unknown>): z.infer<typeof CaptionItem> {
  const next: Record<string, unknown> = { ...variant };
  next.safety_level = normalizeSafetyLevel(
    typeof next.safety_level === "string" ? next.safety_level : "normal"
  );
  if (typeof next.mood !== "string" || next.mood.trim().length < 2) next.mood = "engaging";
  if (typeof next.style !== "string" || next.style.trim().length < 2) next.style = "authentic";
  if (typeof next.cta !== "string" || next.cta.trim().length < 2) next.cta = "Check it out";
  if (typeof next.alt !== "string" || next.alt.trim().length < 20)
    next.alt = "Engaging social media content";
  if (!Array.isArray(next.hashtags) || next.hashtags.length < 3)
    next.hashtags = ["#content", "#creative", "#amazing"];
  if (typeof next.caption !== "string" || next.caption.trim().length < 1)
    next.caption = "Check out this amazing content!";
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

  let attempts = 0;
  let currentHint = params.hint;
  let variants: z.infer<typeof CaptionItem>[] = [];
  const keyIndex = new Map<string, number>();

  while (attempts < VARIANT_RETRY_LIMIT && variants.length < VARIANT_TARGET) {
    attempts += 1;
    const voiceContext = formatVoiceContext(params.voice);
    const user = `PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${voiceContext ? `${voiceContext}\n` : ''}${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}IMAGE_FACTS: ${JSON.stringify(params.facts)}\nNSFW: ${params.nsfw || false}${currentHint ? `\nHINT:${currentHint}` : ''}`;

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

    items.forEach(item => {
      const candidate = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      const normalized = normalizeVariantFields(candidate);
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

    variants = dedupeCaptionVariants(variants).slice(0, VARIANT_TARGET);
    keyIndex.clear();
    variants.forEach((variant, index) => {
      keyIndex.set(uniqueCaptionKey(variant.caption), index);
    });

    if (variants.length < VARIANT_TARGET) {
      const needed = VARIANT_TARGET - variants.length;
      currentHint = buildRetryHint(params.hint, iterationDuplicates, needed);
    }
  }

  if (variants.length !== VARIANT_TARGET) {
    throw new Error(`Failed to generate ${VARIANT_TARGET} unique caption variants.`);
  }

  return CaptionArray.parse(variants);
}

function normalizeGeminiFinal(final: Record<string, unknown>, platform?: string){
  final.safety_level = normalizeSafetyLevel(
    typeof final.safety_level === "string" ? final.safety_level : "normal"
  );
  final.mood = typeof final.mood === "string" && final.mood.trim().length >= 2 ? final.mood.trim() : "engaging";
  final.style = typeof final.style === "string" && final.style.trim().length >= 2 ? final.style.trim() : "authentic";
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
  const trimmedCaption = typeof final.caption === "string" ? final.caption.trim() : "";
  final.caption = trimmedCaption.length > 0 ? trimmedCaption : "Sharing something I'm genuinely proud of.";
}

async function requestGeminiRanking(
  variantsInput: z.infer<typeof CaptionArray>,
  serializedVariants: string,
  promptBlock: string,
  platform?: string,
  extraHint?: string
): Promise<unknown> {
  const hintBlock = extraHint && extraHint.trim().length > 0 ? `\nREMINDER: ${extraHint.trim()}` : "";
  let res;
  try {
    res=await textModel.generateContent([{ text: `${promptBlock}${hintBlock}\n${serializedVariants}` }]);
  } catch (error) {
    console.error('Gemini textModel.generateContent failed:', error);
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
  
  if((json as Record<string, unknown>).final){
    const final = (json as { final: Record<string, unknown> }).final;
    normalizeGeminiFinal(final, platform);
  }
  return json;
}

export async function rankAndSelect(
  variants: z.infer<typeof CaptionArray>,
  params?: { platform?: string }
): Promise<z.infer<typeof RankResult>> {
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const promptBlock = `${sys}\n${guard}\n${prompt}`;
  const serializedVariants = JSON.stringify(variants);

  const first = await requestGeminiRanking(variants, serializedVariants, promptBlock, params?.platform);
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
    let ranked = await rankAndSelect(variants, { platform });
    let out = ranked.final;

    const enforceCoverage = async () => {
      let attempts = 0;
      let coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      while (!coverage.ok && coverage.hint && attempts < 2) {
        attempts += 1;
        variants = await generateVariants({ platform, voice, facts, hint: coverage.hint, nsfw, ...tone });
        variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
        ranked = await rankAndSelect(variants, { platform });
        out = ranked.final;
        coverage = ensureFactCoverage({ facts, caption: out.caption, alt: out.alt });
      }
    };

    await enforceCoverage();

    const err = platformChecks(platform, out);
    if (err) {
      variants = await generateVariants({ platform, voice, facts, nsfw, ...tone, hint:`Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.` });
      variants = dedupeVariantsForRanking(variants, 5, { platform, facts });
      ranked = await rankAndSelect(variants, { platform });
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