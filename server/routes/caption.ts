import { Router, Request, Response } from 'express';
import { pipeline } from '../caption/geminiPipeline';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { imageUrl, platform, voice } = req.body || {};
    
    if (!imageUrl || !platform) {
      return res.status(400).json({ error: "imageUrl and platform are required" });
    }
    
    // Validate platform
    const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
    }
    
    const result = await pipeline({ imageUrl, platform, voice });
    return res.status(200).json(result);
    
  } catch (e: any) {
    console.error('Caption generation error:', e);
    return res.status(500).json({ error: e.message || "generation failed" });
  }
});

export { router as captionRouter };