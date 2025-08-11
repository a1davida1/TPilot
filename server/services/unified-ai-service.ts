import OpenAI from "openai";

// Initialize OpenAI with the provided API key
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

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
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are an expert social media content creator specializing in adult content creation. Create engaging, authentic content that respects platform guidelines while being appealing and personality-driven."
      }
    ];

    if (mode === 'image' && imageBase64) {
      // Image-based generation
      const imagePrompt = `
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

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: imagePrompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      });
    } else {
      // Text-based generation
      const textPrompt = `
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
  "content": "main post content that's engaging and authentic",
  "photoInstructions": {
    "lighting": "detailed lighting recommendation",
    "cameraAngle": "best camera angles to use",
    "composition": "composition and framing advice",
    "styling": "outfit and styling suggestions",
    "mood": "mood and expression guidance",
    "technicalSettings": "camera settings (aperture, ISO, etc.)"
  },
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "caption": "A catchy caption for the content"
}

Generate 3 different title options. Make everything match the ${style} style.
Create content that's perfect for ${platform}.`;

      messages.push({
        role: "user",
        content: textPrompt
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest GPT-4o model
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Validate and format the response
    return {
      titles: Array.isArray(result.titles) ? result.titles.slice(0, 3) : 
        ['Feeling cute today 💕', 'New content alert!', 'Check this out 😘'],
      content: result.content || 'Generated content for your social media',
      photoInstructions: {
        lighting: result.photoInstructions?.lighting || 'Soft, natural lighting with warm tones',
        cameraAngle: result.photoInstructions?.cameraAngle || 'Eye-level or slightly above for flattering angles',
        composition: result.photoInstructions?.composition || 'Rule of thirds with subject off-center',
        styling: result.photoInstructions?.styling || 'Casual-chic outfit with natural makeup',
        mood: result.photoInstructions?.mood || 'Confident and playful with genuine expressions',
        technicalSettings: result.photoInstructions?.technicalSettings || 'f/1.8-2.8 for bokeh, ISO 100-400, golden hour preferred'
      },
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : 
        ['#contentcreator', '#dailypost', '#photooftheday', '#instagood', '#vibes'],
      caption: result.caption || 'Check out my new content!'
    };
  } catch (error) {
    console.error('Unified AI generation error:', error);
    
    // Return demo content as fallback
    return {
      titles: [
        `Feeling ${style} today 💕`,
        `New ${theme || 'content'} just dropped!`,
        'You won\'t want to miss this 😘'
      ],
      content: `Hey loves! Just wanted to share something special with you today. ${
        includePromotion ? 'Check out my profile for more exclusive content!' : 'Hope you enjoy!'
      } Let me know what you think in the comments 💕`,
      photoInstructions: {
        lighting: 'Golden hour lighting (1 hour before sunset) or soft window light',
        cameraAngle: 'Eye level for connection, slightly above for a flattering look',
        composition: 'Rule of thirds - place yourself off-center for visual interest',
        styling: 'Casual elegance - comfortable but put-together look',
        mood: 'Natural and confident with genuine expressions',
        technicalSettings: 'Portrait mode or f/1.8-2.8, ISO 100-400, warm white balance'
      },
      hashtags: ['#contentcreator', '#dailyvibes', '#photooftheday', '#aesthetic', '#mood'],
      caption: 'Living my best life and sharing it with you!'
    };
  }
}

// Function to analyze an image and extract description
export async function analyzeImage(imageBase64: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail, focusing on the subject, setting, mood, colors, and any notable elements."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content || 'Image analysis unavailable';
  } catch (error) {
    console.error('Image analysis error:', error);
    return 'Unable to analyze image at this time';
  }
}