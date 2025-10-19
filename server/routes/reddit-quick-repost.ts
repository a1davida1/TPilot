import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { RedditManager } from '../lib/reddit.js';
import { MediaManager } from '../lib/media.js';
import { applyImageShieldProtection } from './upload.js';
import { CatboxService } from '../lib/catbox-service.js';
import { recordPostOutcome } from '../compliance/ruleViolationTracker.js';
import { logger } from '../bootstrap/logger.js';

const router = Router();

const IMAGE_MIME_PATTERN = /^image\//i;

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

  const { assetId, subreddit, title, nsfw, spoiler } = parsed.data;

  // Prevent concurrent reposts of same asset
  if (repostingAssets.has(assetId)) {
    return res.status(409).json({ error: 'Repost already in progress for this asset.' });
  }

  const asset = await MediaManager.getAsset(assetId, userId);
  if (!asset) {
    return res.status(404).json({ error: 'Media asset not found' });
  }

  if (!IMAGE_MIME_PATTERN.test(asset.mime)) {
    return res.status(400).json({ error: 'Only image assets can be reposted.' });
  }

  const reddit = await RedditManager.forUser(userId);
  if (!reddit) {
    return res.status(404).json({
      error: 'No active Reddit account found. Please connect your Reddit account first.'
    });
  }

  repostingAssets.add(assetId);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tp-repost-'));
  const sourcePath = path.join(tempDir, 'source');
  const protectedPath = path.join(tempDir, 'protected.jpg');

  try {
    const assetBuffer = await MediaManager.getAssetBuffer(asset);
    await fs.writeFile(sourcePath, assetBuffer);

    await applyImageShieldProtection(sourcePath, protectedPath, 'standard', true, String(userId));
    const protectedBuffer = await fs.readFile(protectedPath);

    const userhash = await CatboxService.getUserHash(userId);
    const catboxResult = await CatboxService.upload({
      reqtype: 'fileupload',
      file: protectedBuffer,
      filename: `${assetId}-repost.jpg`,
      mimeType: 'image/jpeg',
      userhash: userhash ?? undefined,
    });

    if (!catboxResult.success || !catboxResult.url) {
      const statusCode = catboxResult.status && catboxResult.status >= 400 ? catboxResult.status : 502;
      return res.status(statusCode).json({ error: catboxResult.error || 'Failed to publish protected image' });
    }

    const submission = await reddit.submitImagePost({
      subreddit,
      title,
      imageUrl: catboxResult.url,
      nsfw: nsfw ?? true,
      spoiler: spoiler ?? false,
    });

    if (!submission.success || !submission.postId) {
      return res.status(400).json({
        error: submission.error || 'Failed to repost image to Reddit',
        warnings: submission.decision?.warnings || [],
        reasons: submission.decision?.reasons || [],
      });
    }

    await MediaManager.recordUsage(assetId, 'reddit-repost', new Date().toISOString());
    await recordPostOutcome(userId, subreddit, { status: 'posted' });

    return res.status(200).json({
      success: true,
      postId: submission.postId,
      url: submission.url,
      warnings: submission.decision?.warnings || [],
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
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
