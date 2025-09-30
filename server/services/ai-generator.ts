import OpenAI from 'openai';
import { buildMessages, type PromptConfig } from './prompt-builder';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AIGenerationRequest {
  customPrompt?: string;
  platform: string;
  allowsPromotion?: string;
  style?: string;
  theme?: string;
  imageBase64?: string;
}

export interface AIContentResponse {
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
  provider?: string;
}

export async function generateAIContent(
  request: AIGenerationRequest,
): Promise<AIContentResponse> {
  const { customPrompt, platform, allowsPromotion, style, theme, imageBase64 } =
    request;
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('AI service not configured. Please contact support.');
    }

    // Build prompt using centralized builder (supports RAG + images)
    const promptCfg: PromptConfig = {
      platform,
      voice: style || 'casual',
      style: style || 'casual',
      theme: theme || 'lifestyle',
      allowsPromotion: allowsPromotion === 'yes' || allowsPromotion === 'high',
      userPrompt: customPrompt,
      imageBase64,
      // contextDocs: await retrieveDocs(platform, theme), // optional RAG hook
    };

    const messages = buildMessages(promptCfg);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated from AI service');
    }

    // Parse the AI response (simplified parsing)
    const lines = content.split('\n').filter(line => line.trim());
    
    // Extract titles (look for numbered list or bullet points)
    const titles: string[] = [];
    const titleSection = lines.find(line => line.toLowerCase().includes('title'));
    if (titleSection) {
      const titleIndex = lines.indexOf(titleSection);
      if (titleIndex !== -1) {
        const titleLines = lines.slice(titleIndex + 1, titleIndex + 4);
        titles.push(...titleLines.map(line => line.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '').trim()));
      }
    }
    
    // Fallback titles if parsing fails
    if (titles.length === 0) {
      titles.push(
        `New ${style || 'content'} post ✨`,
        `Feeling ${style || 'good'} today 💫`,
        `Latest ${theme || 'lifestyle'} update 🌟`
      );
    }

    // Use the full AI content
    const postContent = content;

    return {
      titles: titles.slice(0, 3),
      content: postContent,
      photoInstructions: {
        lighting: 'Natural lighting or soft artificial light',
        cameraAngle: 'Eye level for connection',
        composition: 'Rule of thirds composition',
        styling: 'Authentic styling that matches your brand',
        mood: 'Confident and authentic',
        technicalSettings: 'Good focus with balanced exposure'
      },
      hashtags: ['#contentcreator', '#authentic', '#lifestyle'],
      caption: titles[0] || 'New post!',
      provider: 'openai'
    };

  } catch (error) {
    console.error('AI generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('billing')) {
        throw new Error('AI service quota exceeded. Please upgrade your plan or try again later.');
      }
      if (error.message.includes('API key')) {
        throw new Error('AI service configuration error. Please contact support.');
      }
    }
    
    throw new Error('AI content generation temporarily unavailable. Please try again in a few moments.');
  }
}

// Image analysis for content generation
export async function analyzeImageForContent(imageBase64: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('AI service not configured');
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Analyze the image and provide a detailed description for content creation.' },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Describe this image in detail for social media content creation:' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return completion.choices[0]?.message?.content || 'Image analysis unavailable';
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Image analysis temporarily unavailable');
  }
}

// Simple content generation for basic use cases
export async function generateSimpleContent(prompt: string, platform: string = 'general'): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('AI service not configured');
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `Generate content for ${platform} platform.` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0]?.message?.content || 'Content generation unavailable';
  } catch (error) {
    console.error('Simple content generation error:', error);
    throw new Error('Content generation temporarily unavailable');
  }
}