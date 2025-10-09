import { generateWithMultiProvider } from './multi-ai-provider';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
export interface UnifiedAIRequest {
  mode: 'text' | 'image';
  prompt?: string;
  imageBase64?: string;
  platform: string;
  style: string;
  theme?: string;
  includePromotion?: boolean;
  customInstructions?: string;
}

export interface UnifiedAIResponse {
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
  hashtags?: string[];
  caption?: string;
}

export async function generateUnifiedAIContent(request: UnifiedAIRequest): Promise<UnifiedAIResponse> {
  const { mode, prompt, imageBase64, platform, style, theme, includePromotion, customInstructions } = request;

  // Style prompts for content generation
  const stylePrompts: Record<string, string> = {
    playful: "Create fun, engaging content with a playful and flirty tone",
    mysterious: "Create intriguing, alluring content that leaves viewers wanting more",
    bold: "Create confident, assertive content that commands attention",
    elegant: "Create sophisticated, refined content with class and elegance",
    confident: "Create strong, self-assured content that exudes confidence",
    authentic: "Create genuine, relatable content that feels real and honest",
    sassy: "Create witty, spirited content with attitude and charm"
  };

  // Platform-specific guidelines
  const platformGuidelines: Record<string, string> = {
    reddit: "Reddit-style authentic posts that feel genuine, use conversational language",
    twitter: "Twitter-style concise posts with high impact, use trending language",
    instagram: "Instagram-style visually focused captions with lifestyle appeal",
    tiktok: "TikTok-style trendy, energetic content with viral potential"
  };

  const promotionText = includePromotion 
    ? "Include subtle promotional elements that feel natural"
    : "Keep content authentic without promotional elements";

  try {
    // Build the appropriate prompt based on mode
    let finalPrompt: string;
    
    if (mode === 'image' && imageBase64) {
      // Image-based generation
      finalPrompt = `
Analyze this image and create engaging social media content.

Style: ${stylePrompts[style] || stylePrompts.playful}
Platform: ${platformGuidelines[platform] || platformGuidelines.reddit}
Promotion: ${promotionText}
${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Please respond with JSON in this exact format:
{
  "titles": ["title1", "title2", "title3"],
  "content": "main post content that's engaging and matches the image",
  "photoInstructions": {
    "lighting": "detailed lighting description",
    "cameraAngle": "camera angle description",
    "composition": "composition description",
    "styling": "styling and outfit description",
    "mood": "mood and atmosphere description",
    "technicalSettings": "camera settings recommendation"
  },
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "caption": "A brief, engaging description of what's in the image"
}

Generate 3 different title options. Make the content match the ${style} style perfectly.
Keep it authentic and engaging for ${platform}.`;
    } else {
      // Text-based generation
      finalPrompt = `
Create engaging social media content based on this request:
${prompt || `Generate ${theme || 'engaging'} content`}

Style: ${stylePrompts[style] || stylePrompts.playful}
Platform: ${platformGuidelines[platform] || platformGuidelines.reddit}
Theme: ${theme || 'general'}
Promotion: ${promotionText}
${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Please respond with JSON in this exact format:
{
  "titles": ["title1", "title2", "title3"],
  "content": "Write a full engaging social media post (2-4 sentences) that matches the style and platform. Make it authentic and personality-driven with proper flow between sentences.",
  "photoInstructions": {
    "lighting": "detailed lighting recommendation",
    "cameraAngle": "best camera angles to use", 
    "composition": "composition and framing advice",
    "styling": "outfit and styling suggestions",
    "mood": "mood and expression guidance",
    "technicalSettings": "camera settings (aperture, ISO, etc.)"
  },
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtags5"],
  "caption": "A catchy caption for the content"
}

Generate 3 different title options. Make everything match the ${style} style.
Create content that's perfect for ${platform}.`;
    }

    // Use the multi-provider system with your preferences and user data
    const result = await generateWithMultiProvider({
      user: {
        id: 0,
        tier: 'free'
      },
      platform,
      imageDescription: imageBase64 ? 'User uploaded image for analysis' : undefined,
      customPrompt: finalPrompt,
      allowsPromotion: includePromotion ? 'yes' : 'no',
      baseImageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined
    });

    // Return the result from multi-provider system with enhanced hashtags
    return {
      titles: result.titles,
      content: result.content,
      photoInstructions: result.photoInstructions,
      hashtags: ['#contentcreator', '#dailypost', '#photooftheday', '#instagood', '#vibes'],
      caption: result.content.split('\n')[0] || 'Check out my new content!'
    };
  } catch (error) {
    logger.error(...formatLogArgs('Unified AI generation error:', error));
    
    // Check if it's a quota/billing issue
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('billing');
    
    throw new Error(isQuotaError ? 
      'AI service quota exceeded. Please upgrade your plan or try again later.' : 
      'AI content generation temporarily unavailable. Please try again in a few moments.'
    );
  }
}

// Function to analyze an image and extract description
export async function analyzeImage(imageBase64: string): Promise<string> {
  try {
    const result = await generateWithMultiProvider({
      user: {
        id: 0,
        tier: 'free'
      },
      platform: 'analysis',
      imageDescription: 'Image to be analyzed',
      customPrompt: 'Describe this image in detail, focusing on the subject, setting, mood, colors, and any notable elements. Be descriptive and specific.',
      allowsPromotion: 'no',
      baseImageUrl: `data:image/jpeg;base64,${imageBase64}`
    });

    return result.content || 'Image analysis unavailable';
  } catch (error) {
    logger.error(...formatLogArgs('Image analysis error:', error));
    return 'Unable to analyze image at this time';
  }
}