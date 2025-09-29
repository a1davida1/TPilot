import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeLog } from '../lib/logger-utils.js';

// Multi-provider AI system for cost optimization
// Priority: Gemini Flash (cheapest) -> Claude Haiku -> OpenAI (fallback)

interface AIProvider {
  name: string;
  inputCost: number; // per 1M tokens
  outputCost: number; // per 1M tokens
  available: boolean;
}

function getProviders(): AIProvider[] {
  return [
    { name: 'gemini-flash', inputCost: 0.075, outputCost: 0.30, available: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) },
    { name: 'claude-haiku', inputCost: 0.80, outputCost: 4.00, available: !!process.env.ANTHROPIC_API_KEY },
    { name: 'openai-gpt4o', inputCost: 5.00, outputCost: 15.00, available: !!process.env.OPENAI_API_KEY }
  ];
}

// Initialize clients dynamically when needed
function getOpenAI() {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

function getAnthropic() {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
}

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  return apiKey ? new GoogleGenerativeAI(apiKey) : null;
}

interface MultiAIRequest {
  user: { id: number; email?: string; tier?: string };
  platform: string;
  imageDescription?: string;
  customPrompt?: string;
  subreddit?: string;
  allowsPromotion: 'yes' | 'no';
  baseImageUrl?: string;
}

interface MultiAIResponse {
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  };
  provider: string;
  estimatedCost: number;
  platform?: string;
}

export async function generateWithMultiProvider(request: MultiAIRequest): Promise<MultiAIResponse> {
  const prompt = buildPrompt(request);

  // Try providers in order of cost efficiency
  for (const provider of getProviders()) {
    if (!provider.available) continue;

    try {
      safeLog('info', 'AI provider attempt', { provider: provider.name, inputCost: provider.inputCost });

      let result: MultiAIResponse | null = null;
      switch (provider.name) {
        case 'gemini-flash':
          result = await generateWithGemini(prompt);
          break;
        case 'claude-haiku':
          result = await generateWithClaude(prompt);
          break;
        case 'openai-gpt4o':
          result = await generateWithOpenAI(prompt);
          break;
        default:
          continue;
      }

      if (result && result.content) {
        safeLog('info', 'AI generation successful', { provider: provider.name });
        return {
          ...result,
          platform: request.platform,
          provider: provider.name,
          estimatedCost: calculateCost(prompt, result.content, provider)
        };
      } else {
        safeLog('warn', 'AI provider returned empty result', { provider: provider.name });
      }
    } catch (error) {
      safeLog('warn', 'AI provider failed, trying next', { provider: provider.name, error: error instanceof Error ? error.message : String(error) });
      continue; // Try next provider
    }
  }

  safeLog('error', 'All AI providers failed - no fallback available', {});
  throw new Error('All AI providers failed');
}

async function generateWithGemini(prompt: string) {
  const gemini = getGemini();
  if (!gemini) return null;

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1500
      }
    });

    const modelResponse = response.response;

    if (!modelResponse) {
      safeLog('warn', 'Gemini provider returned empty response', {});
      return null;
    }


    let text = '';

    if (typeof modelResponse.text === 'function') {
      const responseText = modelResponse.text();
      if (typeof responseText === 'string') {
        text = responseText.trim();
      }
    }

    if (!text) {
      const candidates = (modelResponse as { candidates?: Array<unknown> }).candidates;
      if (Array.isArray(candidates)) {
        for (const candidate of candidates) {
          if (!candidate || typeof candidate !== 'object') {
            continue;
          }
          const content = (candidate as { content?: unknown }).content;
          if (!content || typeof content !== 'object') {
            continue;
          }
          const parts = (content as { parts?: Array<unknown> }).parts;
          if (!Array.isArray(parts)) {
            continue;
          }
          for (const part of parts) {
            if (!part || typeof part !== 'object') {
              continue;
            }
            const partText = (part as { text?: unknown }).text;
            if (typeof partText === 'string' && partText.trim()) {
              text = partText.trim();
              break;
            }
          }
          if (text) {
            break;
          }
                  }
                }
              }
              if (!text) {
                safeLog('warn', 'Gemini provider returned empty response', {});
                return null;
              }
              const trimmedText = text.trim();
              if (trimmedText.length === 0) {
      safeLog('warn', 'Gemini provider returned no text', {});
      return null;
    }

    // Try to parse as JSON, if it fails, create structured response
    let result;
    try {
      result = JSON.parse(trimmedText);
    } catch (parseError) {
      // If not JSON, create a structured response from the text
      const lines = trimmedText.split('\n').filter(line => line.trim());
      result = {
        titles: [`${lines[0] || 'Generated content'} ✨`, 'Creative content generation 🚀', 'Authentic social media posts 💫'],
        content: trimmedText,
        photoInstructions: {
          lighting: 'Natural lighting preferred',
          cameraAngle: 'Eye level angle',
          composition: 'Center composition',
          styling: 'Authentic styling',
          mood: 'Confident and natural',
          technicalSettings: 'Auto settings'
        }
      };
    }

    safeLog('info', 'Gemini generation completed successfully', {});
    return validateAndFormatResponse(result);
  } catch (error) {
    safeLog('warn', 'Gemini generation failed', { error: error instanceof Error ? error.message : String(error) });
    return null; // Don't throw, just return null to try next provider
  }
}

async function generateWithClaude(prompt: string) {
  const anthropic = getAnthropic();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 1500,
    system: "You are an expert social media content creator specializing in adult content creation. Create engaging, authentic content that respects platform guidelines while being appealing and personality-driven. Always respond with valid JSON.",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }
  const result = JSON.parse(textBlock.text);
  return validateAndFormatResponse(result);
}

async function generateWithOpenAI(prompt: string) {
  const openai = getOpenAI();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert social media content creator specializing in adult content creation. Create engaging, authentic content that respects platform guidelines while being appealing and personality-driven."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 1500,
    temperature: 0.8
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return validateAndFormatResponse(result);
}

function validateAndFormatResponse(result: unknown) {
  const res = result as Record<string, unknown>;
  let content = res?.content as string;
  if (!content || content === 'Generated content' || (typeof content === 'string' && content.length < 20)) {
    // Create engaging fallback content based on titles
    const firstTitle = Array.isArray(res?.titles) && res.titles[0] ? res.titles[0] : 'New content';
    content = `${firstTitle}\n\nHey everyone! 💕 Just wanted to share this moment with you all. There's something magical about capturing authentic moments that show who you really are. This one definitely has that special energy I love to share with you.\n\nWhat do you think? Drop a comment and let me know your thoughts! ✨`;
  }

  return {
    titles: Array.isArray(res?.titles) ? res.titles.slice(0, 3) : ['Generated Title'],
    content: content,
    photoInstructions: {
      lighting: (res?.photoInstructions as Record<string, unknown>)?.lighting as string || 'Natural lighting preferred',
      cameraAngle: (res?.photoInstructions as Record<string, unknown>)?.cameraAngle as string || 'Eye level angle',
      composition: (res?.photoInstructions as Record<string, unknown>)?.composition as string || 'Center composition',
      styling: (res?.photoInstructions as Record<string, unknown>)?.styling as string || 'Casual styling',
      mood: (res?.photoInstructions as Record<string, unknown>)?.mood as string || 'Confident and natural',
      technicalSettings: (res?.photoInstructions as Record<string, unknown>)?.technicalSettings as string || 'Auto settings'
    },
    provider: 'unknown',
    estimatedCost: 0
  };
}

function buildPrompt(request: MultiAIRequest): string {
  const { user, platform, imageDescription, customPrompt, subreddit, allowsPromotion } = request;
  // Default profile based on user tier
  const profile = {
    toneOfVoice: 'friendly',
    contentStyle: 'authentic',
    personalBrand: 'content creator',
    contentLength: 'medium',
    includeEmojis: true
  };

  let mainPrompt = '';
  if (customPrompt) {
    mainPrompt = `Create content based on this request: "${customPrompt}"`;
  } else if (imageDescription) {
    mainPrompt = `Create content based on this image: ${imageDescription}`;
  } else {
    mainPrompt = 'Create engaging content that fits my personality and brand.';
  }

  const platformHint = platform === 'reddit'
    ? `Use Reddit markdown and community tone${subreddit ? ` for r/${subreddit}` : ''}.`
    : platform === 'instagram'
    ? 'Write in Instagram caption style with hashtag suggestions.'
    : platform === 'x'
    ? 'Keep responses concise for Twitter/X.'
    : platform === 'tiktok'
    ? 'Focus on short hooks suitable for TikTok.'
    : '';

  return `
You are creating content for ${platform}${subreddit ? ` (specifically for r/${subreddit})` : ''}.
${platformHint}

User Profile:
- Tone: ${profile.toneOfVoice}
- Style: ${profile.contentStyle}
- Brand: ${profile.personalBrand}
- Length: ${profile.contentLength}
- Emojis: ${profile.includeEmojis ? 'Include' : 'No emojis'}
- Promotion: ${allowsPromotion === 'yes' ? 'Promotional content allowed' : 'Keep it subtle'}

${mainPrompt}

Please respond with JSON in this exact format:
{
  "titles": ["title1", "title2", "title3"],
  "content": "main post content",
  "photoInstructions": {
    "lighting": "lighting description",
    "cameraAngle": "camera angle description",
    "composition": "composition description",
    "styling": "styling description",
    "mood": "mood description",
    "technicalSettings": "technical settings description"
  }
}

Generate 3 different title options. Make the content engaging and authentic.
${profile.includeEmojis ? 'Include appropriate emojis.' : 'Do not use emojis.'}
Content length should be ${profile.contentLength}.
`;
}

function calculateCost(prompt: string, content: string, provider: AIProvider): number {
  // Rough token estimation (1 token ≈ 4 characters)
  const inputTokens = prompt.length / 4;
  const outputTokens = content.length / 4;

  const cost = (inputTokens * provider.inputCost / 1000000) + (outputTokens * provider.outputCost / 1000000);
  return Math.round(cost * 100000) / 100000; // Round to 5 decimal places
}


export function getProviderStatus() {
  return getProviders().map(p => ({
    name: p.name,
    available: p.available,
    inputCost: p.inputCost,
    outputCost: p.outputCost,
    savings: Math.round((1 - p.inputCost / 5.00) * 100) // Savings vs OpenAI baseline
  }));
}