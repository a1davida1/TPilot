/**
 * Enhanced Subreddit Linting Endpoint
 * Validates submissions against real database rules with user-specific checks
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { logger } from '../bootstrap/logger';
import { db } from '../db.js';
import { redditCommunities, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const lintSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  caption: z.string().optional(), // NEW: Validate caption text
  nsfw: z.boolean(),
  flair: z.string().optional()
});

interface ValidationResult {
  ok: boolean;
  warnings: string[];
  blockers: string[];
  rule: {
    subreddit: string;
    nsfwRequired: boolean;
    minKarma: number | null;
    minAccountAgeDays: number | null;
    verificationRequired: boolean;
    promotionalLinks: string | null;
    linkRestrictions: string[];
    bannedContent: string[];
  } | null;
}

/**
 * Check if text contains any banned links/content
 */
function checkBannedContent(text: string, bannedContent: string[]): string[] {
  const lowerText = text.toLowerCase();
  return bannedContent.filter(banned => lowerText.includes(banned.toLowerCase()));
}

/**
 * Calculate account age in days
 */
function calculateAccountAgeDays(createdAt: Date | null): number | null {
  if (!createdAt) return null;
  const now = new Date();
  const diff = now.getTime() - createdAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * POST /api/subreddit-lint
 * Enhanced validation with database rules + user-specific checks
 */
router.post('/', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { subreddit, title, caption, nsfw, flair } = lintSchema.parse(req.body ?? {});
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const warnings: string[] = [];
    const blockers: string[] = [];

    // Fetch subreddit rules from database
    const [communityData] = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.id, subreddit.toLowerCase()))
      .limit(1);

    if (!communityData) {
      // No rules in database - allow but warn
      return res.status(200).json({
        ok: true,
        warnings: [`No rules found for r/${subreddit}. Posting at your own risk.`],
        blockers: [],
        rule: null,
      } satisfies ValidationResult);
    }

    // Fetch user's Reddit data for karma/age checks
    const [userData] = await db
      .select({
        redditKarma: users.redditKarma,
        redditAccountCreated: users.redditAccountCreated,
        redditIsVerified: users.redditIsVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const rules = communityData.rules;

    // 1. Check NSFW requirement
    if (communityData.over18 && !nsfw) {
      warnings.push('⚠️ NSFW flag required for this subreddit');
    }

    // 2. Check minimum karma requirement
    if (rules?.eligibility?.minKarma !== null && rules?.eligibility?.minKarma !== undefined) {
      const requiredKarma = rules.eligibility.minKarma;
      const userKarma = userData?.redditKarma ?? 0;

      if (userKarma < requiredKarma) {
        blockers.push(
          `❌ Minimum ${requiredKarma} karma required (you have ${userKarma})`
        );
      }
    }

    // 3. Check minimum account age
    if (rules?.eligibility?.minAccountAgeDays !== null && rules?.eligibility?.minAccountAgeDays !== undefined) {
      const requiredDays = rules.eligibility.minAccountAgeDays;
      const accountAgeDays = calculateAccountAgeDays(userData?.redditAccountCreated ?? null);

      if (accountAgeDays === null) {
        warnings.push('⚠️ Could not verify account age - connect your Reddit account');
      } else if (accountAgeDays < requiredDays) {
        blockers.push(
          `❌ Account must be ${requiredDays}+ days old (yours is ${accountAgeDays} days)`
        );
      }
    }

    // 4. Check verification requirement
    if (rules?.eligibility?.verificationRequired) {
      if (!userData?.redditIsVerified) {
        warnings.push(
          `⚠️ Verification may be required in r/${subreddit}. Check subreddit rules.`
        );
      }
    }

    // 5. Check title length (if rules exist)
    // Note: Using legacy approach since title rules aren't in new structure yet
    if (title.length > 300) {
      warnings.push('⚠️ Title exceeds recommended 300 characters');
    }

    // 6. Check promotional links in caption
    const fullText = `${title} ${caption ?? ''}`;

    if (rules?.content?.promotionalLinks === 'no') {
      // Check for common promotional patterns
      const promoPatterns = [
        /onlyfans\.com/i,
        /of\.com/i,
        /fansly\.com/i,
        /link in bio/i,
        /check.*bio/i,
        /my.*link/i,
      ];

      const foundPromo = promoPatterns.some(pattern => pattern.test(fullText));
      if (foundPromo) {
        warnings.push(`⚠️ r/${subreddit} doesn't allow promotional links`);
      }
    }

    // 7. Check banned content/links
    if (rules?.content?.linkRestrictions && rules.content.linkRestrictions.length > 0) {
      const foundBanned = checkBannedContent(fullText, rules.content.linkRestrictions);
      if (foundBanned.length > 0) {
        warnings.push(`⚠️ Contains restricted content: ${foundBanned.join(', ')}`);
      }
    }

    if (rules?.content?.bannedContent && rules.content.bannedContent.length > 0) {
      const foundBanned = checkBannedContent(fullText, rules.content.bannedContent);
      if (foundBanned.length > 0) {
        warnings.push(`⚠️ Contains banned terms: ${foundBanned.join(', ')}`);
      }
    }

    // 8. Check for payment processors (common ban)
    const paymentProcessors = ['cashapp', 'venmo', 'paypal', 'zelle'];
    const foundPayment = checkBannedContent(fullText, paymentProcessors);
    if (foundPayment.length > 0) {
      warnings.push(`⚠️ Payment processors not allowed: ${foundPayment.join(', ')}`);
    }

    const isValid = blockers.length === 0;

    return res.status(200).json({
      ok: isValid,
      warnings,
      blockers,
      rule: {
        subreddit: communityData.name,
        nsfwRequired: communityData.over18,
        minKarma: rules?.eligibility?.minKarma ?? null,
        minAccountAgeDays: rules?.eligibility?.minAccountAgeDays ?? null,
        verificationRequired: rules?.eligibility?.verificationRequired ?? false,
        promotionalLinks: rules?.content?.promotionalLinks ?? null,
        linkRestrictions: rules?.content?.linkRestrictions ?? [],
        bannedContent: rules?.content?.bannedContent ?? [],
      },
    } satisfies ValidationResult);

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
router.get('/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;

    // Fetch subreddit rules from database
    const [communityData] = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.id, subreddit.toLowerCase()))
      .limit(1);

    if (!communityData) {
      return res.status(404).json({ error: 'No cached rules for this subreddit' });
    }

    const rules = communityData.rules;

    return res.status(200).json({
      subreddit: communityData.name,
      nsfwRequired: communityData.over18,
      minKarma: rules?.eligibility?.minKarma ?? null,
      minAccountAgeDays: rules?.eligibility?.minAccountAgeDays ?? null,
      verificationRequired: rules?.eligibility?.verificationRequired ?? false,
      promotionalLinks: rules?.content?.promotionalLinks ?? null,
      linkRestrictions: rules?.content?.linkRestrictions ?? [],
      bannedContent: rules?.content?.bannedContent ?? [],
      updatedAt: new Date().toISOString() // Community data doesn't have updatedAt field
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get subreddit rules';
    logger.error('Get subreddit rules error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as subredditLintRouter };
