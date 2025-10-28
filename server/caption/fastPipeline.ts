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

interface FastPipelineParams {
  imageUrl: string;
  platform: 'instagram' | 'x' | 'reddit' | 'tiktok';
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

const FALLBACK_CAPTIONS = [
  {
    caption: "Check out this amazing content!",
    alt: "Engaging visual content showcasing creative work and authentic moments.",
    hashtags: ["content", "creative", "authentic"],
    cta: "Link in bio",
    mood: "excited",
    style: "casual",
    safety_level: "sfw",
    nsfw: false,
    titles: ["Amazing Content", "Creative Showcase"]
  },
  {
    caption: "Excited to share this with you today!",
    alt: "A special moment captured and ready to share with the community.",
    hashtags: ["share", "moment", "today"],
    cta: "Check it out",
    mood: "happy",
    style: "friendly",
    safety_level: "sfw",
    nsfw: false,
    titles: ["Today's Share", "Special Moment"]
  },
  {
    caption: "Something special I wanted to show you!",
    alt: "Unique content featuring authentic personality and creative expression.",
    hashtags: ["special", "unique", "authentic"],
    cta: "More in bio",
    mood: "warm",
    style: "personal",
    safety_level: "sfw",
    nsfw: false,
    titles: ["Something Special", "For You"]
  }
];

/**
 * Get fallback captions when AI generation fails
 */
export function getFallbackCaptions(platform: string): z.infer<typeof CaptionItem>[] {
  logger.warn('[FastPipeline] Using fallback captions', { platform });
  return FALLBACK_CAPTIONS;
}

/**
 * Get platform-specific length guidance
 */
function getPlatformLength(platform: string): string {
  switch (platform) {
    case 'x':
      return '50-250 chars';
    case 'instagram':
      return '150-500 chars recommended';
    case 'tiktok':
      return '150-220 chars';
    case 'reddit':
      return '100-300 chars, focus on title';
    default:
      return '100-300 chars';
  }
}

/**
 * Get platform-specific rules
 */
function getPlatformRules(platform: string): string {
  switch (platform) {
    case 'x':
      return `- 250 char max caption
- 0-3 hashtags max
- Concise, punchy, conversational`;

    case 'instagram':
      return `- 2200 char max caption
- 3-8 hashtags required
- Longer, storytelling style OK`;

    case 'tiktok':
      return `- 150-220 chars (strict)
- 2-5 hashtags required
- Trending, energetic tone`;

    case 'reddit':
      return `- NO hashtag spam (Reddit hates #tags)
- Title is CRITICAL (max 64 chars, 9 words)
- Caption can be longer, conversational
- Focus on community value`;

    default:
      return '- Be authentic and engaging';
  }
}

/**
 * Build simplified prompt for fast generation
 */
function buildFastPrompt(params: FastPipelineParams): string {
  const { platform, voice, nsfw, style, mood, promotionMode, promotionalUrl, personalization } = params;

  let prompt = `You are the woman in this image. Write 3 first-person captions for ${platform}.

**CORE PRINCIPLE:**
React to what's happening, don't describe what you see.
Write like you're texting someone during/after the moment.

**OUTPUT FORMAT (JSON):**
[
  {
    "caption": "the post text (${getPlatformLength(platform)})",
    "alt": "20-200 char accessibility text",
    "hashtags": ["word1", "word2"],
    "cta": "call to action",
    "mood": "${mood || 'choose based on image'}",
    "style": "${style || 'authentic'}",
    "safety_level": "${nsfw ? 'nsfw' : 'sfw'}",
    "nsfw": ${nsfw || false},
    "titles": ["title option 1", "title option 2"]
  }
]

**PLATFORM RULES (${platform}):**
${getPlatformRules(platform)}

**VOICE & TONE:**
${voice ? `Voice: ${voice} - Be authentic to this personality` : 'Natural, conversational, authentic'}
${style ? `Style: ${style}` : ''}
${mood ? `Mood: ${mood}` : ''}
`;

  // Add NSFW guidance if needed
  if (nsfw) {
    prompt += `
**NSFW GUIDANCE:**
- Be suggestive but not explicit
- Focus on empowerment and confidence
- Tease what's in the content without being vulgar
- Keep it playful and flirty
`;
  }

  // Add promotional guidance if needed
  if (promotionMode === 'explicit' && promotionalUrl) {
    prompt += `
**PROMOTION:**
Include a natural call-to-action mentioning: ${promotionalUrl}
Make it feel organic, not spammy.
`;
  } else if (promotionMode === 'subtle') {
    prompt += `
**PROMOTION:**
Subtle hint about exclusive content without direct links.
`;
  }

  // Add personalization context
  if (personalization?.promptLines && personalization.promptLines.length > 0) {
    prompt += `
**PERSONALIZATION:**
${personalization.promptLines.join('\n')}
`;
  }

  prompt += `
**AUTHENTICITY CHECKLIST:**
- Use contractions (I'm, you're, can't, won't)
- React to the moment, don't narrate
- Keep it real - no "amazing content" or "check it out" unless natural
- Match the energy of the image
- Be specific, not generic

**RESPOND WITH VALID JSON ONLY - NO MARKDOWN, NO EXPLANATIONS**`;

  return prompt;
}

/**
 * Parse AI response and extract captions
 */
function parseResponse(response: string): z.infer<typeof CaptionItem>[] {
  try {
    // Try to extract JSON from response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Try to find JSON array in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const captions = Array.isArray(parsed) ? parsed : [parsed];

    // Validate each caption
    return captions.map(c => CaptionItem.parse(c));
  } catch (error) {
    logger.error('[FastPipeline] Failed to parse response', {
      error: error instanceof Error ? error.message : String(error),
      response: response.substring(0, 500)
    });
    throw new FastPipelineError('Failed to parse AI response', error);
  }
}

/**
 * Quick quality score (client-side, no API call)
 */
function quickScore(caption: z.infer<typeof CaptionItem>): number {
  let score = 100;
  const text = caption.caption.toLowerCase();

  // Penalize AI fingerprints (signs of generic AI output)
  const aiFingerprintPhrases = [
    'amazing content',
    'check it out',
    '✨',
    'excited to share',
    "can't wait for you to see"
  ];

  for (const phrase of aiFingerprintPhrases) {
    if (text.includes(phrase)) {
      score -= 30;
    }
  }

  // Reward authenticity signals
  if (/\b(fuck|shit|damn|hell)\b/i.test(text)) score += 10;
  if (/can't|won't|i'm|you're/i.test(text)) score += 5;
  if (/\brn\b/.test(text)) score += 5; // "rn" (right now) is authentic

  // Penalize too long or too short
  if (caption.caption.length > 250) score -= 20;
  if (caption.caption.length < 10) score -= 30;

  // Reward specific details (numbers, specific words)
  if (/\d/.test(text)) score += 5;

  // Penalize generic hashtags
  const genericHashtags = ['love', 'instagood', 'follow', 'like'];
  for (const tag of caption.hashtags) {
    if (genericHashtags.includes(tag.toLowerCase().replace('#', ''))) {
      score -= 10;
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

    // Parse response
    let captions = parseResponse(response);

    // Ensure we have at least 2 captions
    if (captions.length < 2) {
      logger.warn('[FastPipeline] Insufficient captions generated, using fallback');
      const fallback = getFallbackCaptions(params.platform);
      captions = [...captions, ...fallback].slice(0, 3);
    }

    // Score and rank captions
    const scored = captions.map(caption => ({
      caption,
      score: quickScore(caption),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Check platform compliance for top variants
    const topVariants: z.infer<typeof CaptionItem>[] = [];
    for (const item of scored) {
      const error = platformChecks(params.platform, item.caption);
      if (!error) {
        topVariants.push(item.caption);
      }
      if (topVariants.length >= 2) break;
    }

    // If we don't have 2 compliant variants, add fallback
    if (topVariants.length < 2) {
      logger.warn('[FastPipeline] Insufficient compliant variants, adding fallback');
      const fallback = getFallbackCaptions(params.platform);
      topVariants.push(...fallback.slice(0, 2 - topVariants.length));
    }

    const executionTimeMs = Date.now() - startTime;

    logger.info('[FastPipeline] Generation complete', {
      executionTimeMs,
      variantsGenerated: captions.length,
      topScore: scored[0]?.score || 0,
      userId: params.userId,
    });

    return {
      provider: 'fast-pipeline',
      final: topVariants[0],
      topVariants: topVariants.slice(0, 2),
      executionTimeMs,
      promptTokens: Math.ceil(prompt.length / 4),
    };

  } catch (error) {
    logger.error('[FastPipeline] Generation failed', {
      error: error instanceof Error ? error.message : String(error),
      platform: params.platform,
      userId: params.userId,
    });

    // Return fallback on any error
    const fallback = getFallbackCaptions(params.platform);
    return {
      provider: 'fallback',
      final: fallback[0],
      topVariants: fallback.slice(0, 2),
      executionTimeMs: Date.now() - startTime,
      promptTokens: 0,
    };
  }
}
