import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface User {
  personalityProfile: {
    toneOfVoice: string;
    contentStyle: string;
    personalBrand: string;
    contentLength: 'short' | 'medium' | 'long';
    includeEmojis: boolean;
    promotionLevel: 'subtle' | 'moderate' | 'direct';
  };
  preferences: any;
}

interface AIGenerationRequest {
  user: User;
  platform: string;
  imageDescription?: string;
  customPrompt?: string;
  subreddit?: string;
  allowsPromotion: 'yes' | 'no';
  baseImageUrl?: string;
}

interface AIContentResponse {
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
}

export async function generateAIContent(request: AIGenerationRequest): Promise<AIContentResponse> {
  const { user, platform, imageDescription, customPrompt, subreddit, allowsPromotion } = request;
  const profile = user.personalityProfile;

  // Build context for AI generation
  const contextPrompt = buildContextPrompt(profile, platform, allowsPromotion, subreddit);
  
  let mainPrompt = '';
  if (customPrompt) {
    mainPrompt = `Create content based on this request: "${customPrompt}"`;
  } else if (imageDescription) {
    mainPrompt = `Create content based on this image: ${imageDescription}`;
  } else {
    mainPrompt = 'Create engaging content that fits my personality and brand.';
  }

  const fullPrompt = `
${contextPrompt}

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

Generate 3 different title options. Make the content engaging and authentic to my personality.
${profile.includeEmojis ? 'Include appropriate emojis.' : 'Do not use emojis.'}
Content length should be ${profile.contentLength}.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert social media content creator specializing in adult content creation. Create engaging, authentic content that respects platform guidelines while being appealing and personality-driven."
        },
        {
          role: "user",
          content: fullPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and format the response
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
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate AI content. Please check your API key and try again.');
  }
}

export async function analyzeImageForContent(imageUrl: string, user: User): Promise<string> {
  try {
    // For local development, we'll use a simplified approach
    // In production, you'd want to fetch the image and convert to base64
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing images for social media content creation. Describe what you see in a way that would help create engaging post content."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and describe it in detail for creating social media content. Focus on the mood, setting, styling, and elements that would make for engaging post content. Keep the description concise but vivid.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    return response.choices[0].message.content || 'Image shows an engaging scene perfect for social media content.';
  } catch (error) {
    console.error('Image analysis error:', error);
    // Fallback description
    return 'Image shows an attractive scene that would work well for engaging social media content.';
  }
}

function buildContextPrompt(
  profile: User['personalityProfile'], 
  platform: string, 
  allowsPromotion: 'yes' | 'no',
  subreddit?: string
): string {
  let context = `
You are creating content for ${platform}${subreddit ? ` (specifically for r/${subreddit})` : ''}.

Personality Profile:
- Tone of Voice: ${profile.toneOfVoice}
- Content Style: ${profile.contentStyle}
- Personal Brand: ${profile.personalBrand}
- Promotion Level: ${profile.promotionLevel}

`;

  if (allowsPromotion === 'yes') {
    context += `This platform/subreddit allows promotional content, so you can be more direct about promoting content or services.`;
  } else {
    context += `This platform/subreddit does not allow promotional content, so keep it subtle and focus on genuine engagement.`;
  }

  // Add platform-specific guidance
  if (platform === 'reddit') {
    context += `\n\nReddit-specific guidelines:
- Be authentic and conversational
- Avoid overly promotional language unless explicitly allowed
- Focus on community engagement
- Use Reddit's casual tone`;
  }

  return context;
}