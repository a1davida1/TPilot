// Minimal OpenRouter client for InternVL2.5-78B
// OpenAI-compatible Chat Completions API with image_url support.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
/**
 * Default to InternVL2.5-78B. Change via env if you prefer InternVL3 or others.
 * Examples:
 *   opengvlab/internvl2_5-78b
 *   opengvlab/internvl2-76b
 *   opengvlab/internvl3-14b
 */
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'opengvlab/internvl2_5-78b';

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

  const payload = {
    model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 512,
    messages: [
      ...(opts.system
        ? [{ role: 'system' as const, content: opts.system }]
        : []),
      {
        role: 'user' as const,
        content: buildContent(image, prompt),
      },
    ],
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
