import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { MediaManager } from '../lib/media.js';
import { storage } from '../storage.js';
import { safeLog } from '../lib/logger-utils.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  }
});

// Error handler for Multer errors
export function uploadErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err.message.includes('Unsupported file type')) {
    return res.status(400).json({ error: 'Unsupported file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
  }
  
  next(err);
}

router.post('/api/uploads', authenticateToken(true), upload.single('file'), async (req: AuthRequest, res) => {
  let tempBuffer: Buffer | null = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    tempBuffer = req.file.buffer;
    const { originalname, mimetype, size } = req.file;

    // Upload through MediaManager
    const mediaAsset = await MediaManager.uploadFile(tempBuffer, {
      userId: req.user.id,
      filename: originalname,
      visibility: 'private',
      applyWatermark: false
    });

    // Persist metadata to database via storage
    const userImage = await storage.createUserImage({
      userId: req.user.id,
      filename: originalname,
      originalName: originalname,
      url: mediaAsset.signedUrl ?? '',
      mimeType: mimetype,
      size: size,
      isProtected: false,
      protectionLevel: 'none',
      tags: null,
      metadata: { 
        mediaAssetId: mediaAsset.id,
        key: mediaAsset.key 
      }
    });

    safeLog('info', 'File uploaded successfully', {
      userId: req.user.id,
      filename: originalname,
      size: size
    });

    return res.status(201).json({
      id: userImage.id,
      filename: userImage.filename,
      url: mediaAsset.signedUrl,
      downloadUrl: mediaAsset.downloadUrl,
      mimeType: userImage.mimeType,
      size: userImage.size,
      createdAt: userImage.createdAt
    });
  } catch (error) {
    // Clean up temp buffer
    tempBuffer = null;
    
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    safeLog('error', 'Upload error', { error: errorMessage });

    if (errorMessage.includes('quota exceeded') || errorMessage.includes('Storage quota')) {
      return res.status(413).json({ error: errorMessage });
    }

    if (errorMessage.includes('Unsupported file type')) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    return res.status(500).json({ error: errorMessage });
  }
});

export default router;
