import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../bootstrap/logger.js";
import { users, contentGenerations, subscriptions } from "@shared/schema";

interface LandingMetrics {
  creators: number;
  posts: number;
  engagement: number;
  activeSubscriptions: number;
  generatedAt: string;
}

const analyticsRouter = Router();

function sanitizeCount(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);

  if (Number.isFinite(numericValue) === false || numericValue < 0) {
    return 0;
  }

  if (numericValue > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.floor(numericValue);
}

async function loadLandingMetrics(): Promise<LandingMetrics> {
  const [userCountResult, generationCountResult, activeSubscriptionsResult] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isDeleted, false)),
    db.select({ value: sql<number>`count(*)` }).from(contentGenerations),
    db
      .select({ value: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
  ]);

  const creators = sanitizeCount(userCountResult[0]?.value);
  const posts = sanitizeCount(generationCountResult[0]?.value);
  const activeSubscriptions = sanitizeCount(activeSubscriptionsResult[0]?.value);

  const engagement = creators === 0
    ? 0
    : Math.min(100, Math.round((activeSubscriptions / creators) * 100));

  return {
    creators,
    posts,
    engagement,
    activeSubscriptions,
    generatedAt: new Date().toISOString(),
  };
}

async function handleLandingMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await loadLandingMetrics();
    res.json(metrics);
  } catch (error: unknown) {
    logger.error("Failed to load landing metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Unable to fetch analytics summary" });
  }
}

analyticsRouter.get("/landing/summary", handleLandingMetrics);
analyticsRouter.get("/metrics", handleLandingMetrics);

export { analyticsRouter, loadLandingMetrics };