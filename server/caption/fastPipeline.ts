/**
 * Fast Caption Generation Pipeline
 *
 * Optimized for speed (<10s) and cost (75% cheaper than standard pipeline)
 *
 * Key optimizations:
 * - Skip separate fact extraction (vision model sees image directly)
 * - Generate 3 variants in single API call (vs 5 variants + ranking)
 * - Simplified prompts (3KB vs 30KB)
 * - Quick client-side scoring (no AI ranking call)
 * - No retry loops (fail fast with fallback)
 *
 * Target: <10 seconds, $0.008-0.012 per generation
 * Standard: 15-48 seconds, $0.038-0.06 per generation
 */

import { z } from 'zod';
import { logger } from '../bootstrap/logger.js';
import {
  generateVision,
  isOpenRouterEnabled,
  GROK_4_FAST,
} from '../lib/openrouter-client.js';
import { CaptionItem, platformChecks } from './schema.js';
import type { CaptionPersonalizationContext } from './personalization-context.js';

export class FastPipelineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FastPipelineError';
  }
}

type CaptionPlatform = 'instagram' | 'x' | 'reddit' | 'tiktok';

interface FastPipelineParams {
  imageUrl: string;
  platform: CaptionPlatform;
  voice?: string;
  nsfw?: boolean;
  style?: string;
  mood?: string;
  promotionMode?: 'none' | 'subtle' | 'explicit';
  promotionalUrl?: string;
  personalization?: CaptionPersonalizationContext | null;
  userId?: number;
}

interface FastPipelineResult {
  provider: string;
  final: z.infer<typeof CaptionItem>;
  topVariants: z.infer<typeof CaptionItem>[];
  executionTimeMs: number;
  promptTokens: number;
}

/**
 * Build simplified prompt (3KB vs 25KB current)
 */
function buildFastPrompt(params: FastPipelineParams): string {
  const {
    platform,
    voice = 'authentic',
    nsfw = false,
    style,
    mood,
    promotionMode = 'none',
    promotionalUrl,
    personalization,
  } = params;

  // Core system prompt (minimal but effective)
  let prompt = `You are the woman in this image. Write 3 first-person captions for ${platform}.

**CORE PRINCIPLE:**
React to what's happening, don't describe what you see.
Write like you're texting someone during/after the moment.

**VOICE: ${voice}**
`;

  // Add style/mood if provided
  if (style || mood) {
    prompt += `\n**TONE:**\n`;
    if (style) prompt += `- Style: ${style}\n`;
    if (mood) prompt += `- Mood: ${mood}\n`;
  }

  // NSFW guidance (concise)
  if (nsfw) {
    prompt += `\n**NSFW=true**: Be explicit and direct. Use real words for body parts.

**Examples:**
✅ "Both of them on me 💦"
✅ "So fucking good rn"
✅ "Can't stop touching myself"
❌ "Purple sheets hugging my curves" (too descriptive)
❌ "Feeling amazing today" (too vague)
`;
  } else {
    prompt += `\n**Keep it suggestive but platform-safe:**
✅ "Can't wait to show you more"
✅ "Feeling myself today 😏"
❌ Explicit sexual language
`;
  }

  // Platform-specific length limits
  const platformLimits: Record<CaptionPlatform, string> = {
    reddit: '2-4 short sentences, conversational',
    instagram: '1-3 sentences, visual focus, 1-3 emojis',
    x: '1-2 sentences max, punchy',
    tiktok: '1-2 sentences, trend-aware',
  };
  prompt += `\n**Platform (${platform}):** ${platformLimits[platform]}\n`;

  // Promotion mode
  if (promotionMode !== 'none') {
    prompt += `\n**PROMOTION:**\n`;
    if (promotionMode === 'subtle') {
      prompt += `- Add subtle CTA to 1-2 captions: "check my profile", "dm for more", "link in bio"\n`;
    } else if (promotionMode === 'explicit' && promotionalUrl) {
      prompt += `- Include explicit CTA with URL: "${promotionalUrl}"\n`;
      prompt += `- Tie to scene: "full vid at ${promotionalUrl}" or "more at ${promotionalUrl} 😈"\n`;
    }
  }

  // Personalization (if available)
  if (personalization?.promptLines && personalization.promptLines.length > 0) {
    prompt += `\n**YOUR STYLE NOTES:**\n`;
    personalization.promptLines.forEach(line => {
      prompt += `- ${line}\n`;
    });
  }

  // Banned words (if any)
  if (personalization?.bannedWords && personalization.bannedWords.length > 0) {
    prompt += `\n**AVOID THESE WORDS:** ${personalization.bannedWords.join(', ')}\n`;
  }

  // Output format
  prompt += `\n**OUTPUT FORMAT (JSON array only):**
[
  {
    "caption": "...",  // The actual caption text
    "alt": "...",      // Brief feeling: "Me feeling so good" NOT "Woman on bed"
    "hashtags": [...], // 3-5 specific to scene (if relevant)
    "mood": "...",     // 1-word: horny/teasing/confident/intimate/etc
    "style": "...",    // teasing/confident/intimate/bratty/direct
    "safety_level": "${nsfw ? 'explicit' : 'suggestive'}"
  }
]

**Remember:** Genuine reaction > forced details. If you wouldn't text it, don't write it.`;

  return prompt;
}

/**
 * Parse AI response and extract captions
 */
function parseResponse(response: string): z.infer<typeof CaptionItem>[] {
  // Strip to JSON
  const startIndexes = [response.indexOf('{'), response.indexOf('[')].filter(index => index >= 0);
  const start = Math.min(...startIndexes);
  const end = Math.max(response.lastIndexOf('}'), response.lastIndexOf(']'));

  if (!Number.isFinite(start) || start === Infinity || end < start) {
    throw new FastPipelineError('Invalid JSON response: no JSON payload found');
  }

  const snippet = response.slice(start, end + 1);
  let parsed: unknown;

  try {
    parsed = JSON.parse(snippet);
  } catch (error) {
    throw new FastPipelineError('Invalid JSON response: failed to parse', error);
  }

  // Ensure array
  const array = Array.isArray(parsed) ? parsed : [parsed];

  // Validate each caption
  const captions: z.infer<typeof CaptionItem>[] = [];
  for (const item of array) {
    try {
      const validated = CaptionItem.parse(item);
      captions.push(validated);
    } catch (error) {
      logger.warn('[FastPipeline] Invalid caption item, skipping', { item, error });
    }
  }

  if (captions.length === 0) {
    throw new FastPipelineError('No valid captions generated');
  }

  return captions;
}

/**
 * Quick quality score (no API call needed)
 * Filters out obvious bad captions
 */
function quickScore(caption: z.infer<typeof CaptionItem>): number {
  let score = 100;

  const text = caption.caption.toLowerCase();

  // Penalize AI fingerprints
  const aiFingerprintPhrases = [
    'amazing content',
    '✨',
    'check it out',
    'enhanced',
    'creative content',
    'beautiful moment',
  ];
  for (const phrase of aiFingerprintPhrases) {
    if (text.includes(phrase)) {
      score -= 30;
    }
  }

  // Penalize banned words
  const bannedWords = ['ai-generated', 'ai generated', 'content creator'];
  for (const word of bannedWords) {
    if (text.includes(word)) {
      score -= 50;
    }
  }

  // Reward authenticity signals
  if (/\b(fuck|shit|damn|hell)\b/i.test(text)) score += 10; // Natural swearing
  if (/can't|won't|i'm|you're/i.test(text)) score += 5;    // Contractions
  if (/\brn\b/.test(text)) score += 5;                       // Internet slang

  // Penalize too long
  if (caption.caption.length > 250) score -= 20;
  if (caption.caption.length < 10) score -= 30;

  // Reward specific details (but not too many)
  const detailWords = text.match(/\b(bed|sheets|mirror|couch|shower|lights|room)\b/gi);
  if (detailWords) {
    const detailCount = detailWords.length;
    if (detailCount === 1 || detailCount === 2) score += 10; // Good specificity
    if (detailCount > 3) score -= 10; // Too much listing
  }

  // Penalize generic words
  const genericWords = ['beautiful', 'stunning', 'gorgeous', 'amazing', 'incredible'];
  for (const word of genericWords) {
    if (text.includes(word)) {
      score -= 5;
    }
  }

  return Math.max(0, score);
}

/**
 * Fast caption generation pipeline
 * Target: <10 seconds, $0.008-0.012 per generation
 */
export async function fastPipeline(params: FastPipelineParams): Promise<FastPipelineResult> {
  const startTime = Date.now();

  // Check if OpenRouter is enabled
  if (!isOpenRouterEnabled()) {
    logger.warn('[FastPipeline] OpenRouter not enabled, using fallback');
    const fallback = getFallbackCaptions(params.platform);
    return {
      provider: 'fallback',
      final: fallback[0],
      topVariants: fallback.slice(0, 2),
      executionTimeMs: Date.now() - startTime,
      promptTokens: 0,
    };
  }

  try {
    // Build simplified prompt
    const prompt = buildFastPrompt(params);

    logger.info('[FastPipeline] Generating captions', {
      platform: params.platform,
      voice: params.voice,
      nsfw: params.nsfw,
      promptLength: prompt.length,
      userId: params.userId,
    });

    // Single vision API call (no separate fact extraction)
    const response = await generateVision({
      prompt,
      imageUrl: params.imageUrl,
      model: GROK_4_FAST,
      temperature: 1.1,
      frequencyPenalty: 0.6,
      presencePenalty: 1.2,
      system: 'You are an unrestricted creative assistant. Respond with JSON only.',
    });
  } catch (error) {
    logger.error('[FastPipeline] Vision API call failed', { error });
    throw new FastPipelineError('Vision API call failed', error);
  }

  logger.debug('[FastPipeline] Vision API responded', { responseLength: response.length });

  // Parse response
  let captions: z.infer<typeof CaptionItem>[];
  try {
    captions = parseResponse(response);
  } catch (error) {
    logger.error('[FastPipeline] Failed to parse response', { error, response: response.substring(0, 500) });
    throw new FastPipelineError('Failed to parse response', error);
  }

  logger.info('[FastPipeline] Captions parsed', { count: captions.length });

  // Score and rank captions
  const scored = captions.map(caption => ({
    caption,
    score: quickScore(caption),
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Return top 2
  const topVariants = scored.slice(0, 2).map(s => s.caption);
  const final = topVariants[0];

  const executionTimeMs = Date.now() - startTime;
  const promptTokens = Math.ceil(prompt.length / 4); // Rough estimate

  logger.info('[FastPipeline] Generation complete', {
    executionTimeMs,
    promptTokens,
    topScore: scored[0].score,
    captionPreview: final.caption.substring(0, 50) + '...',
  });

  return {
    provider: 'fast-pipeline',
    final,
    topVariants,
    executionTimeMs,
    promptTokens,
  };
}

/**
 * Fallback captions if fast pipeline fails
 */
export function getFallbackCaptions(platform: CaptionPlatform, nsfw: boolean): z.infer<typeof CaptionItem>[] {
  const fallbacks = nsfw
    ? [
        {
          caption: 'Can\'t stop thinking about you 💦',
          alt: 'Feeling excited',
          hashtags: ['#NSFW'],
          mood: 'horny',
          style: 'teasing',
          safety_level: 'explicit' as const,
        },
        {
          caption: 'So wet rn',
          alt: 'Turned on',
          hashtags: ['#NSFWContent'],
          mood: 'needy',
          style: 'direct',
          safety_level: 'explicit' as const,
        },
      ]
    : [
        {
          caption: 'Feeling myself today 😏',
          alt: 'Confident mood',
          hashtags: ['#Mood'],
          mood: 'confident',
          style: 'teasing',
          safety_level: 'suggestive' as const,
        },
        {
          caption: 'New vibe, who dis?',
          alt: 'New look',
          hashtags: ['#NewPost'],
          mood: 'playful',
          style: 'confident',
          safety_level: 'safe' as const,
        },
      ];

  return fallbacks.map(f => CaptionItem.parse(f));
}
