import { Router, type Response } from 'express';
import { pipeline, OpenRouterError } from '../caption/openrouterPipeline';
import { storage } from '../storage';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { type CaptionObject } from '@shared/types/caption';
import { z } from 'zod';
import { logger } from '../bootstrap/logger';

// Local validation schema to prevent import issues
const captionObjectSchema = z.object({
  caption: z.string(),
  alt: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mood: z.string().optional(),
  style: z.string().optional(),
  cta: z.string().optional(),
  safety_level: z.enum(['normal', 'spicy_safe', 'unsafe', 'needs_review']).optional(),
  titles: z.array(z.string()).min(1).optional(),
});

const rankedResultSchema = z.object({
  reason: z.string().optional(),
}).catchall(z.unknown());

const generationResponseSchema = z.object({
  final: z.union([z.string(), captionObjectSchema]),
  ranked: z.union([z.array(z.string()), rankedResultSchema]),
  facts: z.record(z.string(), z.unknown()).optional(),
  provider: z.string().optional(),
  titles: z.array(z.string()).min(1).optional(),
  // Top 2 caption options for user selection (Quick Post workflow)
  topVariants: z.array(captionObjectSchema).min(1).max(2).optional(),
}).catchall(z.unknown());

function extractCaptionMetadata(final: unknown, titlesHint?: unknown): { caption: string; titles: string[] } {
  const normalizedHint = Array.isArray(titlesHint)
    ? titlesHint.filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
    : [];
  if (typeof final === 'string') {
    const trimmed = final.trim();
    const fallback = trimmed.length > 0 ? trimmed : 'Generated content';
    if (normalizedHint.length > 0) {
      return { caption: final, titles: normalizedHint };
    }
    return { caption: final, titles: [fallback] };
  }
  if (final && typeof final === 'object') {
    const value = final as CaptionObject & { titles?: string[] };
    const captionText = typeof value.caption === 'string' ? value.caption : '';
    const providedTitles = Array.isArray(value.titles)
      ? value.titles.filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
      : [];
    const fallback = captionText.trim().length > 0 ? captionText.trim() : 'Generated content';
    const titles = [...providedTitles, ...normalizedHint.filter(title => !providedTitles.includes(title))];
    if (titles.length > 0) {
      return { caption: captionText, titles };
    }
    return { caption: captionText, titles: [fallback] };
  }
  return { caption: '', titles: ['Generated content'] };
}

const router = Router();

function scheduleGenerationSave(
  task: () => Promise<void>,
  metadata?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      await task();
    } catch (error) {
      logger.error('Failed to save generation to database', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...metadata,
      });
    }
  })();
}


const generateSchema = z.object({
  imageUrl: z.string(),
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  nsfw: z.boolean().optional(),
  promotionMode: z.enum(['none', 'subtle', 'explicit']).default('none')
});

const generateTextSchema = z.object({
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  theme: z.string(),
  context: z.string().optional(),
  nsfw: z.boolean().optional(),
  promotionMode: z.enum(['none', 'subtle', 'explicit']).default('none')
});

const rewriteSchema = z.object({
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  existingCaption: z.string(),
  imageUrl: z.string().optional(),
  nsfw: z.boolean().optional(),
  promotionMode: z.enum(['none', 'subtle', 'explicit']).default('none')
});

router.post('/generate', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrl, platform, voice, style, mood, nsfw, promotionMode } = generateSchema.parse(req.body ?? {});
    
    // Fetch user preferences for promotional URLs
    let promotionalUrl: string | undefined;
    if (promotionMode === 'explicit' && req.user?.id) {
      try {
        const prefs = await storage.getUserPreferences(req.user.id);
        promotionalUrl = prefs?.onlyFansUrl || prefs?.fanslyUrl || undefined;
      } catch (_e) {
        logger.warn('Failed to fetch user preferences for promotional URL', { userId: req.user.id });
      }
    }
    
    const result = await pipeline({ 
      imageUrl, 
      platform, 
      voice, 
      style, 
      mood, 
      nsfw: nsfw || false,
      promotionMode,
      promotionalUrl
    });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.final.titles);
      const userId = req.user.id;
      scheduleGenerationSave(
        async () => {
          await storage.createGeneration({
            userId,
            platform,
            style: style || voice || 'default',
            theme: 'image_based',
            titles,
            content: captionText || '',
            photoInstructions: {
              lighting: 'Natural lighting',
              cameraAngle: 'Eye level',
              composition: 'Center composition',
              styling: 'Authentic styling',
              mood: 'Confident and natural',
              technicalSettings: 'Auto settings'
            },
            prompt: `Image-based generation for ${platform}`,
            generationType: 'ai',
            allowsPromotion: nsfw || false
          });
        },
        { userId, platform },
      );
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Caption generation error', { error: message, cause: e instanceof Error ? e.cause : undefined });
    if (e instanceof OpenRouterError) {
      // Use a 502 Bad Gateway for upstream provider failures
      return res.status(502).json({ error: 'AI provider failed: ' + message });
    }
    return res.status(500).json({ error: message });
  }
});

router.post('/generate-text', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, theme, context, nsfw, promotionMode } = generateTextSchema.parse(req.body ?? {});
    // Note: context is parsed but not currently used by OpenRouter pipeline
    
    // Fetch user preferences for promotional URLs
    let promotionalUrl: string | undefined;
    if (promotionMode === 'explicit' && req.user?.id) {
      try {
        const prefs = await storage.getUserPreferences(req.user.id);
        promotionalUrl = prefs?.onlyFansUrl || prefs?.fanslyUrl || undefined;
      } catch (_e) {
        logger.warn('Failed to fetch user preferences for promotional URL', { userId: req.user.id });
      }
    }
    
    // Use OpenRouter pipeline with synthetic image facts based on theme/context
    // Create a 1x1 transparent PNG as a placeholder (OpenRouter pipeline requires an image)
    const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    // Use the pipeline but inject synthetic facts
    const result = await pipeline({
      imageUrl: transparentPng,
      platform,
      voice,
      style,
      mood,
      nsfw: nsfw || false,
      mandatoryTokens: theme ? [theme] : undefined,
      promotionMode,
      promotionalUrl
    });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.titles);
      const userId = req.user.id;
      scheduleGenerationSave(
        async () => {
          await storage.createGeneration({
            userId,
            platform,
            style: style || voice || 'default',
            theme: theme || 'lifestyle',
            titles,
            content: captionText || '',
            photoInstructions: {
              lighting: 'Natural lighting',
              cameraAngle: 'Eye level',
              composition: 'Center composition',
              styling: 'Authentic styling',
              mood: 'Confident and natural',
              technicalSettings: 'Auto settings'
            },
            prompt: `Text-based generation: ${theme} for ${platform}${context ? ` - ${context}` : ''}`,
            generationType: 'ai',
            allowsPromotion: nsfw || false
          });
        },
        { userId, platform },
      );
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Text caption generation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

router.post('/rewrite', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, existingCaption, imageUrl, nsfw, promotionMode } = rewriteSchema.parse(req.body ?? {});
    
    // Fetch user preferences for promotional URLs
    let promotionalUrl: string | undefined;
    if (promotionMode === 'explicit' && req.user?.id) {
      try {
        const prefs = await storage.getUserPreferences(req.user.id);
        promotionalUrl = prefs?.onlyFansUrl || prefs?.fanslyUrl || undefined;
      } catch (_e) {
        logger.warn('Failed to fetch user preferences for promotional URL', { userId: req.user.id });
      }
    }
    
    // Use OpenRouter pipeline with the existing caption as context
    // If no image provided, use a transparent placeholder
    const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const finalImageUrl = imageUrl || transparentPng;
    
    const result = await pipeline({
      imageUrl: finalImageUrl,
      platform,
      voice,
      style,
      mood,
      nsfw: nsfw || false,
      existingCaption,
      promotionMode,
      promotionalUrl
    });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.titles);
      const userId = req.user.id;
      scheduleGenerationSave(
        async () => {
          await storage.createGeneration({
            userId,
            platform,
            style: style || voice || 'default',
            theme: 'rewrite',
            titles,
            content: captionText || '',
            photoInstructions: {
              lighting: 'Natural lighting',
              cameraAngle: 'Eye level',
              composition: 'Center composition',
              styling: 'Authentic styling',
              mood: 'Confident and natural',
              technicalSettings: 'Auto settings'
            },
            prompt: `Rewrite existing content for ${platform}: "${existingCaption.substring(0, 100)}..."`,
            generationType: 'ai',
            allowsPromotion: nsfw || false
          });
        },
        { userId, platform },
      );
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "rewrite failed";
    logger.error('Caption rewrite error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * One-click caption generation with Grok4 Fast (primary) / Claude 3 Opus (fallback)
 * Returns two caption styles: Flirty and Slutty
 * Ephemeral processing: image base64 in memory only, never written to disk
 */
const oneClickCaptionSchema = z.object({
  image_base64: z.string(),
  user_profile: z.record(z.unknown()).optional()
});

router.post('/one-click-captions', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { image_base64 } = oneClickCaptionSchema.parse(req.body ?? {});

    // Convert base64 to data URL for our pipeline
    const imageUrl = `data:image/jpeg;base64,${image_base64}`;
    
    // Select two different NSFW voices for variety
    const nsfwVoices = ['seductive_goddess', 'intimate_girlfriend', 'bratty_tease', 'submissive_kitten'];
    const shuffled = [...nsfwVoices].sort(() => Math.random() - 0.5);
    const voice1 = shuffled[0];
    const voice2 = shuffled[1];
    
    // Use our sophisticated pipeline with two different voices for variety
    // Run both in parallel for speed
    const [result1, result2] = await Promise.all([
      pipeline({ 
        imageUrl, 
        platform: 'reddit', 
        voice: voice1,
        nsfw: true 
      }),
      pipeline({ 
        imageUrl, 
        platform: 'reddit', 
        voice: voice2,
        nsfw: true 
      })
    ]);

    // Extract the top variants from each result
    const caption1 = result1.topVariants?.[0] || result1.final;
    const caption2 = result2.topVariants?.[0] || result2.final;
    
    // Format captions
    const formatCaption = (cap: unknown): string => {
      if (typeof cap === 'string') return cap;
      if (cap && typeof cap === 'object' && 'caption' in cap) {
        const captionObj = cap as CaptionObject;
        return captionObj.caption || '';
      }
      return '';
    };

    // Format response for two-caption picker
    const captions = [
      {
        id: `${voice1}_${Date.now()}`,
        text: formatCaption(caption1),
        style: voice1
      },
      {
        id: `${voice2}_${Date.now() + 1}`,
        text: formatCaption(caption2),
        style: voice2
      }
    ];

    // Extract category and tags from facts
    const facts = result1.facts || {};
    const categories = Array.isArray(facts.categories) ? facts.categories as string[] : [];
    const category = categories[0] || 'lifestyle';
    const keywords = Array.isArray(facts.keywords) ? facts.keywords as string[] : [];
    const tags = keywords;

    return res.status(200).json({
      captions,
      category,
      tags
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Caption generation failed';
    logger.error('One-click caption generation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as captionRouter };