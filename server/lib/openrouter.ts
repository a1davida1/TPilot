/**
 * OpenRouter API client for multi-model routing
 * Primary: Grok4 Fast for NSFW-tolerant caption generation
 * Fallback: Claude 3 Opus for text-based captions
 */

import { logger } from '../bootstrap/logger.js';

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> | string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' };
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    code: number;
  };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function openrouterChat(request: OpenRouterRequest): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_BASE_URL ?? 'http://localhost:5000',
      'X-Title': 'ThottoPilot'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data.choices[0]?.message?.content ?? '';
}

export async function generateCaptionsWithFallback(
  imageBase64: string,
  options: { primaryModel?: string; fallbackModel?: string } = {}
): Promise<{ captions: { flirty: string; slutty: string }; category: string; tags: string[] }> {
  const primaryModel = options.primaryModel ?? 'x-ai/grok-4-fast';
  const fallbackModel = options.fallbackModel ?? 'anthropic/claude-3-opus';

  const systemPrompt = `You write short, human, Reddit-safe, suggestive NSFW captions (<200 chars), tasteful, 1-2 emojis max, end with CTA. Avoid banned subreddit words.`;

  const userPrompt = `Analyze this NSFW image and generate two distinct caption styles for Reddit:

FLIRTY: Playful, teasing, flirty tone that highlights pose/outfit/setting without graphic details. Keep it enticing and fun.
SLUTTY: Bold, provocative, adult tone (NSFW-allowed) that teases explicit energy without crossing subreddit rules. Direct, confident, high-heat phrasing.

Return JSON with this exact structure:
{
  "flirty": "string",
  "slutty": "string", 
  "category": "string",
  "tags": ["string"]
}`;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        { type: 'text', text: userPrompt }
      ]
    }
  ];

  try {
    // Try primary model first (Grok4 Fast)
    const response = await openrouterChat({
      model: primaryModel,
      messages,
      max_tokens: 400,
      temperature: 0.8
    });

    return parseJSONResponse(response);
  } catch (primaryError) {
    logger.warn(`Primary model ${primaryModel} failed, falling back to ${fallbackModel}:`, primaryError);

    try {
      // Fallback to Claude 3 Opus (text-only; use descriptors if vision unavailable)
      const response = await openrouterChat({
        model: fallbackModel,
        messages,
        max_tokens: 400,
        temperature: 0.8
      });

      return parseJSONResponse(response);
    } catch (fallbackError) {
      logger.error(`Both models failed:`, fallbackError);
      
      // Last-ditch local template
      return {
        captions: {
          flirty: '✨ Come see what happens next... link in bio 😘',
          slutty: '🔥 Ready to show you everything. DM me 💋'
        },
        category: 'general',
        tags: ['promo']
      };
    }
  }
}

function parseJSONResponse(response: string): { captions: { flirty: string; slutty: string }; category: string; tags: string[] } {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    const parsed = JSON.parse(jsonStr);

    return {
      captions: {
        flirty: parsed.flirty ?? parsed.captions?.[0] ?? '',
        slutty: parsed.slutty ?? parsed.captions?.[1] ?? ''
      },
      category: parsed.category ?? 'general',
      tags: Array.isArray(parsed.tags) ? parsed.tags : []
    };
  } catch (error) {
    logger.error('Failed to parse JSON response:', error);
    throw new Error('Invalid JSON response from model');
  }
}
