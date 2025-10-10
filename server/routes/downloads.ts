import { Router, type Request, type Response, type NextFunction } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import mimeTypes from 'mime-types';
import { MediaManager } from '../lib/media.js';

const lookupMimeType = mimeTypes.lookup;

const NOT_FOUND_RESPONSE = { message: 'Asset not found' } as const;

const sendNotFound = (res: Response): void => {
  res.status(404).json(NOT_FOUND_RESPONSE);
};

export const createLocalDownloadRouter = (): Router => {
  const router = Router();

  router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.params as { token?: string }).token;

    if (!token) {
      sendNotFound(res);
      return;
    }

    try {
      const payload = await MediaManager.validateDownloadToken(token);
      if (!payload) {
        sendNotFound(res);
        return;
      }

      const assetPath = MediaManager.getLocalAssetPath(payload.key);

      try {
        const fileStats = await stat(assetPath);
        if (!fileStats.isFile()) {
          sendNotFound(res);
          return;
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          sendNotFound(res);
          return;
        }
        throw error;
      }

      const mimeType = lookupMimeType(assetPath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);

      const stream = createReadStream(assetPath);

      stream.on('error', (streamError: NodeJS.ErrnoException) => {
        if (streamError.code === 'ENOENT') {
          if (!res.headersSent) {
            sendNotFound(res);
          }
          return;
        }

        next(streamError);
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  });

  return router;
};