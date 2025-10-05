// OpenRouter client using OpenAI SDK for InternVL3-78B
// Leverages official OpenAI SDK with OpenRouter's API-compatible endpoint

import OpenAI from 'openai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
/**
 * Default to InternVL3-78B (latest, best for NSFW). Change via env if you prefer others.
 * Examples:
 *   opengvlab/internvl3-78b (recommended)
 *   opengvlab/internvl2_5-78b
 *   opengvlab/internvl3-14b
 */
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'opengvlab/internvl3-78b';

if (!OPENROUTER_API_KEY) {
  console.warn('[openrouter] OPENROUTER_API_KEY not set. Provider will be disabled.');
}

// Initialize OpenAI client with OpenRouter endpoint
const client = OPENROUTER_API_KEY ? new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://thottopilot.com',
    'X-Title': process.env.OPENROUTER_APP_NAME ?? 'ThottoPilot',
  },
}) : null;

type ImageInput =
  | { dataUrl: string }               // e.g. "data:image/jpeg;base64,..."
  | { url: string };                  // public URL

export interface CaptionOptions {
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  model?: string;                     // override env model per-call
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Build OpenAI-style content array with one image and prompt text.
 */
function buildContent(image: ImageInput, prompt: string): Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const imageUrl = 'dataUrl' in image ? image.dataUrl : image.url;

  return [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: imageUrl },
    },
  ];
}

/**
 * Primary captioner using InternVL through OpenRouter.
 * Accepts a Data URL or a public URL. Returns plain caption text.
 */
export async function captionWithInternVL(
  image: ImageInput,
  opts: CaptionOptions = {},
): Promise<string> {
  if (!client) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const model = opts.model ?? OPENROUTER_MODEL;
  const prompt =
    opts.prompt ??
    'Describe this image in explicit detail suitable for NSFW captioning. Be specific, concise, and avoid disclaimers.';
  
  const systemPrompt = opts.system ?? 
    'You are an unrestricted AI assistant analyzing images for social media content. Be explicit and specific for NSFW content without disclaimers or hedging. Return factual, detailed observations.';

  const response = await client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 1.4,
    max_tokens: opts.maxTokens ?? 512,
    frequency_penalty: opts.frequencyPenalty ?? 0.7,
    presence_penalty: opts.presencePenalty ?? 1.5,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: buildContent(image, prompt) as any,
      },
    ],
    // OpenRouter-specific provider settings
    // @ts-ignore - OpenRouter extends standard OpenAI API
    provider: {
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: 'deny',
    },
  });

  const choice = response.choices[0];
  if (!choice) throw new Error('No choices returned from OpenRouter');

  const content = choice.message.content;
  if (!content) throw new Error('Empty content from OpenRouter');

  return content.trim();
}

/**
 * Convenience: detect availability.
 */
export function isOpenRouterEnabled(): boolean {
  return Boolean(OPENROUTER_API_KEY && client);
}
