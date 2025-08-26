import type { RequestHandler } from "express";
import { db } from "../db.js";
import { users, subscriptions } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const ranks = ["starter","pro","premium","enterprise"] as const;
type Tier = typeof ranks[number];

function rankOf(tier: string | null | undefined): number {
  const i = ranks.indexOf((tier ?? "starter") as Tier);
  return i >= 0 ? i : 0;
}

export function requireTier(minTier: Tier): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const uid = req.user?.id as number | undefined;
      if (!uid) return res.status(401).json({ error: "unauthorized" });

      // 1) prefer users.tier if exists
      const u = (await db.select({ tier: users.tier }).from(users).where(eq(users.id, uid)).limit(1))[0];
      let tier = u?.tier ?? "starter";

      // 2) if users.tier absent/unknown, check subscriptions
      if (!u?.tier || u.tier === "starter") {
        const sub = (await db.select({
          status: subscriptions.status, plan: subscriptions.plan
        }).from(subscriptions).where(eq(subscriptions.userId, uid)).limit(1))[0];
        if (sub?.status === "active" && sub.plan) tier = sub.plan; // 'pro' or 'premium'
      }

      if (rankOf(tier) < rankOf(minTier)) {
        return res.status(402).json({ error: "upgrade_required", required: minTier, current: tier });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}