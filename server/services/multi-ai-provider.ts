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
  { name: 'openai-gpt4o', inputCost: 5.00, outputCost: 15.00, available: !!process.env.OPENAI_API_KEY },
  { name: 'claude-haiku', inputCost: 0.80, outputCost: 4.00, available: !!process.env.ANTHROPIC_API_KEY },
  { name: 'gemini-flash', inputCost: 0.075, outputCost: 0.30, available: false } // Disabled for now
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
      
      let result: any = null;
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
        console.log(`Successfully generated content with ${provider.name}`);
        return {
          ...result,
          provider: provider.name,
          estimatedCost: calculateCost(prompt, result.content, provider)
        };
      } else {
        console.log(`${provider.name} returned null, trying next provider`);
      }
    } catch (error) {
      console.log(`${provider.name} encountered error, trying next provider:`, error instanceof Error ? error.message : String(error));
      continue; // Try next provider
    }
  }
  
  // If all providers fail, return demo content
  console.log('All AI providers failed, using demo content');
  // Pass style and theme from unified request to demo generator
  const demoRequest = {
    ...request,
    style: (request as any).style,
    theme: (request as any).theme
  };
  return generateDemoContent(demoRequest);
}

async function generateWithGemini(prompt: string) {
  if (!gemini) return null;
  
  try {
    // Use the text generation method for @google/genai
    const response = await gemini.generateText({
      prompt: prompt,
      temperature: 0.8,
      maxOutputTokens: 1500
    });
    
    if (!response || !response.text) {
      console.log('Gemini: Empty response, skipping to next provider');
      return null;
    }
    
    const text = response.text.trim();
    if (text.length === 0) {
      console.log('Gemini: No text in response, skipping to next provider');
      return null;
    }
    
    // Try to parse as JSON, if it fails, create structured response
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      // If not JSON, create a structured response from the text
      const lines = text.split('\n').filter(line => line.trim());
      result = {
        titles: [`${lines[0] || 'Generated content'} ✨`, 'Creative content generation 🚀', 'Authentic social media posts 💫'],
        content: text,
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
    
    console.log('Gemini generated successfully');
    return validateAndFormatResponse(result);
  } catch (error) {
    console.log('Gemini generation failed, trying next provider:', error instanceof Error ? error.message : String(error));
    return null; // Don't throw, just return null to try next provider
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
  const { customPrompt, platform, allowsPromotion, user, style: requestStyle } = request;
  
  // Use the style parameter sent from the frontend (preset ID) as the primary source
  const contentStyle = requestStyle || user?.personalityProfile?.contentStyle || '';
  
  console.log('generateDemoContent - contentStyle:', contentStyle, 'requestStyle:', requestStyle);
  
  // Create context-aware demo titles based on the preset style
  let demoTitles: string[];
  let demoContent: string;
  let photoInstructions: any;
  
  // Handle each preset type specifically using the style parameter
  if (contentStyle === 'nude-photos' || contentStyle.includes('nude')) {
    demoTitles = [
      'Confidence in its purest form 🔥',
      'Art meets authenticity in this moment ✨',
      'Embracing natural beauty without limits 💋'
    ];
    demoContent = `Confidence in its purest form 🔥\n\nThere's something incredibly liberating about embracing your natural self. No filters, no pretenses - just pure, authentic confidence that radiates from within.\n\nWhat makes you feel most confident in your own skin? 💭`;
    photoInstructions = {
      lighting: "Dramatic artistic lighting with soft shadows - creates depth and artistic appeal",
      cameraAngle: "Artistic angles that celebrate natural beauty - focus on artistic composition",
      composition: "Artistic framing with tasteful positioning - emphasize natural elegance",
      styling: "Natural confidence with artistic elements - minimal but impactful styling",
      mood: "Confident, artistic, and authentically beautiful - let natural beauty shine",
      technicalSettings: "Portrait mode with dramatic lighting - f/1.4-2.0 for beautiful background separation"
    };
  } else if (contentStyle === 'shower-content' || contentStyle.includes('shower')) {
    demoTitles = [
      'Steamy shower vibes, who\'s joining? 😉',
      'Just me, the steam, and pure relaxation 💦',
      'Fresh out of the shower and feeling amazing ✨'
    ];
    demoContent = `Steamy shower vibes, who's joining? 😉\n\nThere's something so therapeutic about a long, hot shower after a busy day. The steam, the warmth, the moment of pure relaxation - it's like hitting the reset button on everything.\n\nWhat's your favorite way to unwind? Tell me in the comments! 💭`;
    photoInstructions = {
      lighting: "Soft bathroom lighting with steam effects - creates intimate, relaxing atmosphere",
      cameraAngle: "Through steam angles that maintain mystery - artistic and tasteful positioning",
      composition: "Steam and water elements as natural frames - use bathroom aesthetics",
      styling: "Natural wet look with minimal styling - emphasize freshness and relaxation",
      mood: "Relaxed, fresh, and naturally beautiful - post-shower glow",
      technicalSettings: "Soft focus through steam - use bathroom lighting creatively"
    };
  } else if (contentStyle === 'workout-clothes' || contentStyle.includes('workout')) {
    demoTitles = [
      'Post-workout glow hitting different today 💪✨',
      'When your gym clothes make you feel unstoppable 🔥',
      'Sweaty, strong, and feeling absolutely amazing 💦'
    ];
    demoContent = `Post-workout glow hitting different today 💪✨\n\nJust finished an incredible workout session and I'm feeling so strong and confident! There's something about pushing your limits that makes you appreciate what your body can do. This activewear is making me feel like I can conquer the world.\n\nWho else is feeling that post-gym high today? Drop a 💪 if you crushed your workout too!`;
    photoInstructions = {
      lighting: "Bright energetic lighting - captures post-workout glow and energy",
      cameraAngle: "Dynamic athletic angles - show strength and confidence",
      composition: "Action-oriented composition with workout elements - gym mirrors work great",
      styling: "Athletic wear that shows your curves - sports bra and leggings combination",
      mood: "Strong, energetic, and accomplished - post-workout confidence",
      technicalSettings: "Clear, bright shots - f/2.8-4.0 with good lighting"
    };
  } else if (contentStyle === 'lingerie' || contentStyle.includes('lingerie')) {
    demoTitles = [
      'Elegance meets allure in perfect harmony 💋',
      'Sometimes the most beautiful art is you ✨',
      'Sophisticated beauty that takes your breath away 🌹'
    ];
    demoContent = `Elegance meets allure in perfect harmony 💋\n\nThere's something magical about beautiful lingerie - it's not just about looking good, it's about feeling absolutely incredible in your own skin. When confidence meets elegance, magic happens.\n\nWhat makes you feel most elegant and confident? Share your thoughts! 💭`;
    photoInstructions = {
      lighting: "Soft romantic lighting - creates elegant and sophisticated mood",
      cameraAngle: "Elegant poses that highlight beautiful lingerie - tasteful and artistic",
      composition: "Bedroom or boudoir setting with elegant props - sophisticated atmosphere",
      styling: "Beautiful lingerie that makes you feel amazing - focus on elegance",
      mood: "Sophisticated, elegant, and confidently beautiful - refined allure",
      technicalSettings: "Portrait mode with soft bokeh - f/1.8-2.8 for romantic depth"
    };
  } else if (contentStyle === 'casual-tease' || contentStyle.includes('casual')) {
    demoTitles = [
      'Just being my playfully authentic self 😉',
      'Casual vibes but make it irresistible 💕',
      'Sometimes the best moments are unplanned ✨'
    ];
    demoContent = `Just being my playfully authentic self 😉\n\nYou know those moments when you're just being completely natural and carefree? That's when the real magic happens. No fancy setup, just genuine playful energy that's absolutely infectious.\n\nWhat's your favorite way to be playfully authentic? Tell me! 💭`;
    photoInstructions = {
      lighting: "Natural casual lighting - window light or soft indoor lighting",
      cameraAngle: "Playful candid angles - capture natural charm and personality",
      composition: "Casual home setting - cozy couch, bedroom, or comfortable spaces",
      styling: "Casual but cute outfits - oversized shirts, comfortable but flattering clothing",
      mood: "Playful, natural, and charmingly authentic - casual confidence",
      technicalSettings: "Natural lighting with casual feel - f/2.0-2.8 for soft natural look"
    };
  } else if (contentStyle === 'bedroom-scene' || contentStyle.includes('bedroom')) {
    demoTitles = [
      'Cozy bedroom vibes and intimate moments 🛏️',
      'Sometimes the most beautiful spaces are personal ✨',
      'Creating magic in my most intimate space 💋'
    ];
    demoContent = `Cozy bedroom vibes and intimate moments 🛏️\n\nThere's something so special about your personal space - where you can be completely yourself and create beautiful, intimate moments. My bedroom is my sanctuary, my creative space, my comfort zone.\n\nWhat makes your personal space feel most like home? 💭`;
    photoInstructions = {
      lighting: "Warm intimate bedroom lighting - soft lamps and natural window light",
      cameraAngle: "Intimate bedroom angles - bed, pillows, and cozy positioning",
      composition: "Beautiful bedroom setting with cozy elements - pillows, blankets, intimate props",
      styling: "Comfortable intimate wear - silk, satin, or cozy bedroom attire",
      mood: "Intimate, cozy, and beautifully personal - bedroom confidence",
      technicalSettings: "Warm white balance with soft lighting - f/1.8-2.4 for intimate depth"
    };
  } else if (contentStyle === 'outdoor-adventure' || contentStyle.includes('outdoor')) {
    demoTitles = [
      'Nature brings out my wild side 🌳✨',
      'Adventure mode: ON! Who\'s joining me? 🏞️',
      'Fresh air and natural beauty everywhere 🌿'
    ];
    demoContent = `Nature brings out my wild side 🌳✨\n\nThere's nothing quite like connecting with nature and feeling completely free. Whether it's a hike, beach day, or just finding a beautiful outdoor spot, the natural world always inspires my most adventurous content.\n\nWhat's your favorite outdoor adventure? Share your stories! 🏞️`;
    photoInstructions = {
      lighting: "Golden hour natural lighting - sunrise or sunset for magical outdoor glow",
      cameraAngle: "Adventurous outdoor angles - incorporate natural landscape elements",
      composition: "Natural outdoor settings - trees, beaches, hiking trails, or scenic locations",
      styling: "Outdoor adventure wear that's both practical and beautiful - hiking outfits, swimwear",
      mood: "Adventurous, free-spirited, and naturally beautiful - outdoor confidence",
      technicalSettings: "Natural outdoor lighting - f/4.0-8.0 for landscape depth"
    };
  } else if (contentStyle === 'professional-tease' || contentStyle.includes('professional')) {
    demoTitles = [
      'Professional by day, irresistible always 💼✨',
      'When business meets pleasure perfectly 👔',
      'Sophisticated allure that commands attention 💋'
    ];
    demoContent = `Professional by day, irresistible always 💼✨\n\nThere's something incredibly powerful about professional confidence mixed with personal allure. Whether it's a business outfit that fits perfectly or that moment when professionalism meets personal magnetism.\n\nWhat makes you feel most professionally confident? 💭`;
    photoInstructions = {
      lighting: "Professional studio-style lighting - clean, sophisticated, and polished",
      cameraAngle: "Confident professional angles - show poise and sophisticated appeal",
      composition: "Office or professional setting with elegant elements - clean, sophisticated background",
      styling: "Professional attire with sophisticated appeal - business suits, elegant professional wear",
      mood: "Confident, sophisticated, and professionally magnetic - business confidence",
      technicalSettings: "Clean professional lighting - f/2.8-4.0 for sharp, polished look"
    };
  } else {
    // Fallback for any other content
    demoTitles = [
      'Feeling confident and loving every moment ✨',
      'Just being authentically me, hope you love it 💕',
      'Living my best life, one post at a time 🌟'
    ];
    demoContent = `Feeling confident and loving every moment ✨\n\nHey beautiful souls! Just wanted to share this moment with you all. There's something magical about embracing who you are and sharing that energy with people who appreciate authenticity.\n\nWhat's making you feel confident today? Let's spread some positive vibes! 💫`;
    photoInstructions = {
      lighting: "Soft natural light from a window - creates a warm, inviting glow",
      cameraAngle: "Slightly above eye level - universally flattering and creates connection",
      composition: "Rule of thirds with you positioned off-center - professional-looking shots",
      styling: "Your signature style with confidence - wear what makes you feel amazing",
      mood: "Confident, approachable, and genuinely happy - authentic personality",
      technicalSettings: "Portrait mode with soft background blur - f/1.8-2.8 for depth"
    };
  }

  return {
    titles: demoTitles,
    content: demoContent,
    photoInstructions: photoInstructions || {
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