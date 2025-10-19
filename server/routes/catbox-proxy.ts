import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { logger } from '../bootstrap/logger.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { CatboxService } from '../lib/catbox-service.js';
import { CatboxAnalyticsService } from '../services/catbox-analytics-service.js';

const router = Router();

// Configure multer for memory storage (200MB limit for Catbox)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB max for Catbox
  }
});

/**
 * POST /api/upload/catbox-proxy
 * Proxy endpoint for Catbox uploads to handle CORS issues
 * This is a fallback if direct browser uploads fail
 */
router.post(
  '/catbox-proxy',
  authenticateToken(),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const fileBuffer = req.file.buffer;
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }

      const originalName = req.file.originalname || 'upload.bin';
      const sanitizedFilename = path.basename(originalName) || 'upload.bin';
      const mimeType = req.file.mimetype?.trim() || 'application/octet-stream';
      let userhash: string | undefined;
      let userhashSource: 'request' | 'database' | 'none' = 'none';

      const bodyUserhash = typeof req.body?.userhash === 'string' ? req.body.userhash.trim() : '';
      if (bodyUserhash) {
        if (bodyUserhash.length > 255) {
          logger.warn('Catbox proxy received invalid userhash length', {
            userId: req.user?.id ?? null
          });

          return res.status(400).json({ error: 'Invalid Catbox user hash' });
        }

        userhash = bodyUserhash;
        userhashSource = 'request';
      } else if (req.user?.id) {
        const storedHash = await CatboxService.getUserHash(req.user.id);
        if (storedHash) {
          userhash = storedHash;
          userhashSource = 'database';
        }
      }

      const uploadStartedAt = Date.now();
      const uploadResult = await CatboxService.upload({
        reqtype: 'fileupload',
        file: fileBuffer,
        filename: sanitizedFilename,
        mimeType,
        userhash
      });
      const uploadDuration = Date.now() - uploadStartedAt;

      const analyticsBase = req.user?.id
        ? {
            userId: req.user.id,
            filename: sanitizedFilename,
            fileSize: typeof req.file.size === 'number' ? req.file.size : undefined,
            uploadDuration,
            provider: 'catbox',
          }
        : null;

      if (!uploadResult.success || !uploadResult.url) {
        const statusCode =
          uploadResult.status && uploadResult.status >= 400 ? uploadResult.status : 502;

        const detailedError =
          uploadResult.error ? uploadResult.error.trim().slice(0, 500) : undefined;

        const responseMessage =
          statusCode === 412
            ? 'Catbox rejected the upload. Please verify your Catbox user hash in Settings.'
            : detailedError || 'Catbox upload failed';

        const responseBody: { error: string; details?: string } = { error: responseMessage };

        if (detailedError && responseMessage !== detailedError) {
          responseBody.details = detailedError;
        }

        if (analyticsBase) {
          await CatboxAnalyticsService.recordUpload({
            ...analyticsBase,
            url: uploadResult.url,
            success: false,
            errorMessage: detailedError ?? uploadResult.error ?? undefined,
          });
        }

        logger.error('Catbox proxy upload failed', {
          statusCode,
          error: detailedError,
          hasUserhash: Boolean(userhash),
          userhashSource,
          requiresUserhash: statusCode === 412,
          userId: req.user?.id ?? null,
          filename: sanitizedFilename
        });

        return res.status(statusCode).json(responseBody);
      }

      logger.info('Catbox proxy upload successful', {
        url: uploadResult.url,
        originalName: sanitizedFilename,
        size: req.file.size,
        authenticated: Boolean(userhash),
        userhashSource,
        userId: req.user?.id ?? null
      });

      if (analyticsBase && uploadResult.url) {
        await CatboxAnalyticsService.recordUpload({
          ...analyticsBase,
          url: uploadResult.url,
          success: true,
        });
      }

      return res.json({
        success: true,
        imageUrl: uploadResult.url,
        provider: 'catbox'
      });
    } catch (error) {
      logger.error('Catbox proxy upload error', {
        error,
        userId: req.user?.id ?? null
      });

      return res.status(500).json({
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;
