import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uploadAnonymousToImgur, uploadAuthorizedToImgur, deleteFromImgur, getDailyUsageStats } from '../services/imgur-uploader.js';
import { logger } from '../bootstrap/logger.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { storage } from '../storage.js';
import { pool } from '../db.js';

const router = Router();

// Configure multer for memory storage with 15MB limit for Imgur
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { 
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const uploadBodySchema = z.object({
  markSensitive: z.boolean().optional().default(true),
  useAlbum: z.boolean().optional().default(false)
});

/**
 * POST /api/uploads/imgur
 * Upload image to Imgur (anonymous or authorized)
 */
router.post('/imgur', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const params = uploadBodySchema.parse(req.body);
    
    // Check if user is authenticated and has Imgur OAuth token
    const authReq = req as AuthRequest;
    const userImgurToken = authReq.user?.id ? await getUserImgurToken(authReq.user.id) : null;
    
    let result;
    
    if (userImgurToken) {
      // Use authorized upload for better limits and management
      result = await uploadAuthorizedToImgur(
        req.file.buffer,
        req.file.originalname,
        userImgurToken
      );
      logger.info('Imgur authorized upload successful', { userId: authReq.user?.id });
    } else {
      // Use anonymous upload
      result = await uploadAnonymousToImgur(
        req.file.buffer,
        req.file.originalname,
        params.markSensitive
      );
    }

    // Store metadata if user is authenticated
    if (authReq.user?.id) {
      try {
        await pool.query(
          `INSERT INTO user_storage_assets 
           (user_id, provider, url, delete_hash, source_filename, width, height, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            authReq.user.id,
            userImgurToken ? 'imgur-auth' : 'imgur-anon',
            result.link,
            result.deleteHash,
            req.file.originalname,
            result.width,
            result.height
          ]
        );
      } catch (dbError) {
        logger.warn('Failed to store upload metadata', { error: dbError });
        // Continue - upload was successful even if metadata storage failed
      }
    }

    res.json({
      success: true,
      imageUrl: result.link,
      deleteHash: result.deleteHash,
      dimensions: { 
        width: result.width, 
        height: result.height 
      },
      provider: userImgurToken ? 'imgur-auth' : 'imgur-anon'
    });
  } catch (error: any) {
    logger.error('Imgur upload failed', { 
      error: error.message,
      filename: req.file?.originalname 
    });
    
    // Check if it's a rate limit error
    if (error.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'Upload limit reached',
        message: 'Daily upload limit reached. Please paste an image URL instead.',
        fallback: true
      });
    }
    
    res.status(502).json({
      error: 'Upload failed',
      message: error.message || 'Failed to upload to Imgur',
      fallback: true,
      fallbackMessage: 'You can paste a direct image URL (Imgur, Catbox, Discord) instead.'
    });
  }
});

/**
 * DELETE /api/uploads/imgur/:deleteHash
 * Delete image from Imgur
 */
router.delete('/imgur/:deleteHash', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const { deleteHash } = req.params;
    
    if (!deleteHash) {
      return res.status(400).json({ error: 'Delete hash required' });
    }

    // Verify ownership if user is authenticated
    if (req.user?.id) {
      const result = await pool.query(
        'SELECT id FROM user_storage_assets WHERE user_id = $1 AND delete_hash = $2',
        [req.user.id, deleteHash]
      );
      
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to delete this image' });
      }
    }

    const deleted = await deleteFromImgur(deleteHash);
    
    if (deleted && req.user?.id) {
      // Remove from database if successful
      await pool.query(
        'DELETE FROM user_storage_assets WHERE delete_hash = $1',
        [deleteHash]
      );
    }

    res.json({
      success: deleted,
      message: deleted ? 'Image deleted' : 'Failed to delete image'
    });
  } catch (error: any) {
    logger.error('Imgur delete failed', { error: error.message });
    res.status(500).json({
      error: 'Delete failed',
      message: error.message
    });
  }
});

/**
 * GET /api/uploads/imgur/stats
 * Get current usage statistics
 */
router.get('/imgur/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getDailyUsageStats();
    
    res.json({
      ...stats,
      percentUsed: Math.round((stats.used / stats.limit) * 100),
      nearLimit: stats.remaining < 100
    });
  } catch (error: any) {
    logger.error('Failed to get Imgur stats', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve usage stats' });
  }
});

/**
 * GET /api/uploads/imgur/my-uploads
 * Get user's uploaded images
 */
router.get('/imgur/my-uploads', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT url, delete_hash, source_filename, width, height, provider, created_at
       FROM user_storage_assets
       WHERE user_id = $1 AND provider LIKE 'imgur%'
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json({
      uploads: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    logger.error('Failed to fetch user uploads', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve uploads' });
  }
});

// Helper function to get user's Imgur OAuth token
// TODO: Add imgurAccessToken field to users table for authorized uploads
async function getUserImgurToken(_userId: number): Promise<string | null> {
  // For now, always use anonymous uploads
  // In future, retrieve from user.imgurAccessToken after schema update
  return null;
}

export default router;
