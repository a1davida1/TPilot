import { Router, type Response } from 'express';
import { pipeline, InvalidImageError } from '../caption/geminiPipeline';
import { pipelineTextOnly } from '../caption/textOnlyPipeline';
import { pipelineRewrite } from '../caption/rewritePipeline';
import { storage } from '../storage';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { type CaptionObject } from '@shared/types/caption';
import { z } from 'zod';
import { logger } from '../bootstrap/logger';
import { generateCaptionsWithFallback } from '../lib/openrouter';

// Local validation schema to prevent import issues
const captionObjectSchema = z.object({
  caption: z.string(),
  alt: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mood: z.string().optional(),
  style: z.string().optional(),
  cta: z.string().optional(),
  safety_level: z.enum(['normal', 'spicy_safe', 'unsafe']).optional(),
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

const generateSchema = z.object({
  imageUrl: z.string(),
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  nsfw: z.boolean().optional()
});

const generateTextSchema = z.object({
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  theme: z.string(),
  context: z.string().optional(),
  nsfw: z.boolean().optional()
});

const rewriteSchema = z.object({
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional(),
  existingCaption: z.string(),
  imageUrl: z.string().optional(),
  nsfw: z.boolean().optional()
});

router.post('/generate', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrl, platform, voice, style, mood, nsfw } = generateSchema.parse(req.body ?? {});
    
    const result = await pipeline({ imageUrl, platform, voice, style, mood, nsfw: nsfw || false });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.titles);
      try {
        await storage.createGeneration({
          userId: req.user.id,
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
      } catch (dbError) {
        logger.error('Failed to save generation to database', { error: dbError });
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Caption generation error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.post('/generate-text', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, theme, context, nsfw } = generateTextSchema.parse(req.body ?? {});
    
    const result = await pipelineTextOnly({ platform, voice, style, mood, theme, context, nsfw: nsfw || false });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.titles);
      try {
        await storage.createGeneration({
          userId: req.user.id,
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
      } catch (dbError) {
        logger.error('Failed to save generation to database', { error: dbError });
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Text caption generation error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.post('/rewrite', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, existingCaption, imageUrl, nsfw } = rewriteSchema.parse(req.body ?? {});
    
    const result = await pipelineRewrite({ platform, voice, style, mood, existingCaption, imageUrl, nsfw: nsfw || false });
    
    // Validate response payload matches expected schema
    const validatedResult = generationResponseSchema.parse(result);
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const { caption: captionText, titles } = extractCaptionMetadata(result.final, result.titles);
      try {
        await storage.createGeneration({
          userId: req.user.id,
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
      } catch (dbError) {
        logger.error('Failed to save generation to database', { error: dbError });
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(validatedResult);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "rewrite failed";
    logger.error('Caption rewrite error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
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

    // Generate two-caption variants using OpenRouter (Grok4 Fast → Claude 3 Opus fallback)
    const result = await generateCaptionsWithFallback(image_base64, {
      primaryModel: 'x-ai/grok-4-fast',
      fallbackModel: 'anthropic/claude-3-opus'
    });

    // Format response for two-caption picker
    const captions = [
      {
        id: `flirty_${Date.now()}`,
        text: result.captions.flirty,
        style: 'flirty'
      },
      {
        id: `slutty_${Date.now() + 1}`,
        text: result.captions.slutty,
        style: 'slutty'
      }
    ];

    return res.status(200).json({
      captions,
      category: result.category,
      tags: result.tags
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Caption generation failed';
    logger.error('One-click caption generation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as captionRouter };