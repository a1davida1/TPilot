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
  { name: 'gemini-flash', inputCost: 0.075, outputCost: 0.30, available: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) },
  { name: 'claude-haiku', inputCost: 0.80, outputCost: 4.00, available: !!process.env.ANTHROPIC_API_KEY },
  { name: 'openai-gpt4o', inputCost: 5.00, outputCost: 15.00, available: !!process.env.OPENAI_API_KEY }
];

// Initialize clients only if API keys are available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY }) : null;

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
  
  try {
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini request timeout')), 15000); // 15 second timeout
    });
    
    const generationPromise = gemini.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1500,
        responseMimeType: "application/json"
      }
    });
    
    const response = await Promise.race([generationPromise, timeoutPromise]);
    
    if (!response || !response.response) {
      throw new Error('Empty response from Gemini');
    }
    
    const text = response.response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('No text in Gemini response');
    }
    
    const result = JSON.parse(text);
    console.log('Gemini generated successfully:', Object.keys(result));
    return validateAndFormatResponse(result);
  } catch (error) {
    console.error('Gemini generation failed:', error instanceof Error ? error.message : String(error));
    throw error; // Let the multi-provider system try the next provider
  }
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
  // Generate actual content if missing or placeholder
  let content = result.content;
  if (!content || content === 'Generated content' || content.length < 20) {
    // Create engaging fallback content based on titles
    const firstTitle = Array.isArray(result.titles) && result.titles[0] ? result.titles[0] : 'New content';
    content = `${firstTitle}\n\nHey everyone! 💕 Just wanted to share this moment with you all. There's something magical about capturing authentic moments that show who you really are. This one definitely has that special energy I love to share with you.\n\nWhat do you think? Drop a comment and let me know your thoughts! ✨`;
  }
  
  return {
    titles: Array.isArray(result.titles) ? result.titles.slice(0, 3) : ['Generated Title'],
    content: content,
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
  
  // Create context-aware demo titles based on the request
  let demoTitles: string[];
  let demoContent: string;
  
  if (customPrompt?.includes('workout') || customPrompt?.includes('athletic') || customPrompt?.includes('fit')) {
    demoTitles = [
      'Post-workout glow hitting different today 💪✨',
      'When your gym clothes make you feel unstoppable 🔥',
      'Sweaty, strong, and feeling absolutely amazing 💦'
    ];
    demoContent = `Post-workout glow hitting different today 💪✨\n\nJust finished an incredible workout session and I'm feeling so strong and confident! There's something about pushing your limits that makes you appreciate what your body can do. This activewear is making me feel like I can conquer the world.\n\nWho else is feeling that post-gym high today? Drop a 💪 if you crushed your workout too!`;
  } else if (customPrompt?.includes('shower') || customPrompt?.includes('steam')) {
    demoTitles = [
      'Steamy shower vibes, who\'s joining? 😉',
      'Just me, the steam, and pure relaxation 💦',
      'Fresh out of the shower and feeling amazing ✨'
    ];
    demoContent = `Steamy shower vibes, who's joining? 😉\n\nThere's something so therapeutic about a long, hot shower after a busy day. The steam, the warmth, the moment of pure relaxation - it's like hitting the reset button on everything.\n\nWhat's your favorite way to unwind? Tell me in the comments! 💭`;
  } else {
    demoTitles = [
      'Feeling confident and loving every moment ✨',
      'Just being authentically me, hope you love it 💕',
      'Living my best life, one post at a time 🌟'
    ];
    demoContent = `Feeling confident and loving every moment ✨\n\nHey beautiful souls! Just wanted to share this moment with you all. There's something magical about embracing who you are and sharing that energy with people who appreciate authenticity.\n\nWhat's making you feel confident today? Let's spread some positive vibes! 💫`;
  }

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