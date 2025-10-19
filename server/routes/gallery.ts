import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { getGalleryPage } from '../services/gallery-service.js';
import { logger } from '../bootstrap/logger.js';

const router = Router();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

router.get('/', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const { page, pageSize } = parsed.data;
    const pageData = await getGalleryPage(userId, page, pageSize);

    return res.status(200).json(pageData);
  } catch (error) {
    logger.error('Failed to load gallery page', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load gallery' });
  }
});

export { router as galleryRoutes };
