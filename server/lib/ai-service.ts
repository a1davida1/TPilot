import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import crypto from "crypto";
import { env } from "./config.js";
import { db } from "../db.js";
import { aiGenerations } from "@shared/schema.js";
import { eq } from "drizzle-orm";

// AI service initialization
// Use Gemini as primary (with GEMINI_API_KEY), OpenAI as fallback
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || env.GOOGLE_GENAI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export interface ContentGenerationRequest {
  userId: number;
  prompt?: string;
  imageKey?: string;
  platforms: string[];
  styleHints?: string[];
  variants?: number;
  cacheKey?: string;
}

export interface GeneratedContent {
  platform: string;
  titles: string[];
  body: string;
  photoInstructions?: string;
  hashtags?: string[];
  style: string;
  confidence: number;
}

export interface AiResponse {
  content: GeneratedContent[];
  tokensUsed: number;
  model: string;
  cached: boolean;
}

export class AiService {
  
  static async generateContent(request: ContentGenerationRequest): Promise<AiResponse> {
    const { userId, prompt, imageKey, platforms, styleHints, variants = 1 } = request;
    
    // Generate cache key
    const inputData = { prompt, imageKey, platforms, styleHints, variants };
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(inputData)).digest('hex');
    
    // Check cache first
    const cached = await this.getCachedResult(inputHash);
    if (cached) {
      return { ...cached, cached: true };
    }
    
    try {
      // Use Gemini as primary for multi-platform content generation
      const response = await this.generateWithGemini(inputData);
      
      // Cache the result
      await this.cacheResult(userId, 'gemini', inputHash, inputData, response);
      
      return { ...response, cached: false };
      
    } catch (error: any) {
      console.error('Gemini generation failed:', error);
      
      // Check if Gemini has quota issues too
      if (error?.status === 429 || error?.message?.includes('quota')) {
        console.log('Gemini quota exceeded, trying OpenAI fallback...');
      }
      
      // Fallback to OpenAI
      try {
        const response = await this.generateWithOpenAI(inputData);
        await this.cacheResult(userId, 'openai', inputHash, inputData, response);
        return { ...response, cached: false };
      } catch (fallbackError: any) {
        console.error('OpenAI fallback failed:', fallbackError);
        
        // Check if it's a quota error
        if (fallbackError?.code === 'insufficient_quota' || fallbackError?.status === 429) {
          console.log('API quota exceeded, using template fallback...');
          const platforms = inputData.platforms || ['reddit'];
          const fallbackContent = this.createFallbackContent(platforms);
          return { content: fallbackContent, tokensUsed: 0, model: 'fallback', cached: false };
        }
        
        throw new Error('All AI services failed to generate content');
      }
    }
  }
  
  private static async generateWithGemini(input: any): Promise<Omit<AiResponse, 'cached'>> {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const systemPrompt = this.buildSystemPrompt(input.platforms, input.styleHints);
    const userPrompt = input.prompt || "Generate engaging content for adult content creator";
    
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);
    
    const response = await result.response;
    const content = this.parseGeminiResponse(response.text(), input.platforms);
    
    return {
      content,
      tokensUsed: response.usageMetadata?.totalTokenCount || 0,
      model: "gemini-1.5-flash",
    };
  }
  
  private static async generateWithOpenAI(input: any): Promise<Omit<AiResponse, 'cached'>> {
    const systemPrompt = this.buildSystemPrompt(input.platforms, input.styleHints);
    const userPrompt = input.prompt || "Generate engaging content for adult content creator";
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });
    
    const content = this.parseOpenAIResponse(
      response.choices[0].message.content!, 
      input.platforms
    );
    
    return {
      content,
      tokensUsed: response.usage?.total_tokens || 0,
      model: "gpt-4o",
    };
  }
  
  private static buildSystemPrompt(platforms: string[], styleHints?: string[]): string {
    const style = styleHints?.join(", ") || "confident, authentic";
    
    return `You are a social media content expert specializing in adult content creation.
    
CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no code blocks.

Generate content for platforms: ${platforms.join(", ")}
Style preferences: ${style}

For each platform, provide:
- 3-5 engaging titles/captions
- Main body text (if applicable)
- Photo instructions (poses, lighting, styling)
- Relevant hashtags
- Platform-specific optimizations

Rules:
- Content should be tasteful but engaging
- Avoid explicit language in titles
- Focus on personality and authenticity
- Include engagement hooks (questions, calls to action)
- Respect platform guidelines while maximizing appeal

RESPONSE FORMAT (valid JSON only):
{
  "content": [
    {
      "platform": "reddit",
      "titles": ["title1", "title2", "title3"],
      "body": "main content text",
      "photoInstructions": "pose and lighting guidance",
      "hashtags": ["#tag1", "#tag2"],
      "style": "${style}",
      "confidence": 0.9
    }
  ]
}

Return ONLY the JSON object above with actual content. No other text.`;
  }
  
  private static parseGeminiResponse(text: string, platforms: string[]): GeneratedContent[] {
    try {
      // Clean the response text
      let cleanText = text.trim();
      
      // Try multiple JSON extraction strategies
      let jsonStr: string | null = null;
      
      // Strategy 1: Look for complete JSON object
      const fullJsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (fullJsonMatch) {
        jsonStr = fullJsonMatch[0];
      }
      
      // Strategy 2: Extract from code blocks
      if (!jsonStr) {
        const codeBlockMatch = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
        }
      }
      
      // Strategy 3: Find JSON between certain markers
      if (!jsonStr) {
        const markerMatch = cleanText.match(/(?:json|response|result)?\s*[:\-]?\s*(\{[\s\S]*\})/i);
        if (markerMatch) {
          jsonStr = markerMatch[1];
        }
      }
      
      if (jsonStr) {
        // Clean up common JSON issues
        jsonStr = jsonStr!
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')   // Remove trailing commas in arrays
          .replace(/\n/g, ' ')      // Replace newlines with spaces
          .replace(/\t/g, ' ')      // Replace tabs with spaces
          .replace(/\s+/g, ' ');    // Normalize whitespace
        
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.content && Array.isArray(parsed.content)) {
            return parsed.content;
          }
        } catch (parseError) {
          console.warn('JSON parse failed, trying text extraction:', parseError);
        }
      }
      
      // Fallback: extract content from text structure
      const lines = cleanText.split('\n').filter(line => line.trim());
      const firstLine = lines[0] || "Check out my latest content!";
      
      return platforms.map(platform => ({
        platform,
        titles: [firstLine, "Something special for you", "New content is here!"],
        body: cleanText.slice(0, 500) || "I've been working on something special and can't wait to share it with you all!",
        photoInstructions: "Natural lighting, confident pose, genuine expression",
        hashtags: ["#authentic", "#content", "#creator"],
        style: "authentic",
        confidence: 0.6,
      }));
      
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.log('Raw response text:', text.slice(0, 200) + '...');
      return this.createFallbackContent(platforms);
    }
  }
  
  private static parseOpenAIResponse(text: string, platforms: string[]): GeneratedContent[] {
    try {
      const parsed = JSON.parse(text);
      return parsed.content || [];
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      return this.createFallbackContent(platforms);
    }
  }
  
  private static createFallbackContent(platforms: string[]): GeneratedContent[] {
    return platforms.map(platform => ({
      platform,
      titles: ["New content is here! 💫", "Something special for you", "Check this out"],
      body: "I've been working on something special and can't wait to share it with you all!",
      photoInstructions: "Natural lighting, confident pose, genuine smile",
      hashtags: ["#authentic", "#content", "#creator"],
      style: "authentic",
      confidence: 0.5,
    }));
  }
  
  private static async getCachedResult(inputHash: string): Promise<Omit<AiResponse, 'cached'> | null> {
    try {
      const [cached] = await db
        .select()
        .from(aiGenerations)
        .where(eq(aiGenerations.inputHash, inputHash))
        .limit(1);
        
      if (!cached) return null;
      
      // Check if cache is still fresh (24 hours)
      const isStale = Date.now() - cached.createdAt.getTime() > 24 * 60 * 60 * 1000;
      if (isStale) return null;
      
      return cached.outputJson as Omit<AiResponse, 'cached'>;
      
    } catch (error) {
      console.error('Cache lookup failed:', error);
      return null;
    }
  }
  
  private static async cacheResult(
    userId: number,
    provider: string,
    inputHash: string,
    inputData: any,
    result: Omit<AiResponse, 'cached'>
  ) {
    try {
      // Validate userId exists and is a valid number
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        console.warn('Invalid userId provided for caching, skipping cache');
        return;
      }

      // Check if user exists before trying to cache
      const userExists = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
        columns: { id: true }
      });

      if (!userExists) {
        console.warn(`User ID ${userId} not found in database, skipping cache`);
        return;
      }

      await db.insert(aiGenerations).values({
        userId,
        provider,
        model: result.model,
        inputHash,
        inputJson: inputData,
        outputJson: result,
      });
    } catch (error: any) {
      console.warn('Failed to cache AI result (non-fatal):', error.message);
      // Check for foreign key constraint violation
      if (error?.code === '23503' && error?.constraint?.includes('user_id')) {
        console.warn(`User ID ${userId} not found in database, skipping cache`);
      }
      // Non-fatal error, continue without caching
    }
  }
  
  // Image analysis for context-aware content generation
  static async analyzeImage(imageBuffer: Buffer): Promise<{
    description: string;
    mood: string;
    suggestions: string[];
  }> {
    try {
      if (process.env.OPENAI_API_KEY) {
        const base64Image = imageBuffer.toString('base64');
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for social media content creation. Describe the mood, setting, and suggest content themes. Return JSON with description, mood, and suggestions array."
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
              }
            ]
          }],
          max_tokens: 300,
          response_format: { type: "json_object" }
        });
        
        return JSON.parse(response.choices[0].message.content!);
      }
      
      // Fallback without image analysis
      return {
        description: "Image uploaded successfully",
        mood: "confident",
        suggestions: ["Share your authentic self", "Connect with your audience", "Show your personality"]
      };
      
    } catch (error) {
      console.error('Image analysis failed:', error);
      return {
        description: "Image analysis unavailable",
        mood: "authentic",
        suggestions: ["Create engaging content", "Be yourself", "Connect with your audience"]
      };
    }
  }
  
  // Get user's generation history
  static async getUserHistory(userId: number, limit: number = 10) {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('Invalid user ID provided');
      }

      return db
        .select()
        .from(aiGenerations)
        .where(eq(aiGenerations.userId, userId))
        .orderBy(aiGenerations.createdAt)
        .limit(limit);
    } catch (error) {
      console.error('Failed to get user history:', error);
      return [];
    }
  }
  
  // Clean old cache entries
  static async cleanCache(olderThanDays: number = 7) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    try {
      const result = await db
        .delete(aiGenerations)
        .where(eq(aiGenerations.createdAt, cutoff));
        
      console.log(`Cleaned ${result} old AI cache entries`);
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }
}