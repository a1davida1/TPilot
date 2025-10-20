import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { CatboxService } from '../lib/catbox-service.js';
import { CatboxAnalyticsService } from '../services/catbox-analytics-service.js';
import { getUserCatboxGalleryUploads } from '../services/catbox-gallery-service.js';
import { logger } from '../bootstrap/logger.js';
import multer from 'multer';

const router = Router();

const uploadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

function extractFilenameFromUrl(rawUrl: string): string | undefined {
  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.pathname.split('/');
    const filename = parts[parts.length - 1];
    if (!filename) {
      return undefined;
    }
    const decoded = decodeURIComponent(filename);
    return decoded.trim() ? decoded : undefined;
  } catch (_error) {
    return undefined;
  }
}

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max
});

router.get('/uploads', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = uploadsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const uploads = await getUserCatboxGalleryUploads(userId, parsed.data.limit);
    return res.status(200).json({ uploads });
  } catch (error) {
    logger.error('Failed to load Catbox uploads', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id ?? null,
    });
    return res.status(500).json({ error: 'Failed to load Catbox uploads' });
  }
});

/**
 * GET /api/catbox/hash
 * Get user's Catbox hash
 */
router.get('/hash', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hash = await CatboxService.getUserHash(userId);
    res.json({ hash: hash || null });
  } catch (error) {
    logger.error('Failed to get Catbox hash', { error });
    res.status(500).json({ error: 'Failed to get Catbox hash' });
  }
});

/**
 * POST /api/catbox/hash
 * Save user's Catbox hash
 */
router.post('/hash', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { hash } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ error: 'Invalid hash' });
    }

    const success = await CatboxService.saveUserHash(userId, hash);
    res.json({ success });
  } catch (error) {
    logger.error('Failed to save Catbox hash', { error });
    res.status(500).json({ error: 'Failed to save Catbox hash' });
  }
});

/**
 * POST /api/catbox/upload
 * Upload file to Catbox with optional authentication
 */
router.post('/upload', 
  authenticateToken(), // Optional authentication
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Get user's hash if authenticated
      let userhash: string | undefined;
      if (req.user?.id) {
        const hash = await CatboxService.getUserHash(req.user.id);
        if (hash) userhash = hash;
      }

      const mimeType = req.file.mimetype?.trim() || 'application/octet-stream';

      const uploadStartedAt = Date.now();
      const result = await CatboxService.upload({
        reqtype: 'fileupload',
        file: req.file.buffer,
        filename: req.file.originalname,
        mimeType,
        userhash
      });
      const uploadDuration = Date.now() - uploadStartedAt;

      const analyticsBase = req.user?.id
        ? {
            userId: req.user.id,
            filename: req.file.originalname,
            fileSize: typeof req.file.size === 'number' ? req.file.size : undefined,
            uploadDuration,
            provider: 'catbox',
          }
        : null;

      if (!result.success) {
        if (analyticsBase) {
          await CatboxAnalyticsService.recordUpload({
            ...analyticsBase,
            url: result.url,
            success: false,
            errorMessage: result.error ?? undefined,
          });
        }

        const statusCode = result.status && result.status >= 400 ? result.status : 400;
        
        return res.status(statusCode).json({
          error: result.error || 'Upload failed'
        });
      }

      if (analyticsBase) {
        await CatboxAnalyticsService.recordUpload({
          ...analyticsBase,
          url: result.url,
          success: true,
        });
      }

      res.json({
        success: true,
        url: result.url,
        authenticated: !!userhash
      });

    } catch (error) {
      logger.error('Catbox upload error', { error });
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/**
 * POST /api/catbox/upload-url
 * Upload from URL to Catbox
 */
router.post('/upload-url', authenticateToken(), async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Get user's hash if authenticated
    let userhash: string | undefined;
    if (req.user?.id) {
      const hash = await CatboxService.getUserHash(req.user.id);
      if (hash) userhash = hash;
    }

    const uploadStartedAt = Date.now();
    const result = await CatboxService.upload({
      reqtype: 'urlupload',
      url,
      userhash
    });
    const uploadDuration = Date.now() - uploadStartedAt;

    const fallbackFilename = extractFilenameFromUrl(url) ?? null;
    const analyticsBase = req.user?.id
      ? {
          userId: req.user.id,
          sourceUrl: url,
          uploadDuration,
          provider: 'catbox',
        }
      : null;

    if (!result.success) {
      if (analyticsBase) {
        await CatboxAnalyticsService.recordUpload({
          ...analyticsBase,
          url: result.url,
          filename: fallbackFilename,
          success: false,
          errorMessage: result.error ?? undefined,
        });
      }

      const statusCode = result.status && result.status >= 400 ? result.status : 400;
      
      return res.status(statusCode).json({
        error: result.error || 'URL upload failed'
      });
    }

    if (analyticsBase) {
      const resultFilename = result.url ? extractFilenameFromUrl(result.url) ?? null : null;
      await CatboxAnalyticsService.recordUpload({
        ...analyticsBase,
        url: result.url,
        filename: resultFilename ?? fallbackFilename,
        success: true,
      });
    }

    res.json({
      success: true,
      url: result.url,
      authenticated: !!userhash
    });

  } catch (error) {
    logger.error('Catbox URL upload error', { error });
    res.status(500).json({ error: 'URL upload failed' });
  }
});

/**
 * DELETE /api/catbox/files
 * Delete files from Catbox (requires authentication and hash)
 */
router.delete('/files', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { files } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Invalid files array' });
    }

    // Get user's hash
    const hash = await CatboxService.getUserHash(userId);
    if (!hash) {
      return res.status(400).json({ 
        error: 'Catbox authentication not configured. Add your Catbox hash in settings.' 
      });
    }

    const result = await CatboxService.deleteFiles(hash, files);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Delete failed' 
      });
    }

    res.json({ success: true });

  } catch (error) {
    logger.error('Catbox delete error', { error });
    res.status(500).json({ error: 'Delete failed' });
  }
});

/**
 * POST /api/catbox/album
 * Create album on Catbox
 */
router.post('/album', authenticateToken(), async (req: AuthRequest, res) => {
  try {
    const { title, description, files } = req.body;
    
    if (!title || !description || !Array.isArray(files)) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, description, files' 
      });
    }
    
    if (files.length > 500) {
      return res.status(400).json({ 
        error: 'Albums are limited to 500 files' 
      });
    }

    // Get user's hash if authenticated
    let userhash: string | null = null;
    if (req.user?.id) {
      const hash = await CatboxService.getUserHash(req.user.id);
      if (hash) userhash = hash;
    }

    const result = await CatboxService.createAlbum(
      userhash,
      title,
      description,
      files
    );

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Album creation failed' 
      });
    }

    res.json({
      success: true,
      url: result.url,
      short: result.short,
      authenticated: !!userhash
    });

  } catch (error) {
    logger.error('Catbox album error', { error });
    res.status(500).json({ error: 'Album creation failed' });
  }
});

/**
 * GET /api/catbox/stats
 * Get user's upload statistics
 */
router.get('/stats', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await CatboxAnalyticsService.getUploadStats(userId);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get upload stats', { error });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
