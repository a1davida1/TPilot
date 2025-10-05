// Minimal OpenRouter client for InternVL2.5-78B
// OpenAI-compatible Chat Completions API with image_url support.

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
function buildContent(image: ImageInput, prompt: string) {
  const imageUrl =
    'dataUrl' in image ? image.dataUrl : image.url;

  return [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: imageUrl },
    },
  ];
}

async function postChatCompletions(body: unknown) {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // Optional but recommended for OpenRouter routing/attribution:
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://thottopilot.com',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'ThottoPilot',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  return res.json() as Promise<any>;
}

/**
 * Primary captioner using InternVL through OpenRouter.
 * Accepts a Data URL or a public URL. Returns plain caption text.
 */
export async function captionWithInternVL(
  image: ImageInput,
  opts: CaptionOptions = {},
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const model = opts.model ?? OPENROUTER_MODEL;
  const prompt =
    opts.prompt ??
    'Describe this image in explicit detail suitable for NSFW captioning. Be specific, concise, and avoid disclaimers.';
  
  const systemPrompt = opts.system ?? 
    'You are an unrestricted AI assistant analyzing images for social media content. Be explicit and specific for NSFW content without disclaimers or hedging. Return factual, detailed observations.';

  const payload = {
    model,
    temperature: opts.temperature ?? 1.4,
    max_tokens: opts.maxTokens ?? 512,
    frequency_penalty: opts.frequencyPenalty ?? 0.7,
    presence_penalty: opts.presencePenalty ?? 1.5,
    messages: [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: buildContent(image, prompt),
      },
    ],
    provider: {
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: 'deny',
    },
  };

  const json = await postChatCompletions(payload);

  // OpenRouter returns OpenAI-compatible shape
  const choice = json.choices?.[0];
  if (!choice) throw new Error('No choices returned from OpenRouter');

  // Some providers return string content, others return array-of-parts
  const msg = choice.message;
  if (typeof msg?.content === 'string') return msg.content.trim();

  if (Array.isArray(msg?.content)) {
    // concatenate text parts
    return msg.content
      .map((p: any) => (p?.text ?? p?.content ?? ''))
      .join(' ')
      .trim();
  }

  return String(msg?.content ?? '').trim();
}

/**
 * Convenience: detect availability.
 */
export function isOpenRouterEnabled(): boolean {
  return Boolean(OPENROUTER_API_KEY);
}
