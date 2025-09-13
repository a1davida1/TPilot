import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';
import { MediaManager } from '../lib/media.js';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';

const router = express.Router();

// Configure multer for media uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Auth request type
type AuthRequest = express.Request & { user?: { id: number; tier?: string } };

// GET /api/media - Get user's media assets
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const assets = await MediaManager.getUserAssets(req.user.id, limit);
    
    logger.info(`Retrieved ${assets.length} media assets for user ${req.user.id}`);
    res.json(assets);
  } catch (error) {
    logger.error('Failed to get user media assets:', error);
    res.status(500).json({ message: 'Failed to retrieve media assets' });
  }
});

// POST /api/media/upload - Upload new media file
router.post('/upload', uploadLimiter, authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read file buffer
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(req.file.path);

    // Determine if watermark should be applied based on user tier
    const userTier = req.user.tier || 'free';
    const applyWatermark = ['free', 'guest'].includes(userTier);

    // Upload file using MediaManager
    const asset = await MediaManager.uploadFile(buffer, {
      userId: req.user.id,
      filename: req.file.originalname,
      visibility: 'private',
      applyWatermark
    });

    // Clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    logger.info(`Media uploaded successfully: ${asset.filename} for user ${req.user.id}`);
    res.json({
      message: 'File uploaded successfully',
      asset
    });
  } catch (error) {
    logger.error('Media upload failed:', error);
    
    // Clean up temp file on error
    if (req.file?.path) {
      const fs = await import('fs/promises');
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    if (error instanceof Error && error.message.includes('quota exceeded')) {
      return res.status(413).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

// GET /api/media/:id - Get specific media asset
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const assetId = parseInt(req.params.id);
    if (isNaN(assetId)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const asset = await MediaManager.getAsset(assetId, req.user.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    logger.error('Failed to get media asset:', error);
    res.status(500).json({ message: 'Failed to retrieve asset' });
  }
});

// DELETE /api/media/:id - Delete media asset
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const assetId = parseInt(req.params.id);
    if (isNaN(assetId)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const success = await MediaManager.deleteAsset(assetId, req.user.id);
    if (!success) {
      return res.status(404).json({ message: 'Asset not found or could not be deleted' });
    }

    logger.info(`Media asset ${assetId} deleted by user ${req.user.id}`);
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete media asset:', error);
    res.status(500).json({ message: 'Failed to delete asset' });
  }
});

// GET /api/media/:id/download - Get download URL for asset
router.get('/:id/download', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const assetId = parseInt(req.params.id);
    if (isNaN(assetId)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const asset = await MediaManager.getAsset(assetId, req.user.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.json({ 
      downloadUrl: asset.downloadUrl || asset.signedUrl,
      filename: asset.filename 
    });
  } catch (error) {
    logger.error('Failed to get download URL:', error);
    res.status(500).json({ message: 'Failed to get download URL' });
  }
});

export { router as mediaRoutes };