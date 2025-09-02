import { Router } from 'express';
import { pipeline } from '../caption/geminiPipeline.js';
import { pipelineTextOnly } from '../caption/textOnlyPipeline.js';
import { pipelineRewrite } from '../caption/rewritePipeline.js';
const router = Router();
router.post('/generate', async (req, res) => {
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
    }
    catch (e) {
        console.error('Caption generation error:', e);
        return res.status(500).json({ error: e.message || "generation failed" });
    }
});
router.post('/generate-text', async (req, res) => {
    try {
        const { platform, voice, theme, context } = req.body || {};
        if (!platform || !theme) {
            return res.status(400).json({ error: "platform and theme are required" });
        }
        // Validate platform
        const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
        }
        const result = await pipelineTextOnly({ platform, voice, theme, context });
        return res.status(200).json(result);
    }
    catch (e) {
        console.error('Text caption generation error:', e);
        return res.status(500).json({ error: e.message || "generation failed" });
    }
});
router.post('/rewrite', async (req, res) => {
    try {
        const { platform, voice, existingCaption, imageUrl } = req.body || {};
        if (!platform || !existingCaption) {
            return res.status(400).json({ error: "platform and existingCaption are required" });
        }
        // Validate platform
        const validPlatforms = ["instagram", "x", "reddit", "tiktok"];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({ error: "Invalid platform. Must be one of: instagram, x, reddit, tiktok" });
        }
        const result = await pipelineRewrite({ platform, voice, existingCaption, imageUrl });
        return res.status(200).json(result);
    }
    catch (e) {
        console.error('Caption rewrite error:', e);
        return res.status(500).json({ error: e.message || "rewrite failed" });
    }
});
export { router as captionRouter };
