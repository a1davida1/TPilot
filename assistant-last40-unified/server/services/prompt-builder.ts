import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Configuration for constructing a chat prompt.
 */
export interface PromptConfig {
  platform: string;
  voice: string;
  style: string;
  theme: string;
  allowsPromotion: boolean;
  userPrompt?: string;
  imageBase64?: string;
  contextDocs?: string[]; // RAG results or brand guidelines
}

interface ImageMessageParam {
  role: 'user';
  content: (
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  )[];
}

const systemTemplate = readFileSync(
  resolve(__dirname, '../../prompts/system.txt'),
  'utf8',
);

/**
 * Build an array of ChatCompletion messages using the config above.
 */
export function buildMessages(cfg: PromptConfig): ChatCompletionMessageParam[] {
  const promotionLine = cfg.allowsPromotion
    ? 'Include subtle promotional elements.'
    : 'Focus on authentic engagement without promotion.';

  const userBlock = [
    `Generate social media content for ${cfg.platform}.`,
    `Style: ${cfg.style}`,
    `Theme: ${cfg.theme}`,
    promotionLine,
    cfg.userPrompt ?? '',
    '',
    'Please provide:',
    '1. Three different title options',
    '2. Engaging post content',
    '3. Photo instructions (lighting, camera angle, composition, styling, mood, technical settings)',
    '4. Relevant hashtags',
    '',
    'Make the content authentic and engaging.',
  ].join('\n');

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemTemplate
        .replace('VOICE', cfg.voice)
        .replace('PLATFORM', cfg.platform),
    },
    { role: 'user', content: userBlock },
  ];

  if (cfg.contextDocs?.length) {
    messages.push({
      role: 'system',
      content:
        'Relevant context:\n' + cfg.contextDocs.map((d) => `- ${d}`).join('\n'),
    });
  }

  if (cfg.imageBase64) {
    const imageMessage: ImageMessageParam = {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this image and incorporate it:' },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${cfg.imageBase64}` },
        },
      ],
    };
    messages.push(imageMessage);
  }

  return messages;
}