import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ensureFallbackCompliance, type FallbackInferenceInput } from './inferFallbackFromFacts';
import { safeFallbackCaption, safeFallbackCta, safeFallbackHashtags } from './rankingGuards';
import { CaptionArray, CaptionItem, type CaptionVariants, type CaptionVariant } from './schema';
import { serializePromptField } from './promptUtils';
import { formatVoiceContext } from './voiceTraits';
import { validateImageUrl, logImageInfo } from './lib/images';
import { normalizeImageForOpenAI } from './util/normalizeImage';

function isImageDiagnosticsEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return process.env.CAPTION_DEBUG_IMAGES === 'true';
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const SAFE_FALLBACK_ALT_TEXT = 'Engaging social media content';
const VARIANT_TARGET = 5;

function buildSafeFallbackVariants(
  fallbackParams: FallbackInferenceInput,
  voice?: string,
  options?: { moodOverride?: string }
): CaptionVariants {
  const baseMood = options?.moodOverride ?? (voice && voice.includes('flirty') ? 'flirty' : 'engaging');
  const safeVariants = Array.from({ length: VARIANT_TARGET }, (_, index) => {
    const caption = index === 0 ? safeFallbackCaption : `${safeFallbackCaption} (${index + 1})`;
    const compliance = ensureFallbackCompliance(
      {
        caption,
        hashtags: Array.from(safeFallbackHashtags),
        cta: safeFallbackCta,
        alt: SAFE_FALLBACK_ALT_TEXT,
      },
      fallbackParams
    );

    return CaptionItem.parse({
      caption,
      hashtags: compliance.hashtags,
      safety_level: 'normal',
      mood: baseMood,
      style: 'authentic',
      cta: compliance.cta,
      alt: compliance.alt,
      nsfw: false,
    });
  });

  return CaptionArray.parse(safeVariants);
}

function buildTestFallbackVariants(
  params: FallbackInferenceInput,
  voice?: string,
  existingCaption?: string
): CaptionVariants {
  const variants = Array.from({ length: VARIANT_TARGET }, (_, index) => {
    const baseCaption = existingCaption || 'Test fallback caption';
    const caption = index === 0 ? baseCaption : `${baseCaption} (variant ${index + 1})`;
    const cta = index === 0 ? 'Test CTA' : `Test CTA option ${index + 1}`;
    const alt = `Test fallback alt text for deterministic testing variant ${index + 1}`;
    const compliance = ensureFallbackCompliance(
      {
        caption,
        hashtags: ['#test', '#fallback'],
        cta,
        alt,
      },
      params
    );

    return CaptionItem.parse({
      caption,
      hashtags: compliance.hashtags,
      safety_level: 'normal',
      mood: voice?.includes('flirty') ? 'flirty' : 'confident',
      style: 'authentic',
      cta: compliance.cta,
      alt: compliance.alt,
      nsfw: false,
    });
  });

  return CaptionArray.parse(variants);
}

function extractVariantCandidates(payload: unknown): unknown[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.variants)) {
      return record.variants as unknown[];
    }
    return [record];
  }
  return [];
}

function normalizeVariant(
  candidate: unknown,
  fallbackVariant: CaptionVariant,
  fallbackParams: FallbackInferenceInput,
  existingCaption?: string
): CaptionVariant {
  if (!candidate || typeof candidate !== 'object') {
    return fallbackVariant;
  }

  const record = candidate as Record<string, unknown>;
  const candidateHashtags = Array.isArray(record.hashtags)
    ? record.hashtags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;
  const proposedCaption = typeof record.caption === 'string' ? record.caption.trim() : '';
  const caption = proposedCaption.length > 0
    ? proposedCaption
    : (existingCaption && existingCaption.trim().length > 0
      ? existingCaption
      : fallbackVariant.caption);

  const compliance = ensureFallbackCompliance(
    {
      caption,
      hashtags: candidateHashtags,
      cta: typeof record.cta === 'string' ? record.cta : undefined,
      alt: typeof record.alt === 'string' ? record.alt : undefined,
    },
    fallbackParams
  );

  return CaptionItem.parse({
    caption,
    hashtags: compliance.hashtags,
    safety_level: typeof record.safety_level === 'string' && record.safety_level.trim().length > 0
      ? (record.safety_level as string)
      : fallbackVariant.safety_level,
    mood: typeof record.mood === 'string' && record.mood.trim().length > 1
      ? (record.mood as string)
      : fallbackVariant.mood,
    style: typeof record.style === 'string' && record.style.trim().length > 1
      ? (record.style as string)
      : fallbackVariant.style,
    cta: compliance.cta,
    alt: compliance.alt,
    nsfw: typeof record.nsfw === 'boolean' ? record.nsfw : fallbackVariant.nsfw,
  });
}

export interface FallbackParams {
  platform: 'instagram' | 'x' | 'reddit' | 'tiktok';
  voice?: string;
  imageUrl?: string;
  theme?: string;
  context?: string;
  existingCaption?: string;
}

export async function openAICaptionFallback({
  platform,
  voice = 'flirty_playful',
  imageUrl,
  existingCaption,
  context,
  theme,
}: FallbackParams): Promise<CaptionVariants> {
  const fallbackParamsForCompliance: FallbackInferenceInput = {
    platform,
    context: context ?? existingCaption,
    existingCaption,
    theme,
  };

  if (process.env.NODE_ENV === 'test') {
    return buildTestFallbackVariants(fallbackParamsForCompliance, voice, existingCaption);
  }

  const sanitizedExistingCaption = existingCaption ? serializePromptField(existingCaption) : undefined;
  const voiceContext = formatVoiceContext(voice);
  const systemVoiceSuffix = voiceContext ? `\n${voiceContext}` : '';

  const fallbackContext = context ?? existingCaption ?? sanitizedExistingCaption;
  const complianceParams: FallbackInferenceInput = {
    platform,
    context: fallbackContext,
    existingCaption,
    theme,
  };

  if (!process.env.OPENAI_API_KEY) {
    return buildSafeFallbackVariants(complianceParams, voice);
  }

  const variantStructurePrompt = `\nReturn ONLY a JSON object with this exact structure:\n{\n  "variants": [\n    {\n      "caption": "caption that references visible details",\n      "hashtags": ["#relevant", "#to", "#image"],\n      "safety_level": "normal",\n      "mood": "${voice.includes('flirty') ? 'flirty' : 'confident'}",\n      "style": "authentic",\n      "cta": "short call to action",\n      "alt": "detailed description of the image with at least 20 characters",\n      "nsfw": false\n    }\n  ]\n}\nProvide ${VARIANT_TARGET} unique variants with different captions, CTAs, and hashtags.`;

  let messages: ChatCompletionMessageParam[] = [];

  if (imageUrl) {
    try {
      console.error('OpenAI fallback: Analyzing image for accurate captions');
      const normalized = normalizeImageForOpenAI(imageUrl);
      if (!normalized || !validateImageUrl(normalized)) {
        throw new Error('Invalid or too short image data');
      }

      if (isImageDiagnosticsEnabled()) {
        const requestId = `openai-${Date.now()}`;
        logImageInfo(normalized, requestId);
      }

      messages = [
        {
          role: 'system',
          content: `You are an expert social media caption writer. Analyze the image carefully and create engaging ${voice} content for ${platform} that directly relates to what you see.${systemVoiceSuffix}${variantStructurePrompt}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: sanitizedExistingCaption
                ? `Analyze this image and rewrite this caption to better match what you see: ${sanitizedExistingCaption}`
                : 'Analyze this image and create a caption that describes what you actually see',
            },
            {
              type: 'image_url',
              image_url: { url: normalized },
            },
          ],
        },
      ];
    } catch (error) {
      console.warn('Image analysis failed, using text-only fallback:', error);
      messages = [
        {
          role: 'system',
          content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.${systemVoiceSuffix}${variantStructurePrompt}`,
        },
        {
          role: 'user',
          content: sanitizedExistingCaption
            ? `Rewrite this caption: ${sanitizedExistingCaption}`
            : `Create engaging ${voice} content for ${platform}`,
        },
      ];
    }
  } else {
    messages = [
      {
        role: 'system',
        content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.${systemVoiceSuffix}${variantStructurePrompt}`,
      },
      {
        role: 'user',
        content: sanitizedExistingCaption
          ? `Rewrite this caption: ${sanitizedExistingCaption}`
          : `Create engaging ${voice} content for ${platform}`,
      },
    ];
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 600,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error parsing JSON response from OpenAI:', error);
      console.error('OpenAI response content:', response.choices[0].message.content);
      parsed = { variants: [{ caption: response.choices[0].message.content || 'Fallback caption' }] };
    }

    const candidates = extractVariantCandidates(parsed);
    const safeFallbacks = buildSafeFallbackVariants(complianceParams, voice);

    const resolved: CaptionVariant[] = candidates
      .slice(0, VARIANT_TARGET)
      .map((candidate, index) => {
        const fallbackVariant = safeFallbacks[Math.min(index, safeFallbacks.length - 1)];
        return normalizeVariant(candidate, fallbackVariant, complianceParams, existingCaption);
      });

    const completed = [...resolved];
    for (let index = completed.length; index < VARIANT_TARGET; index += 1) {
      completed.push(safeFallbacks[index]);
    }

    return CaptionArray.parse(completed.slice(0, VARIANT_TARGET));
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return buildSafeFallbackVariants(complianceParams, voice);
  }
}
