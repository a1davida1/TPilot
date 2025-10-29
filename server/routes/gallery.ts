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

router.get('/stats', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { db } = await import('../db.js');
    const { mediaAssets, catboxUploads } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');

    // Get media assets count and stats
    const [mediaStats] = await db
      .select({
        totalImages: sql<number>`count(*)::int`,
        protectedImages: sql<number>`sum(CASE WHEN protected = true THEN 1 ELSE 0 END)::int`,
        totalViews: sql<number>`coalesce(sum(view_count), 0)::int`,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId));

    // Get Catbox uploads count
    const [catboxStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(catboxUploads)
      .where(eq(catboxUploads.userId, userId));

    const totalImages = (mediaStats?.totalImages || 0) + (catboxStats?.count || 0);
    const protectedImages = mediaStats?.protectedImages || 0;
    const totalViews = mediaStats?.totalViews || 0;

    // Calculate storage (rough estimate: 2MB avg per image)
    const storageBytes = totalImages * 2 * 1024 * 1024;
    const storageUsed = storageBytes > 1024 * 1024 * 1024
      ? `${(storageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
      : `${(storageBytes / (1024 * 1024)).toFixed(0)} MB`;

    return res.status(200).json({
      totalImages,
      protectedImages,
      totalViews,
      storageUsed,
    });
  } catch (error) {
    logger.error('Failed to load gallery stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    });
    return res.status(500).json({ error: 'Failed to load gallery stats' });
  }
});

export { router as galleryRoutes };
