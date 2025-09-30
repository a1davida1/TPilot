import type { RequestHandler } from "express";
import express from "express";
import { db } from "../db.js";
import { users, subscriptions } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const ranks = ["free", "starter", "pro"] as const;
type Tier = typeof ranks[number];

function rankOf(tier: string | null | undefined): number {
  const i = ranks.indexOf((tier ?? "free") as Tier);
  return i >= 0 ? i : 0;
}

export function requireTier(minTier: Tier): RequestHandler {
  return async (req: express.Request & { user?: unknown }, res: express.Response, next: express.NextFunction) => {
    try {
      const uid = req.user?.id as number | undefined;
      if (!uid) return res.status(401).json({ error: "unauthorized" });

      // 1) prefer users.tier if exists
      const u = (await db.select({ tier: users.tier }).from(users).where(eq(users.id, uid)).limit(1))[0];
      let tier = u?.tier ?? "free";

      // 2) if users.tier absent/unknown, check subscriptions
      if (!u?.tier || u.tier === "free" || u.tier === "starter") {
        const sub = (await db.select({
          status: subscriptions.status, plan: subscriptions.plan
        }).from(subscriptions).where(eq(subscriptions.userId, uid)).limit(1))[0];
        if (sub?.status === "active" && sub.plan) tier = sub.plan as Tier; // 'starter' or 'pro'
      }

      if (rankOf(tier) < rankOf(minTier)) {
        return res.status(403).json({ error: "Insufficient tier" });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}