import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { CatboxService } from '../lib/catbox-service.js';
import { logger } from '../bootstrap/logger.js';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max
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

      const result = await CatboxService.upload({
        reqtype: 'fileupload',
        file: req.file.buffer,
        filename: req.file.originalname,
        mimeType,
        userhash
      });

      if (!result.success) {
        const statusCode = result.status && result.status >= 400 ? result.status : 400;
        
        return res.status(statusCode).json({ 
          error: result.error || 'Upload failed' 
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

    const result = await CatboxService.upload({
      reqtype: 'urlupload',
      url,
      userhash
    });

    if (!result.success) {
      const statusCode = result.status && result.status >= 400 ? result.status : 400;
      
      return res.status(statusCode).json({ 
        error: result.error || 'URL upload failed' 
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

    // For now, return mock stats until EnhancedCatboxService is integrated
    // TODO: Replace with EnhancedCatboxService.getUserUploadStats(userId)
    const stats = {
      totalUploads: 0,
      totalSize: 0,
      successRate: 100,
      averageDuration: 0
    };

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get upload stats', { error });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
