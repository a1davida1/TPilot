/**
 * Enhanced AI Content Generation Service
 * Provides robust, professional, and detailed content generation with multiple fallback strategies
 */

import { generateWithMultiProvider } from './multi-ai-provider';
import { preGeneratedTemplates } from '../content-templates';

export interface EnhancedAIRequest {
  mode: 'text' | 'image' | 'hybrid';
  prompt?: string;
  imageBase64?: string;
  platform: 'reddit' | 'twitter' | 'instagram' | 'tiktok' | 'onlyfans';
  style: 'playful' | 'mysterious' | 'bold' | 'elegant' | 'confident' | 'authentic' | 'sassy' | 'professional';
  theme?: string;
  tone?: 'casual' | 'formal' | 'flirty' | 'friendly' | 'provocative';
  contentType?: 'teasing' | 'promotional' | 'engagement' | 'lifestyle' | 'announcement' | 'educational';
  includePromotion?: boolean;
  promotionLevel?: 'none' | 'subtle' | 'moderate' | 'direct';
  targetAudience?: 'general' | 'fans' | 'potential-subscribers' | 'premium-tier';
  customInstructions?: string;
  userId?: string;
  subreddit?: string;
  niche?: string;
  personalBrand?: string;
}

export interface EnhancedPhotoInstructions {
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    colorTemperature: string;
  };
  camera: {
    angle: string;
    distance: string;
    height: string;
    lens: string;
  };
  composition: {
    framing: string;
    rule: string;
    background: string;
    foreground: string;
  };
  styling: {
    outfit: string;
    accessories: string;
    hair: string;
    makeup: string;
  };
  mood: {
    expression: string;
    bodyLanguage: string;
    energy: string;
    atmosphere: string;
  };
  technical: {
    aperture: string;
    iso: string;
    shutterSpeed: string;
    whiteBalance: string;
    focusPoint: string;
    depth: string;
  };
  props?: string[];
  location?: string;
  timeOfDay?: string;
}

export interface EnhancedAIResponse {
  titles: string[];
  content: string;
  photoInstructions: EnhancedPhotoInstructions;
  hashtags: string[];
  caption: string;
  callToAction?: string;
  engagementHooks?: string[];
  contentWarnings?: string[];
  optimalPostingTime?: string;
  crossPromotionSuggestions?: string[];
  metadata?: {
    generatedAt: Date;
    provider: string;
    model: string;
    confidence: number;
    estimatedEngagement: 'high' | 'medium' | 'low';
  };
}

class EnhancedAIContentGenerator {
  private readonly styleGuides = {
    playful: {
      tone: "Fun, flirty, and lighthearted with playful energy",
      language: "Casual, emoji-friendly, with playful innuendos",
      photoStyle: "Bright, colorful, dynamic poses with genuine smiles"
    },
    mysterious: {
      tone: "Intriguing, alluring, leaving viewers wanting more",
      language: "Suggestive but not explicit, using metaphors and hints",
      photoStyle: "Dramatic lighting, shadows, partial reveals"
    },
    bold: {
      tone: "Confident, assertive, unapologetic",
      language: "Direct, powerful statements with strong calls-to-action",
      photoStyle: "Power poses, direct eye contact, striking compositions"
    },
    elegant: {
      tone: "Sophisticated, refined, classy",
      language: "Polished, articulate, minimal slang",
      photoStyle: "Classic compositions, soft lighting, luxurious settings"
    },
    confident: {
      tone: "Self-assured, empowering, inspiring",
      language: "Positive affirmations, motivational undertones",
      photoStyle: "Strong postures, natural expressions, authentic moments"
    },
    authentic: {
      tone: "Genuine, relatable, honest",
      language: "Conversational, personal stories, real experiences",
      photoStyle: "Natural lighting, candid moments, minimal editing"
    },
    sassy: {
      tone: "Witty, spirited, with attitude",
      language: "Clever wordplay, humorous observations, bold statements",
      photoStyle: "Expressive poses, personality-driven shots"
    },
    professional: {
      tone: "Business-like, competent, reliable",
      language: "Clear, concise, value-focused",
      photoStyle: "Clean backgrounds, professional attire options"
    }
  };

  private readonly platformOptimizations = {
    reddit: {
      titleLength: { min: 30, max: 100 },
      contentLength: { min: 100, max: 500 },
      hashtagLimit: 0,
      features: ['authentic stories', 'community engagement', 'subreddit-specific content']
    },
    twitter: {
      titleLength: { min: 10, max: 50 },
      contentLength: { min: 50, max: 280 },
      hashtagLimit: 5,
      features: ['brevity', 'trending topics', 'retweet-worthy hooks']
    },
    instagram: {
      titleLength: { min: 0, max: 0 },
      contentLength: { min: 50, max: 2200 },
      hashtagLimit: 30,
      features: ['visual storytelling', 'lifestyle content', 'hashtag optimization']
    },
    tiktok: {
      titleLength: { min: 0, max: 0 },
      contentLength: { min: 30, max: 150 },
      hashtagLimit: 10,
      features: ['trend awareness', 'viral hooks', 'challenge participation']
    },
    onlyfans: {
      titleLength: { min: 20, max: 80 },
      contentLength: { min: 50, max: 500 },
      hashtagLimit: 5,
      features: ['exclusive content tease', 'subscriber benefits', 'direct engagement']
    }
  };

  async generate(request: EnhancedAIRequest): Promise<EnhancedAIResponse> {
    const startTime = Date.now();
    
    try {
      // Build comprehensive prompt with all enhancements
      const enhancedPrompt = this.buildEnhancedPrompt(request);
      
      // Try AI generation with enhanced prompt
      const aiResult = await this.tryAIGeneration(enhancedPrompt, request);
      
      if (aiResult) {
        return this.enhanceResponse(aiResult, request, {
          provider: 'multi-ai',
          model: 'gemini/openai',
          confidence: 0.9,
          generationTime: Date.now() - startTime
        });
      }
      
      // Fallback to template-based generation with enhancements
      return this.generateFromTemplates(request);
      
    } catch (error) {
      console.error('Enhanced AI generation error:', error);
      return this.generateSafetyFallback(request);
    }
  }

  private buildEnhancedPrompt(request: EnhancedAIRequest): string {
    const { 
      mode, prompt, platform, style, theme, tone, contentType,
      includePromotion, promotionLevel, targetAudience, customInstructions,
      subreddit, niche, personalBrand
    } = request;

    const styleGuide = this.styleGuides[style];
    const platformGuide = this.platformOptimizations[platform];

    return `
You are a professional content creator specializing in ${niche || 'adult content creation'}.
Create highly engaging, platform-optimized content with these specifications:

BRAND IDENTITY:
- Personal Brand: ${personalBrand || 'Authentic creator focused on genuine connection'}
- Style: ${styleGuide.tone}
- Language: ${styleGuide.language}
- Visual Style: ${styleGuide.photoStyle}

CONTENT REQUIREMENTS:
- Platform: ${platform.toUpperCase()} (Optimize for: ${platformGuide.features.join(', ')})
- Content Type: ${contentType || 'engagement'}
- Target Audience: ${targetAudience || 'general followers'}
- Tone: ${tone || 'casual and friendly'}
${subreddit ? `- Subreddit: r/${subreddit} (follow community guidelines)` : ''}

PROMOTIONAL STRATEGY:
- Include Promotion: ${includePromotion ? 'Yes' : 'No'}
- Promotion Level: ${promotionLevel || 'subtle'}
- Call-to-Action: ${includePromotion ? 'Include natural, non-pushy CTA' : 'Focus on engagement only'}

SPECIFIC REQUEST:
${prompt || `Create ${theme || 'engaging'} content that resonates with the audience`}

CUSTOM INSTRUCTIONS:
${customInstructions || 'Maintain authenticity while maximizing engagement'}

OUTPUT FORMAT (JSON):
{
  "titles": [3-5 compelling title options],
  "content": "Main post content (${platformGuide.contentLength.min}-${platformGuide.contentLength.max} chars)",
  "photoInstructions": {
    "lighting": {
      "type": "specific lighting setup",
      "direction": "where light comes from",
      "intensity": "brightness level",
      "colorTemperature": "warm/cool/neutral"
    },
    "camera": {
      "angle": "specific angle description",
      "distance": "close-up/medium/wide",
      "height": "eye-level/above/below",
      "lens": "recommended focal length"
    },
    "composition": {
      "framing": "how to frame the shot",
      "rule": "compositional guideline",
      "background": "background elements",
      "foreground": "foreground elements"
    },
    "styling": {
      "outfit": "detailed outfit description",
      "accessories": "jewelry, props, etc.",
      "hair": "hairstyle recommendations",
      "makeup": "makeup style and intensity"
    },
    "mood": {
      "expression": "facial expression guide",
      "bodyLanguage": "posture and gesture",
      "energy": "energy level to convey",
      "atmosphere": "overall feeling"
    },
    "technical": {
      "aperture": "f-stop recommendation",
      "iso": "ISO setting",
      "shutterSpeed": "shutter speed",
      "whiteBalance": "WB setting",
      "focusPoint": "where to focus",
      "depth": "depth of field"
    }
  },
  "hashtags": [${platformGuide.hashtagLimit} relevant hashtags],
  "caption": "Engaging caption for the content",
  "callToAction": "${includePromotion ? 'Compelling CTA' : 'Engagement question'}",
  "engagementHooks": ["hook1", "hook2", "hook3"],
  "contentWarnings": ["if applicable"],
  "optimalPostingTime": "best time to post",
  "crossPromotionSuggestions": ["platform1", "platform2"]
}

Create content that feels authentic, drives engagement, and perfectly matches the ${style} style for ${platform}.
`;
  }

  private async tryAIGeneration(prompt: string, request: EnhancedAIRequest): Promise<any> {
    try {
      const result = await generateWithMultiProvider({
        user: {
          personalityProfile: {
            toneOfVoice: request.style,
            contentStyle: request.style,
            personalBrand: request.personalBrand || 'authentic creator',
            contentLength: 'detailed',
            includeEmojis: request.platform !== 'onlyfans'
          }
        },
        platform: request.platform,
        imageDescription: request.imageBase64 ? 'User uploaded image' : undefined,
        customPrompt: prompt,
        allowsPromotion: request.includePromotion ? 'yes' : 'no',
        baseImageUrl: request.imageBase64 ? `data:image/jpeg;base64,${request.imageBase64}` : undefined
      });

      // Parse and validate the response
      if (result && result.titles && result.content) {
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('AI generation failed:', error);
      return null;
    }
  }

  private enhanceResponse(
    baseResponse: any, 
    request: EnhancedAIRequest,
    metadata: any
  ): EnhancedAIResponse {
    const platform = this.platformOptimizations[request.platform];
    
    // Ensure content length is optimized
    let content = baseResponse.content;
    if (content.length > platform.contentLength.max) {
      content = content.substring(0, platform.contentLength.max - 3) + '...';
    }
    
    // Generate platform-specific hashtags
    const hashtags = this.generateOptimizedHashtags(request, baseResponse.hashtags);
    
    // Create enhanced photo instructions
    const photoInstructions = this.createDetailedPhotoInstructions(
      baseResponse.photoInstructions || {},
      request
    );
    
    return {
      titles: baseResponse.titles || this.generateTitles(request),
      content,
      photoInstructions,
      hashtags,
      caption: baseResponse.caption || content.split('\n')[0],
      callToAction: this.generateCallToAction(request),
      engagementHooks: this.generateEngagementHooks(request),
      contentWarnings: this.assessContentWarnings(content),
      optimalPostingTime: this.suggestOptimalPostingTime(request.platform),
      crossPromotionSuggestions: this.suggestCrossPromotion(request.platform),
      metadata: {
        generatedAt: new Date(),
        provider: metadata.provider,
        model: metadata.model,
        confidence: metadata.confidence,
        estimatedEngagement: this.estimateEngagement(request, content)
      }
    };
  }

  private createDetailedPhotoInstructions(
    base: any,
    request: EnhancedAIRequest
  ): EnhancedPhotoInstructions {
    const style = this.styleGuides[request.style];
    
    return {
      lighting: {
        type: base.lighting || this.getLightingForStyle(request.style),
        direction: "45-degree angle from front-left",
        intensity: request.style === 'mysterious' ? "Low to medium" : "Medium to bright",
        colorTemperature: request.style === 'elegant' ? "Warm (3200K)" : "Neutral (5500K)"
      },
      camera: {
        angle: base.cameraAngle || this.getCameraAngleForStyle(request.style),
        distance: "Medium shot (waist up)",
        height: "Slightly above eye level for flattering angle",
        lens: "50-85mm for natural perspective"
      },
      composition: {
        framing: base.composition || "Rule of thirds with subject off-center",
        rule: "Golden ratio for visual balance",
        background: this.getBackgroundForStyle(request.style),
        foreground: "Clear, uncluttered"
      },
      styling: {
        outfit: base.styling || this.getOutfitForStyle(request.style),
        accessories: "Minimal, tasteful jewelry",
        hair: "Natural, well-groomed style",
        makeup: request.style === 'elegant' ? "Sophisticated, evening look" : "Natural, enhanced features"
      },
      mood: {
        expression: base.mood || this.getExpressionForStyle(request.style),
        bodyLanguage: "Open, confident posture",
        energy: style.tone,
        atmosphere: style.photoStyle
      },
      technical: {
        aperture: "f/2.8 for soft background blur",
        iso: "100-400 for minimal noise",
        shutterSpeed: "1/125s or faster to avoid blur",
        whiteBalance: "Auto or daylight",
        focusPoint: "Eyes for portrait shots",
        depth: "Shallow for subject isolation"
      },
      props: this.suggestProps(request.contentType),
      location: this.suggestLocation(request.style),
      timeOfDay: this.suggestTimeOfDay(request.style)
    };
  }

  private generateOptimizedHashtags(request: EnhancedAIRequest, base: string[] = []): string[] {
    const limit = this.platformOptimizations[request.platform].hashtagLimit;
    if (limit === 0) return [];
    
    const hashtags = new Set<string>();
    
    // Add base hashtags
    base.forEach(tag => hashtags.add(tag));
    
    // Add platform-specific hashtags
    const platformTags = this.getPlatformHashtags(request.platform);
    platformTags.forEach(tag => hashtags.add(tag));
    
    // Add style-specific hashtags
    const styleTags = this.getStyleHashtags(request.style);
    styleTags.forEach(tag => hashtags.add(tag));
    
    // Add niche-specific hashtags
    if (request.niche) {
      const nicheTags = this.getNicheHashtags(request.niche);
      nicheTags.forEach(tag => hashtags.add(tag));
    }
    
    return Array.from(hashtags).slice(0, limit);
  }

  private generateTitles(request: EnhancedAIRequest): string[] {
    const templates = preGeneratedTemplates.filter(t => 
      t.style === request.style && 
      t.category === (request.contentType || 'engagement')
    );
    
    if (templates.length > 0) {
      return templates.slice(0, 3).map(t => t.title);
    }
    
    // Generate generic titles based on style
    return [
      `Feeling ${request.style} today 💫`,
      `New ${request.theme || 'content'} just for you!`,
      `You won't want to miss this ${request.style} moment`
    ];
  }

  private generateCallToAction(request: EnhancedAIRequest): string {
    if (!request.includePromotion) {
      return "What do you think? Let me know in the comments!";
    }
    
    const ctas: Record<string, string> = {
      none: "What do you think? Let me know in the comments!",
      subtle: "More where this came from 😘",
      moderate: "Check my profile for exclusive content!",
      direct: "Subscribe now for full access - link in bio!"
    };
    
    return ctas[request.promotionLevel || 'subtle'] || ctas.subtle;
  }

  private generateEngagementHooks(request: EnhancedAIRequest): string[] {
    return [
      "Double tap if you agree!",
      "Save this for later 📌",
      "Tag someone who needs to see this",
      "What's your favorite part?",
      "Drop a 🔥 if you like this vibe"
    ];
  }

  private assessContentWarnings(content: string): string[] {
    const warnings: string[] = [];
    
    if (content.toLowerCase().includes('nsfw')) {
      warnings.push('NSFW content');
    }
    
    if (content.toLowerCase().includes('18+')) {
      warnings.push('18+ only');
    }
    
    return warnings;
  }

  private suggestOptimalPostingTime(platform: string): string {
    const times = {
      reddit: "9-10 AM or 7-9 PM EST",
      twitter: "9 AM or 7-9 PM EST",
      instagram: "11 AM-1 PM or 7-9 PM EST",
      tiktok: "6-9 AM or 7-11 PM EST",
      onlyfans: "8-10 PM EST"
    };
    
    return (times as any)[platform] || "Evening hours (7-10 PM)";
  }

  private suggestCrossPromotion(currentPlatform: string): string[] {
    const suggestions = {
      reddit: ['Twitter', 'OnlyFans'],
      twitter: ['Instagram', 'OnlyFans'],
      instagram: ['Twitter', 'TikTok'],
      tiktok: ['Instagram', 'Twitter'],
      onlyfans: ['Twitter', 'Reddit']
    };
    
    return (suggestions as any)[currentPlatform] || [];
  }

  private estimateEngagement(request: EnhancedAIRequest, content: string): 'high' | 'medium' | 'low' {
    let score = 0;
    
    // Check for engagement factors
    if (content.includes('?')) score++; // Questions increase engagement
    if (request.includePromotion && request.promotionLevel === 'subtle') score++; // Subtle promotion works better
    if (request.style === 'playful' || request.style === 'authentic') score++; // These styles typically perform better
    if (content.length > 50 && content.length < 200) score++; // Optimal length
    
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private generateFromTemplates(request: EnhancedAIRequest): EnhancedAIResponse {
    const templates = preGeneratedTemplates.filter(t => 
      t.style === request.style && 
      t.category === (request.contentType || 'engagement')
    );
    
    const template = templates[0] || preGeneratedTemplates[0];
    
    return this.enhanceResponse({
      titles: [template.title],
      content: template.content,
      photoInstructions: {
        lighting: template.photoInstructions || "Natural lighting",
        cameraAngle: "Eye level",
        composition: "Centered",
        styling: "Casual",
        mood: "Relaxed",
        technicalSettings: "Auto settings"
      }
    }, request, {
      provider: 'templates',
      model: 'pre-generated',
      confidence: 0.7,
      generationTime: 100
    });
  }

  private generateSafetyFallback(request: EnhancedAIRequest): EnhancedAIResponse {
    return {
      titles: [
        `${request.style.charAt(0).toUpperCase() + request.style.slice(1)} vibes today`,
        "Check out my latest content!",
        "Something special for you"
      ],
      content: `Excited to share this with you! ${request.includePromotion ? 'Full content available on my page.' : 'Let me know what you think!'}`,
      photoInstructions: this.createDetailedPhotoInstructions({}, request),
      hashtags: ['#contentcreator', '#dailypost', '#vibes'],
      caption: "New content alert!",
      callToAction: "Drop a comment below!",
      engagementHooks: ["Like if you enjoy!", "Share with friends!"],
      contentWarnings: [],
      optimalPostingTime: "Evening (7-9 PM)",
      crossPromotionSuggestions: ["Twitter", "Instagram"],
      metadata: {
        generatedAt: new Date(),
        provider: 'fallback',
        model: 'safety',
        confidence: 0.5,
        estimatedEngagement: 'medium'
      }
    };
  }

  // Helper methods
  private getLightingForStyle(style: string): string {
    const lighting = {
      playful: "Bright, natural daylight",
      mysterious: "Dramatic side lighting with shadows",
      bold: "High contrast studio lighting",
      elegant: "Soft, diffused window light",
      confident: "Even, flattering ring light",
      authentic: "Natural golden hour light",
      sassy: "Colorful LED accent lighting",
      professional: "Balanced three-point lighting"
    };
    return (lighting as any)[style] || "Natural lighting";
  }

  private getCameraAngleForStyle(style: string): string {
    const angles = {
      playful: "Dynamic, varying angles",
      mysterious: "Low angle for drama",
      bold: "Direct, eye-level",
      elegant: "Slightly above for elegance",
      confident: "Straight on, powerful",
      authentic: "Natural, candid angles",
      sassy: "Dutch angles for attitude",
      professional: "Traditional portrait angle"
    };
    return (angles as any)[style] || "Eye level";
  }

  private getBackgroundForStyle(style: string): string {
    const backgrounds = {
      playful: "Colorful, fun environment",
      mysterious: "Dark, textured backdrop",
      bold: "Clean, minimal background",
      elegant: "Luxurious, sophisticated setting",
      confident: "Urban or modern backdrop",
      authentic: "Natural, lived-in space",
      sassy: "Vibrant, personality-filled area",
      professional: "Clean, professional setting"
    };
    return (backgrounds as any)[style] || "Simple, uncluttered background";
  }

  private getOutfitForStyle(style: string): string {
    const outfits = {
      playful: "Bright colors, fun patterns, casual wear",
      mysterious: "Dark tones, flowing fabrics, layers",
      bold: "Statement pieces, strong silhouettes",
      elegant: "Classic pieces, sophisticated fabrics",
      confident: "Well-fitted, powerful attire",
      authentic: "Comfortable, personal style",
      sassy: "Trendy, eye-catching pieces",
      professional: "Polished, business casual"
    };
    return (outfits as any)[style] || "Comfortable, flattering outfit";
  }

  private getExpressionForStyle(style: string): string {
    const expressions = {
      playful: "Genuine smile, laughing eyes",
      mysterious: "Enigmatic, slight smile",
      bold: "Confident, direct gaze",
      elegant: "Serene, composed",
      confident: "Self-assured, slight smile",
      authentic: "Natural, genuine emotions",
      sassy: "Playful smirk, raised eyebrow",
      professional: "Warm, approachable smile"
    };
    return (expressions as any)[style] || "Natural expression";
  }

  private suggestProps(contentType?: string): string[] {
    const props = {
      teasing: ["silk scarf", "feather", "mirror"],
      promotional: ["product samples", "branded items"],
      engagement: ["coffee cup", "book", "flowers"],
      lifestyle: ["yoga mat", "healthy snacks", "plants"],
      announcement: ["balloons", "confetti", "signs"],
      educational: ["notebook", "glasses", "laptop"]
    };
    return (props as any)[contentType || 'engagement'] || [];
  }

  private suggestLocation(style: string): string {
    const locations = {
      playful: "Bright, colorful room or outdoor park",
      mysterious: "Dimly lit boudoir or artistic studio",
      bold: "Modern loft or urban rooftop",
      elegant: "Luxury hotel or classic interior",
      confident: "Professional studio or cityscape",
      authentic: "Home setting or favorite cafe",
      sassy: "Trendy boutique or neon-lit space",
      professional: "Office or co-working space"
    };
    return (locations as any)[style] || "Comfortable indoor setting";
  }

  private suggestTimeOfDay(style: string): string {
    const times = {
      playful: "Mid-morning for best natural light",
      mysterious: "Blue hour or twilight",
      bold: "High noon for strong shadows",
      elegant: "Golden hour for warm tones",
      confident: "Afternoon for even lighting",
      authentic: "Anytime that feels natural",
      sassy: "Night with artificial lights",
      professional: "Morning for fresh look"
    };
    return (times as any)[style] || "Golden hour (sunrise/sunset)";
  }

  private getPlatformHashtags(platform: string): string[] {
    const tags = {
      reddit: [], // Reddit doesn't use hashtags
      twitter: ['#TwitterAfterDark', '#content', '#creator'],
      instagram: ['#instadaily', '#photooftheday', '#instagood', '#instamood'],
      tiktok: ['#fyp', '#foryoupage', '#viral', '#trending'],
      onlyfans: ['#onlyfans', '#exclusivecontent', '#subscribe']
    };
    return (tags as any)[platform] || [];
  }

  private getStyleHashtags(style: string): string[] {
    const tags = {
      playful: ['#playful', '#fun', '#flirty', '#cute'],
      mysterious: ['#mysterious', '#intrigue', '#shadow', '#mood'],
      bold: ['#bold', '#confident', '#fierce', '#powerful'],
      elegant: ['#elegant', '#classy', '#sophisticated', '#luxury'],
      confident: ['#confidence', '#selflove', '#empowered', '#strong'],
      authentic: ['#authentic', '#real', '#genuine', '#natural'],
      sassy: ['#sassy', '#attitude', '#fierce', '#personality'],
      professional: ['#professional', '#business', '#success', '#career']
    };
    return (tags as any)[style] || ['#content', '#creator'];
  }

  private getNicheHashtags(niche: string): string[] {
    // Generate niche-specific hashtags based on the content niche
    const nicheLower = niche.toLowerCase();
    const tags: string[] = [];
    
    if (nicheLower.includes('fitness')) {
      tags.push('#fitness', '#workout', '#fitfam', '#gym');
    }
    if (nicheLower.includes('fashion')) {
      tags.push('#fashion', '#style', '#ootd', '#fashionista');
    }
    if (nicheLower.includes('beauty')) {
      tags.push('#beauty', '#makeup', '#skincare', '#glam');
    }
    if (nicheLower.includes('travel')) {
      tags.push('#travel', '#wanderlust', '#explore', '#adventure');
    }
    if (nicheLower.includes('food')) {
      tags.push('#foodie', '#yummy', '#delicious', '#foodporn');
    }
    
    return tags;
  }
}

// Export singleton instance
export const enhancedAIGenerator = new EnhancedAIContentGenerator();

// Export main function for backward compatibility
export async function generateEnhancedContent(request: EnhancedAIRequest): Promise<EnhancedAIResponse> {
  return enhancedAIGenerator.generate(request);
}