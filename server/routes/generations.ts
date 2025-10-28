import { Router, type Response } from "express";
import { eq, gte, and, count } from "drizzle-orm";
import { db } from "../db.js";
import { logger } from "../bootstrap/logger.js";
import { contentGenerations, users } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";

const generationsRouter = Router();

/**
 * GET /api/generations/stats
 * Get user's caption generation usage stats (used, limit, remaining)
 */
generationsRouter.get("/stats", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user tier to determine limit
    const [user] = await db
      .select({ tier: users.tier, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine tier limits (per hour as per tiered-rate-limit.ts)
    const tierLimits: Record<string, number> = {
      free: 5,
      starter: 25,
      pro: 200,
      premium: 500,
      admin: 10000
    };

    const tier = user.isAdmin ? 'admin' : (user.tier || 'free');
    const limit = tierLimits[tier] || tierLimits.free;

    // Count generations in the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const [result] = await db
      .select({ count: count() })
      .from(contentGenerations)
      .where(
        and(
          eq(contentGenerations.userId, userId),
          gte(contentGenerations.createdAt, oneHourAgo)
        )
      );

    const used = Number(result?.count || 0);
    const remaining = Math.max(0, limit - used);

    res.json({
      used,
      limit,
      remaining,
      tier,
      window: '1 hour'
    });
  } catch (error) {
    logger.error('Failed to fetch generation stats', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch generation stats' });
  }
});

export { generationsRouter };
