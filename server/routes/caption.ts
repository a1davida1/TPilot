import { Router, Request, Response } from 'express';
import { pipeline } from '../caption/geminiPipeline';
import { pipelineTextOnly } from '../caption/textOnlyPipeline';
import { pipelineRewrite } from '../caption/rewritePipeline';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { imageUrl, platform, voice, nsfw } = req.body || {};
    
    if (!imageUrl || !platform) {
      return res.status(400).json({ error: "imageUrl and platform are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
    const result = await pipeline({ imageUrl, platform, voice, nsfw: nsfw || false });
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Caption generation error:', e);
    return res.status(500).json({ error: e.message || "generation failed" });
  }
});

router.post('/generate-text', async (req: Request, res: Response) => {
  try {
    const { platform, voice, theme, context, nsfw } = req.body || {};
    
    if (!platform || !theme) {
      return res.status(400).json({ error: "platform and theme are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
    const result = await pipelineTextOnly({ platform, voice, theme, context, nsfw: nsfw || false });
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Text caption generation error:', e);
    return res.status(500).json({ error: e.message || "generation failed" });
  }
});

router.post('/rewrite', async (req: Request, res: Response) => {
  try {
    const { platform, voice, existingCaption, imageUrl, nsfw } = req.body || {};
    
    if (!platform || !existingCaption) {
      return res.status(400).json({ error: "platform and existingCaption are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
    const result = await pipelineRewrite({ platform, voice, existingCaption, imageUrl, nsfw: nsfw || false });
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Caption rewrite error:', e);
    return res.status(500).json({ error: e.message || "rewrite failed" });
  }
});

export { router as captionRouter };