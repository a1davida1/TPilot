/**
 * Subreddit linting endpoint
 * Validates submissions against cached subreddit rules before posting
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { lintSubmission, getSubredditRule } from '../moderation/rules';
import { z } from 'zod';
import { logger } from '../bootstrap/logger';

const router = Router();

const lintSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  nsfw: z.boolean(),
  flair: z.string().optional()
});

/**
 * POST /api/subreddit-lint
 * Validate a submission against subreddit rules
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { subreddit, title, nsfw, flair } = lintSchema.parse(req.body ?? {});

    const result = lintSubmission({ subreddit, title, nsfw, flair });

    return res.status(200).json({
      ok: result.ok,
      warnings: result.warnings,
      rule: result.rule ? {
        subreddit: result.rule.subreddit,
        nsfwRequired: result.rule.nsfwRequired,
        requiresFlair: result.rule.requiresFlair,
        allowedFlairs: result.rule.allowedFlairs,
        notes: result.rule.notes,
        updatedAt: result.rule.updatedAt
      } : null
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Linting failed';
    logger.error('Subreddit linting error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * GET /api/subreddit-lint/:subreddit
 * Get cached rules for a specific subreddit
 */
router.get('/:subreddit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;
    const rule = getSubredditRule(subreddit);

    if (!rule) {
      return res.status(404).json({ error: 'No cached rules for this subreddit' });
    }

    return res.status(200).json({
      subreddit: rule.subreddit,
      nsfwRequired: rule.nsfwRequired,
      bannedWords: rule.bannedWords,
      titleMin: rule.titleMin,
      titleMax: rule.titleMax,
      requiresFlair: rule.requiresFlair,
      allowedFlairs: rule.allowedFlairs,
      notes: rule.notes,
      updatedAt: rule.updatedAt
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get subreddit rules';
    logger.error('Get subreddit rules error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as subredditLintRouter };
