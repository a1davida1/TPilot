import express, { type Response } from 'express';
import multer from 'multer';

import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { RedditNativeUploadService } from '../services/reddit-native-upload.js';
import { logger } from '../bootstrap/logger.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are supported'));
      return;
    }
    cb(null, true);
  },
});

router.post('/prepare', authenticateToken(true), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : undefined;
    const nsfwValue = req.body?.nsfw;
    const nsfw = typeof nsfwValue === 'string'
      ? nsfwValue.toLowerCase() === 'true'
      : Boolean(nsfwValue);

    if (!req.file && !imageUrl) {
      return res.status(400).json({ error: 'Provide either an image file or imageUrl' });
    }

    const result = await RedditNativeUploadService.preparePortalUpload({
      userId: req.user.id,
      imageBuffer: req.file?.buffer,
      imageUrl,
      nsfw,
    });

    if (!result.success) {
      const status = result.error?.includes('size') ? 413 : 400;
      return res.status(status).json({
        success: false,
        error: result.error ?? 'Failed to prepare image upload',
        warnings: result.warnings,
      });
    }

    return res.json({
      success: true,
      assetId: result.assetId,
      previewUrl: result.previewUrl,
      provider: result.provider,
      width: result.width,
      height: result.height,
      warnings: result.warnings,
    });
  } catch (error) {
    logger.error('Portal upload preparation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
