import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { ensureFallbackCompliance, type FallbackInferenceInput } from './inferFallbackFromFacts';
import { CaptionItem } from './schema';
import { serializePromptField } from './promptUtils';
import { formatVoiceContext } from './voiceTraits';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

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
  voice = "flirty_playful",
  imageUrl,
  existingCaption,
  context,
  theme,
}: FallbackParams): Promise<z.infer<typeof CaptionItem>> {
  // Guard against real API calls in test environment
  if (process.env.NODE_ENV === 'test') {
    const base = {
      caption: existingCaption || "Test fallback caption",
      hashtags: ["#test", "#fallback"],
      safety_level: "normal",
      mood: voice?.includes('flirty') ? 'flirty' : 'confident',
      style: "authentic",
      cta: "Test CTA",
      alt: "Test fallback alt text for deterministic testing",
      nsfw: false
    };
    const compliance = ensureFallbackCompliance(
      {
        caption: base.caption,
        hashtags: base.hashtags,
        cta: base.cta,
        alt: base.alt,
      },
      {
        platform,
        context: context ?? existingCaption,
        existingCaption,
        theme,
      }
    );

    return CaptionItem.parse({
      ...base,
      hashtags: compliance.hashtags,
      cta: compliance.cta,
      alt: compliance.alt,
    });
  }
  let messages: ChatCompletionMessageParam[] = [];
  const sanitizedExistingCaption = existingCaption ? serializePromptField(existingCaption) : undefined;
  const voiceContext = formatVoiceContext(voice);
  const systemVoiceSuffix = voiceContext ? `\n${voiceContext}` : '';

  const fallbackContext = context ?? existingCaption ?? sanitizedExistingCaption;
  const fallbackParamsForCompliance: FallbackInferenceInput = {
    platform,
    context: fallbackContext,
    existingCaption,
    theme,
  };

  if (imageUrl && openai) {
    try {
      console.log('OpenAI fallback: Analyzing image for accurate captions');

      if (imageUrl.startsWith('data:')) {
        // For data URLs, we can send directly to OpenAI vision
        messages = [
          {
            role: "system",
            content: `You are an expert social media caption writer. Analyze the image carefully and create engaging ${voice} content for ${platform} that directly relates to what you see.${systemVoiceSuffix}

Return ONLY a JSON object with this structure:
{
  "caption": "engaging caption text that describes what's actually in the image",
  "hashtags": ["#relevant", "#to", "#image"],
  "safety_level": "safe_for_work",
  "mood": "${voice.includes('flirty') ? 'flirty' : 'confident'}",
  "style": "authentic",
  "cta": "relevant call to action",
  "alt": "detailed description of what's actually in the image",
  "nsfw": false
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: sanitizedExistingCaption
                  ? `Analyze this image and rewrite this caption to better match what you see: ${sanitizedExistingCaption}`
                  : `Analyze this image and create a caption that describes what you actually see`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ];
      } else {
        // For regular URLs, describe the image request
        messages = [
          {
            role: "system",
            content: `Create engaging ${voice} content for ${platform} based on the image.${systemVoiceSuffix}`
          },
          {
            role: "user",
            content: `Create a caption for an image at: ${imageUrl.substring(0, 100)}...`
          }
        ];
      }
    } catch (error) {
      console.warn('Image analysis failed, using text-only fallback:', error);
      messages = [
        {
          role: "system",
          content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.${systemVoiceSuffix}`
        },
        {
          role: "user",
          content: sanitizedExistingCaption
            ? `Rewrite this caption: ${sanitizedExistingCaption}`
            : `Create engaging ${voice} content for ${platform}`
        }
      ];
    }
  } else {
    messages = [
      {
        role: "system",
        content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.${systemVoiceSuffix}`
      },
      {
        role: "user",
        content: sanitizedExistingCaption
          ? `Rewrite this caption: ${sanitizedExistingCaption}`
          : `Create engaging ${voice} content for ${platform}`
      }
    ];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    let json: unknown;
    try {
      json = JSON.parse(response.choices[0].message.content || '{}');
    } catch (e) {
      console.error("Error parsing JSON response from OpenAI:", e);
      console.error("OpenAI response content:", response.choices[0].message.content);
      // Fallback to a simpler structure if JSON parsing fails
      json = { caption: response.choices[0].message.content || 'Fallback caption' };
    }

    const jsonData: Record<string, unknown> = (json ?? {}) as Record<string, unknown>;
    const candidateHashtags = Array.isArray(jsonData.hashtags)
      ? jsonData.hashtags.filter((tag): tag is string => typeof tag === 'string')
      : undefined;

    const compliance = ensureFallbackCompliance(
      {
        caption: typeof jsonData.caption === 'string' ? jsonData.caption : undefined,
        hashtags: candidateHashtags,
        cta: typeof jsonData.cta === 'string' ? jsonData.cta : undefined,
        alt: typeof jsonData.alt === 'string' ? jsonData.alt : undefined,
      },
      fallbackParamsForCompliance
    );

    const resolvedCaption = typeof jsonData.caption === 'string' && jsonData.caption.trim().length > 0
      ? jsonData.caption
      : (existingCaption && existingCaption.trim().length > 0
        ? existingCaption
        : 'Fallback caption');

    return CaptionItem.parse({
      caption: resolvedCaption,
      hashtags: compliance.hashtags,
      safety_level: typeof jsonData.safety_level === 'string' && jsonData.safety_level.trim().length > 0
        ? (jsonData.safety_level as string)
        : 'normal',
      mood: typeof jsonData.mood === 'string' && jsonData.mood.trim().length > 1
        ? (jsonData.mood as string)
        : 'neutral',
      style: typeof jsonData.style === 'string' && jsonData.style.trim().length > 1
        ? (jsonData.style as string)
        : 'fallback',
      cta: compliance.cta,
      alt: compliance.alt,
      nsfw: typeof jsonData.nsfw === 'boolean' ? jsonData.nsfw : false,
    });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    const fallback = ensureFallbackCompliance(
      {
        caption: sanitizedExistingCaption,
        hashtags: [],
        cta: undefined,
        alt: undefined,
      },
      fallbackParamsForCompliance
    );

    return CaptionItem.parse({
      caption: sanitizedExistingCaption
        ? `Could not generate new caption. Original: ${sanitizedExistingCaption}`
        : 'Error generating caption.',
      hashtags: fallback.hashtags,
      safety_level: 'normal',
      mood: 'neutral',
      style: 'error',
      cta: fallback.cta,
      alt: fallback.alt,
      nsfw: false,
    });
  }
}