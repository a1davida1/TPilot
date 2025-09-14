import { Router, type Request, type Response } from 'express';
import { pipeline, InvalidImageError } from '../caption/geminiPipeline';
import { pipelineTextOnly } from '../caption/textOnlyPipeline';
import { pipelineRewrite } from '../caption/rewritePipeline';
import { storage } from '../storage';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { insertContentGenerationSchema } from '@shared/schema.js';
import { z } from 'zod';
import { logger } from '../bootstrap/logger';

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

router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrl, platform, voice, style, mood, nsfw } = generateSchema.parse(req.body ?? {});
    
    const result = await pipeline({ imageUrl, platform, voice, style, mood, nsfw: nsfw || false });
    
    // Save generation to database
    if (req.user?.id && result.final) {
      try {
        await storage.createGeneration({
          userId: req.user.id,
          platform,
          style: style || voice || 'default',
          theme: 'image_based',
          titles: [result.final.caption || 'Generated content'],
          content: result.final.caption || '',
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
    
    return res.status(200).json(result);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Caption generation error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.post('/generate-text', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, theme, context, nsfw } = generateTextSchema.parse(req.body ?? {});
    
    const result = await pipelineTextOnly({ platform, voice, style, mood, theme, context, nsfw: nsfw || false });
    
    // Save generation to database
    if (req.user?.id && result.final) {
      try {
        await storage.createGeneration({
          userId: req.user.id,
          platform,
          style: style || voice || 'default',
          theme: theme || 'lifestyle',
          titles: [result.final.caption || 'Generated content'],
          content: result.final.caption || '',
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
    
    return res.status(200).json(result);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "generation failed";
    logger.error('Text caption generation error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.post('/rewrite', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, existingCaption, imageUrl, nsfw } = rewriteSchema.parse(req.body ?? {});
    
    const result = await pipelineRewrite({ platform, voice, style, mood, existingCaption, imageUrl, nsfw: nsfw || false });
    
    // Save generation to database
    if (req.user?.id && result.final) {
      const finalResult = result.final as Record<string, any>;
      try {
        await storage.createGeneration({
          userId: req.user.id,
          platform,
          style: style || voice || 'default',
          theme: 'rewrite',
          titles: [finalResult.caption || 'Generated content'],
          content: finalResult.caption || '',
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
    
    return res.status(200).json(result);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "rewrite failed";
    logger.error('Caption rewrite error', { error: message });
    if (e instanceof InvalidImageError) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

export { router as captionRouter };