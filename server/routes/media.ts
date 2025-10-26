import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';
import { MediaManager } from '../lib/media.js';
import { ImgboxService } from '../lib/imgbox-service.js';
import multer from 'multer';

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

function _parseWatermarkOverride(value: unknown): boolean | null {
  if (Array.isArray(value)) {
    return _parseWatermarkOverride(value[0]);
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

// GET /api/media - Get user's media assets
router.get('/', authenticateToken(true), async (req: AuthRequest, res) => {
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

// POST /api/media/upload - Upload new media file to Imgbox
router.post('/upload', uploadLimiter, authenticateToken(true), upload.single('file'), async (req: AuthRequest, res) => {
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

    // Try Imgbox upload first, fall back to base64 if it fails
    let imageUrl: string;
    let thumbnailUrl: string | undefined;
    
    try {
      const imgboxResult = await ImgboxService.upload({
        buffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        nsfw: true, // Mark as mature content
      });
      
      if (!imgboxResult.success || !imgboxResult.url) {
        throw new Error(imgboxResult.error || 'Imgbox upload failed');
      }
      
      imageUrl = imgboxResult.url;
      thumbnailUrl = imgboxResult.thumbnailUrl;
      logger.info(`Media uploaded to Imgbox successfully: ${req.file.originalname}`);
    } catch (imgboxError) {
      // Fallback: Convert to base64 data URL (temporary storage)
      logger.warn('Imgbox upload failed, using base64 fallback:', imgboxError);
      const base64 = buffer.toString('base64');
      const mimeType = req.file.mimetype || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
      thumbnailUrl = imageUrl; // Same as main URL for base64
      logger.info(`Media stored as base64 data URL: ${req.file.originalname} (${base64.length} chars)`);
    }
    
    // Clean up temp file immediately
    await fs.unlink(req.file.path).catch(() => {});

    // Return response in format compatible with existing frontend
    res.json({
      message: 'File uploaded successfully',
      asset: {
        id: Date.now(), // Temporary ID for frontend compatibility
        userId: req.user.id,
        filename: req.file.originalname,
        bytes: buffer.length,
        mime: req.file.mimetype,
        signedUrl: imageUrl,
        downloadUrl: imageUrl,
        thumbnailUrl: thumbnailUrl,
        provider: imageUrl.startsWith('data:') ? 'base64' : 'imgbox',
        createdAt: new Date(),
      }
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
router.get('/:id', authenticateToken(true), async (req: AuthRequest, res) => {
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
router.delete('/:id', authenticateToken(true), async (req: AuthRequest, res) => {
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
router.get('/:id/download', authenticateToken(true), async (req: AuthRequest, res) => {
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