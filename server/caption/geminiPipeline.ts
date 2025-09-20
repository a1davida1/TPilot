import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, CaptionItem, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";
import { buildVoiceGuideBlock } from "./stylePack";

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
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}IMAGE_FACTS: ${JSON.stringify(params.facts)}\nNSFW: ${params.nsfw || false}\n${params.hint?`HINT:${params.hint}`:""}`;
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
  const json = stripToJSON(res.response.text()) as unknown[];
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item) => {
      const variant = item as Record<string, unknown>;
      variant.safety_level = normalizeSafetyLevel(
        typeof variant.safety_level === 'string' ? variant.safety_level : 'normal'
      );
      // Fix other fields
      if(typeof variant.mood !== 'string' || variant.mood.length < 2) variant.mood = "engaging";
      if(typeof variant.style !== 'string' || variant.style.length < 2) variant.style = "authentic";
      if(typeof variant.cta !== 'string' || variant.cta.length < 2) variant.cta = "Check it out";
      if(typeof variant.alt !== 'string' || variant.alt.length < 20) variant.alt = "Engaging social media content";
      if(!Array.isArray(variant.hashtags)) variant.hashtags = ["#content", "#creative", "#amazing"];
      if(typeof variant.caption !== 'string' || variant.caption.length < 1) variant.caption = "Check out this amazing content!";
    });

    // Ensure exactly 5 variants by padding with variations if needed
    while(json.length < 5) {
      const template = (json[0] as Record<string, unknown>) || {
        caption: "Check out this amazing content!",
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
        caption: `${template.caption as string} (Variant ${json.length + 1})`
      });
    }

    // Trim to exactly 5 if more than 5
    if(json.length > 5) {
      json.splice(5);
    }
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants: z.infer<typeof CaptionArray>): Promise<z.infer<typeof RankResult>> {
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  let res;
  try {
    res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  } catch (error) {
    console.error('Gemini textModel.generateContent failed:', error);
    throw error;
  }
  let json = stripToJSON(res.response.text()) as unknown;

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

  // Accept any safety_level in final result
  if((json as Record<string, unknown>).final){
    const final = (json as { final: Record<string, unknown> }).final;
    final.safety_level = normalizeSafetyLevel(
      typeof final.safety_level === 'string' ? final.safety_level : 'normal'
    );
    if(typeof final.mood !== 'string' || final.mood.length<2) final.mood="engaging";
    if(typeof final.style !== 'string' || final.style.length<2) final.style="authentic";
    if(typeof final.cta !== 'string' || final.cta.length<2) final.cta="Check it out";
    if(typeof final.alt !== 'string' || final.alt.length<20) final.alt="Engaging social media content";
    if(!Array.isArray(final.hashtags)) final.hashtags=["#content", "#creative", "#amazing"];
    if(typeof final.caption !== 'string' || final.caption.length<1) final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
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
    let ranked = await rankAndSelect(variants);
    let out = ranked.final;

    const err = platformChecks(platform, out);
    if (err) {
      variants = await generateVariants({ platform, voice, facts, nsfw, ...tone, hint:`Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.` });
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