import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { MediaManager } from '../lib/media.js';
import * as ImgurService from '../services/imgur-uploader.js';
import { ImgboxService } from '../lib/imgbox-service.js';
import { PostImagesService } from '../lib/postimages-service.js';
import { SimpleImageUpload } from '../lib/simple-image-upload.js';
import { DirectUpload } from '../lib/direct-upload.js';
import { WorkingUpload } from '../lib/working-upload.js';
import { logger } from '../bootstrap/logger.js';
import multer from 'multer';
import { db } from '../database.js';
import { userStorageAssets } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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

    // Fetch from both mediaAssets (local/S3) and userStorageAssets (external URLs)
    const [localAssets, externalAssets] = await Promise.all([
      MediaManager.getUserAssets(req.user.id, limit),
      db.select()
        .from(userStorageAssets)
        .where(eq(userStorageAssets.userId, req.user.id))
        .orderBy(desc(userStorageAssets.createdAt))
        .limit(limit)
    ]);

    // Transform external assets to match frontend schema
    const transformedExternalAssets = externalAssets.map((asset: typeof userStorageAssets.$inferSelect) => ({
      id: asset.id,
      userId: asset.userId,
      filename: asset.sourceFilename || 'unknown',
      bytes: asset.fileSize || 0,
      mime: asset.mimeType || 'image/jpeg',
      signedUrl: asset.url,
      downloadUrl: asset.url,
      thumbnailUrl: (asset.metadata as any)?.thumbnailUrl || asset.url,
      provider: asset.provider,
      createdAt: asset.createdAt,
    }));

    // Merge and sort by createdAt descending
    const allAssets = [...localAssets, ...transformedExternalAssets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    logger.info(`Retrieved ${allAssets.length} media assets for user ${req.user.id} (${localAssets.length} local, ${externalAssets.length} external)`);
    res.json(allAssets);
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

    // Try external upload services in order
    let imageUrl: string;
    let thumbnailUrl: string | undefined;
    let provider: string = 'unknown';

    // Try Imgur first (PRIMARY - required for legal compliance)
    try {
      const imgurResult = await ImgurService.uploadAnonymousToImgur(
        buffer,
        req.file.originalname,
        true // markMature for NSFW content
      );

      logger.debug('Imgur result:', {
        hasLink: !!imgurResult.link,
        link: imgurResult.link,
        deleteHash: imgurResult.deleteHash,
      });

      if (imgurResult.link) {
        imageUrl = imgurResult.link;
        thumbnailUrl = imgurResult.link; // Imgur doesn't provide separate thumbnail
        provider = 'imgur';
        logger.info(`Media uploaded to Imgur successfully: ${req.file.originalname}`, {
          url: imageUrl,
        });
      } else {
        throw new Error('Imgur upload succeeded but no link provided');
      }
    } catch (imgurError) {
      logger.warn('Imgur upload failed, trying Imgbox:', imgurError);

      // Fallback to Imgbox
      try {
        const imgboxResult = await ImgboxService.upload({
          buffer,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          nsfw: true,
        });

        logger.debug('Imgbox result:', {
          success: imgboxResult.success,
          hasUrl: !!imgboxResult.url,
          url: imgboxResult.url,
          thumbnailUrl: imgboxResult.thumbnailUrl,
          error: imgboxResult.error,
        });

        if (imgboxResult.success && imgboxResult.url) {
          imageUrl = imgboxResult.url;
          thumbnailUrl = imgboxResult.thumbnailUrl;
          provider = 'imgbox';
          logger.info(`Media uploaded to Imgbox successfully: ${req.file.originalname}`, {
            url: imageUrl,
            thumbnailUrl,
          });
        } else if (imgboxResult.success && !imgboxResult.url) {
          // This is the "upload succeeded but no url provided" case
          logger.error('CRITICAL: Imgbox reported success but no URL provided', {
            result: imgboxResult,
            resultKeys: Object.keys(imgboxResult),
          });
          throw new Error('Imgbox upload succeeded but no URL provided');
        } else {
          throw new Error(imgboxResult.error || 'Imgbox upload failed');
        }
      } catch (imgboxError) {
        logger.warn('Imgbox upload failed, trying PostImages:', imgboxError);
      
      // Fallback to PostImages
      try {
        const postimagesResult = await PostImagesService.upload({
          buffer,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          adult: true, // Mark as adult content for safety
        });
        
        logger.debug('PostImages result:', {
          success: postimagesResult.success,
          hasUrl: !!postimagesResult.url,
          url: postimagesResult.url,
          thumbnailUrl: postimagesResult.thumbnailUrl,
          error: postimagesResult.error,
        });
        
        if (postimagesResult.success && postimagesResult.url) {
          imageUrl = postimagesResult.url;
          thumbnailUrl = postimagesResult.thumbnailUrl;
          provider = 'postimages';
          logger.info(`Media uploaded to PostImages successfully: ${req.file.originalname}`, {
            url: imageUrl,
            thumbnailUrl,
          });
        } else if (postimagesResult.success && !postimagesResult.url) {
          // This is the "upload succeeded but no url provided" case
          logger.error('CRITICAL: PostImages reported success but no URL provided', {
            result: postimagesResult,
            resultKeys: Object.keys(postimagesResult),
          });
          throw new Error('PostImages upload succeeded but no URL provided');
        } else {
          throw new Error(postimagesResult.error || 'PostImages upload failed');
        }
      } catch (postimagesError) {
        logger.error('PostImages failed, trying SimpleImageUpload:', postimagesError);
        
        // Try SimpleImageUpload services (FreeImage, ImgBB)
        try {
          const simpleResult = await SimpleImageUpload.upload({
            buffer,
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          });
          
          if (simpleResult.success && simpleResult.url) {
            imageUrl = simpleResult.url;
            thumbnailUrl = simpleResult.thumbnailUrl;
            provider = simpleResult.service || 'simple-upload';
            logger.info(`Media uploaded via ${provider}: ${req.file.originalname}`, {
              url: imageUrl,
              thumbnailUrl,
            });
          } else {
            throw new Error(simpleResult.error || 'Simple upload failed');
          }
        } catch (simpleError) {
          logger.error('SimpleImageUpload failed, trying DirectUpload:', simpleError);
          
          // Try DirectUpload (Imgur, Cloudinary)
          try {
            const directResult = await DirectUpload.upload(buffer, req.file.originalname);
            
            if (directResult.success && directResult.url) {
              imageUrl = directResult.url;
              thumbnailUrl = directResult.thumbnailUrl;
              provider = directResult.service || 'direct-upload';
              logger.info(`Media uploaded via ${provider}: ${req.file.originalname}`, {
                url: imageUrl,
                thumbnailUrl,
              });
            } else {
              throw new Error(directResult.error || 'Direct upload failed');
            }
          } catch (directError) {
            logger.error('DirectUpload failed, trying WorkingUpload:', directError);
            
            // Try WorkingUpload services (File.io, 0x0.st, Uguu, Litterbox)
            try {
              const workingResult = await WorkingUpload.upload(buffer, req.file.originalname);
              
              if (workingResult.success && workingResult.url) {
                imageUrl = workingResult.url;
                thumbnailUrl = workingResult.thumbnailUrl;
                provider = workingResult.service || 'working-upload';
                logger.info(`Media uploaded via ${provider}: ${req.file.originalname}`, {
                  url: imageUrl,
                  thumbnailUrl,
                });
              } else {
                throw new Error(workingResult.error || 'Working upload failed');
              }
            } catch (workingError) {
              logger.error('ALL upload services failed including WorkingUpload:', workingError);
              
              // Last resort: Convert to base64 data URL (NOT compliant for production!)
              logger.warn('WARNING: Using base64 fallback - this is NOT legally compliant for storage!');
              const base64 = buffer.toString('base64');
              const mimeType = req.file.mimetype || 'image/jpeg';
              imageUrl = `data:${mimeType};base64,${base64}`;
              thumbnailUrl = imageUrl;
              provider = 'base64-emergency';
              logger.info(`Media stored as base64 data URL: ${req.file.originalname} (${base64.length} chars)`);
            }
          }
        }
      }
      }
    }

    // Clean up temp file immediately
    await fs.unlink(req.file.path).catch(() => {});

    // Save to database for gallery persistence
    const [savedAsset] = await db.insert(userStorageAssets).values({
      userId: req.user.id,
      provider: provider,
      url: imageUrl!,
      deleteHash: null, // Could extract from Imgur result if available
      sourceFilename: req.file.originalname,
      fileSize: buffer.length,
      mimeType: req.file.mimetype,
      metadata: {
        thumbnailUrl: thumbnailUrl,
        uploadedVia: 'media-upload-endpoint'
      }
    }).returning();

    logger.info('Upload saved to database', {
      assetId: savedAsset.id,
      userId: req.user.id,
      provider: provider,
      url: imageUrl
    });

    // Return response in format compatible with existing frontend
    res.json({
      message: 'File uploaded successfully',
      asset: {
        id: savedAsset.id, // Use real database ID
        userId: req.user.id,
        filename: req.file.originalname,
        bytes: buffer.length,
        mime: req.file.mimetype,
        signedUrl: imageUrl,
        downloadUrl: imageUrl,
        thumbnailUrl: thumbnailUrl,
        provider: provider,
        createdAt: savedAsset.createdAt,
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

// POST /api/media/save-url - Save external URL to gallery
router.post('/save-url', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { url, provider } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Extract filename from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1] || 'external-image';

    // Save to database
    const [savedAsset] = await db.insert(userStorageAssets).values({
      userId: req.user.id,
      provider: provider || 'external',
      url: url,
      deleteHash: null,
      sourceFilename: filename,
      fileSize: null,
      mimeType: null,
      metadata: {
        uploadedVia: 'paste-url'
      }
    }).returning();

    logger.info('External URL saved to gallery', {
      assetId: savedAsset.id,
      userId: req.user.id,
      provider: provider || 'external',
      url: url
    });

    res.json({
      message: 'URL saved to gallery successfully',
      asset: {
        id: savedAsset.id,
        userId: req.user.id,
        filename: filename,
        signedUrl: url,
        downloadUrl: url,
        thumbnailUrl: url,
        provider: provider || 'external',
        createdAt: savedAsset.createdAt,
      }
    });
  } catch (error) {
    logger.error('Failed to save external URL:', error);
    res.status(500).json({ message: 'Failed to save URL to gallery' });
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