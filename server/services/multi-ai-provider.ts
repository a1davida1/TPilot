import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

// Multi-provider AI system for cost optimization
// Priority: Gemini Flash (cheapest) -> Claude Haiku -> OpenAI (fallback)

interface AIProvider {
  name: string;
  inputCost: number; // per 1M tokens
  outputCost: number; // per 1M tokens
  available: boolean;
}

const providers: AIProvider[] = [
  { name: 'gemini-flash', inputCost: 0.075, outputCost: 0.30, available: !!process.env.GEMINI_API_KEY },
  { name: 'claude-haiku', inputCost: 0.80, outputCost: 4.00, available: !!process.env.ANTHROPIC_API_KEY },
  { name: 'openai-gpt4o', inputCost: 5.00, outputCost: 15.00, available: !!process.env.OPENAI_API_KEY }
];

// Initialize clients only if API keys are available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

interface MultiAIRequest {
  user: any;
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
}

export async function generateWithMultiProvider(request: MultiAIRequest): Promise<MultiAIResponse> {
  const prompt = buildPrompt(request);
  
  // Try providers in order of cost efficiency
  for (const provider of providers) {
    if (!provider.available) continue;
    
    try {
      console.log(`Attempting generation with ${provider.name} (input: $${provider.inputCost}/1M tokens)`);
      
      let result;
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
      
      if (result) {
        return {
          ...result,
          provider: provider.name,
          estimatedCost: calculateCost(prompt, result.content, provider)
        };
      }
    } catch (error) {
      console.error(`${provider.name} failed:`, error instanceof Error ? error.message : String(error));
      continue; // Try next provider
    }
  }
  
  // If all providers fail, return demo content
  console.log('All AI providers failed, using demo content');
  return generateDemoContent(request);
}

async function generateWithGemini(prompt: string) {
  if (!gemini) return null;
  
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          titles: { type: "array", items: { type: "string" } },
          content: { type: "string" },
          photoInstructions: {
            type: "object",
            properties: {
              lighting: { type: "string" },
              cameraAngle: { type: "string" },
              composition: { type: "string" },
              styling: { type: "string" },
              mood: { type: "string" },
              technicalSettings: { type: "string" }
            }
          }
        }
      }
    }
  });
  
  const result = JSON.parse(response.text || '{}');
  return validateAndFormatResponse(result);
}

async function generateWithClaude(prompt: string) {
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

function validateAndFormatResponse(result: any) {
  return {
    titles: Array.isArray(result.titles) ? result.titles.slice(0, 3) : ['Generated Title'],
    content: result.content || 'Generated content',
    photoInstructions: {
      lighting: result.photoInstructions?.lighting || 'Natural lighting preferred',
      cameraAngle: result.photoInstructions?.cameraAngle || 'Eye level angle',
      composition: result.photoInstructions?.composition || 'Center composition',
      styling: result.photoInstructions?.styling || 'Casual styling',
      mood: result.photoInstructions?.mood || 'Confident and natural',
      technicalSettings: result.photoInstructions?.technicalSettings || 'Auto settings'
    }
  };
}

function buildPrompt(request: MultiAIRequest): string {
  const { user, platform, imageDescription, customPrompt, subreddit, allowsPromotion } = request;
  const profile = user.personalityProfile;
  
  let mainPrompt = '';
  if (customPrompt) {
    mainPrompt = `Create content based on this request: "${customPrompt}"`;
  } else if (imageDescription) {
    mainPrompt = `Create content based on this image: ${imageDescription}`;
  } else {
    mainPrompt = 'Create engaging content that fits my personality and brand.';
  }

  return `
You are creating content for ${platform}${subreddit ? ` (specifically for r/${subreddit})` : ''}.

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

function generateDemoContent(request: MultiAIRequest): MultiAIResponse {
  const { customPrompt, platform, allowsPromotion } = request;
  
  const demoTitles = [
    "Just had the most amazing day! ✨",
    "Feeling confident and loving life 💫",
    "Sometimes you just gotta shine your own light ✨"
  ];
  
  const demoContent = customPrompt 
    ? `Here's some engaging content based on your prompt: "${customPrompt}"\n\nThis is a demo of what ThottoPilot can create for you! The actual AI would generate personalized content that matches your voice and style perfectly. ${allowsPromotion === 'yes' ? 'With promotion-friendly messaging included!' : 'Keeping things subtle and authentic.'}\n\nSign up to unlock the full AI generator with real integration! 🚀`
    : `This is a demo of ThottoPilot's AI content generation! 🎉\n\nIn the full version, I would create personalized ${platform} content that matches your exact voice, style, and brand. Every post would be tailored to your personality profile and optimized for maximum engagement.\n\nReady to see what real AI-generated content can do for your growth? Sign up now! ✨`;

  return {
    titles: demoTitles,
    content: demoContent,
    photoInstructions: {
      lighting: "Soft natural light from a window - creates a warm, inviting glow that's flattering and professional",
      cameraAngle: "Slightly above eye level - this angle is universally flattering and creates connection with viewers",
      composition: "Rule of thirds with you positioned off-center - creates visual interest and professional-looking shots",
      styling: "Your signature style with a touch of confidence - wear what makes you feel amazing and authentic",
      mood: "Confident, approachable, and genuinely happy - let your personality shine through naturally",
      technicalSettings: "Portrait mode with soft background blur - keeps focus on you while creating depth"
    },
    provider: 'demo',
    estimatedCost: 0
  };
}

export function getProviderStatus() {
  return providers.map(p => ({
    name: p.name,
    available: p.available,
    inputCost: p.inputCost,
    outputCost: p.outputCost,
    savings: Math.round((1 - p.inputCost / 5.00) * 100) // Savings vs OpenAI baseline
  }));
}