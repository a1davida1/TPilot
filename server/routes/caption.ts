import { Router, Request, Response } from 'express';
import { pipeline } from '../caption/geminiPipeline';
import { pipelineTextOnly } from '../caption/textOnlyPipeline';
import { pipelineRewrite } from '../caption/rewritePipeline';
import { storage } from '../storage';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { insertContentGenerationSchema } from '@shared/schema';

const router = Router();

router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrl, platform, voice, style, mood, nsfw } = req.body || {};
    
    if (!imageUrl || !platform) {
      return res.status(400).json({ error: "imageUrl and platform are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
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
        console.error('Failed to save generation to database:', dbError);
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Caption generation error:', e);
    return res.status(500).json({ error: e.message || "generation failed" });
  }
});

router.post('/generate-text', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, theme, context, nsfw } = req.body || {};
    
    if (!platform || !theme) {
      return res.status(400).json({ error: "platform and theme are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
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
        console.error('Failed to save generation to database:', dbError);
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Text caption generation error:', e);
    return res.status(500).json({ error: e.message || "generation failed" });
  }
});

router.post('/rewrite', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, voice, style, mood, existingCaption, imageUrl, nsfw } = req.body || {};
    
    if (!platform || !existingCaption) {
      return res.status(400).json({ error: "platform and existingCaption are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
    const result = await pipelineRewrite({ platform, voice, style, mood, existingCaption, imageUrl, nsfw: nsfw || false });
    
    // Save generation to database
    if (req.user?.id && result.final) {
      try {
        await storage.createGeneration({
          userId: req.user.id,
          platform,
          style: style || voice || 'default',
          theme: 'rewrite',
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
          prompt: `Rewrite existing content for ${platform}: "${existingCaption.substring(0, 100)}..."`,
          generationType: 'ai',
          allowsPromotion: nsfw || false
        });
      } catch (dbError) {
        console.error('Failed to save generation to database:', dbError);
        // Don't fail the request if database save fails
      }
    }
    
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Caption rewrite error:', e);
    return res.status(500).json({ error: e.message || "rewrite failed" });
  }
});

export { router as captionRouter };