import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { RedditNativeUploadService } from '../services/reddit-native-upload.js';
import { logger } from '../bootstrap/logger.js';

const router = Router();

const quickRepostSchema = z.object({
  assetId: z.number().int().positive(),
  subreddit: z.string().min(1),
  title: z.string().min(1).max(300),
  nsfw: z.boolean().optional().default(true),
  spoiler: z.boolean().optional(),
  flairText: z.string().max(100).optional(),
});

// Track concurrent reposts per asset to prevent duplicates
const repostingAssets = new Set<number>();

router.post('/', authenticateToken(true), async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const parsed = quickRepostSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request payload' });
  }

  const { assetId, subreddit, title, nsfw, spoiler, flairText } = parsed.data;

  // Prevent concurrent reposts of same asset
  if (repostingAssets.has(assetId)) {
    return res.status(409).json({ error: 'Repost already in progress for this asset.' });
  }

  repostingAssets.add(assetId);

  try {
    // Use Reddit native upload - no external dependencies!
    const result = await RedditNativeUploadService.uploadAndPost({
      userId,
      assetId,
      subreddit,
      title,
      nsfw: nsfw ?? true,
      spoiler: spoiler ?? false,
      flairText,
      applyWatermark: true, // Apply ImageShield protection
      allowCatboxFallback: true,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to repost image to Reddit',
        warnings: result.warnings || [],
      });
    }

    logger.info('Quick repost successful via Reddit native upload', {
      userId,
      assetId,
      subreddit,
      postId: result.postId,
      redditImageUrl: result.redditImageUrl,
    });

    return res.status(200).json({
      success: true,
      postId: result.postId,
      url: result.url,
      redditImageUrl: result.redditImageUrl, // i.redd.it URL
      warnings: result.warnings || [],
      repostedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Quick repost failed', {
      userId,
      assetId,
      subreddit,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to repost image',
    });
  } finally {
    repostingAssets.delete(assetId);
  }
});

export default router;
