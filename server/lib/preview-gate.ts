import { db } from "../db.js";
import { postPreviews } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { logger } from '../bootstrap/logger.js';

export interface PreviewStats {
  okCount14d: number;
  totalPreviews14d: number;
  canQueue: boolean;
  required: number;
}

export async function getPreviewStats(userId: number): Promise<PreviewStats> {
  try {
    // Calculate 14 days ago
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Count "ok" previews in last 14 days
    const okPreviews = await db
      .select()
      .from(postPreviews)
      .where(
        and(
          eq(postPreviews.userId, userId),
          eq(postPreviews.policyState, "ok"),
          gte(postPreviews.createdAt, fourteenDaysAgo)
        )
      );

    // Count total previews in last 14 days (for additional context)
    const totalPreviews = await db
      .select()
      .from(postPreviews)
      .where(
        and(
          eq(postPreviews.userId, userId),
          gte(postPreviews.createdAt, fourteenDaysAgo)
        )
      );

    const okCount14d = okPreviews.length;
    const totalPreviews14d = totalPreviews.length;
    const required = 3;
    const canQueue = okCount14d >= required;

    return {
      okCount14d,
      totalPreviews14d,
      canQueue,
      required
    };

  } catch (error) {
    logger.error("Preview stats error:", error);
    // Fail safe - if stats fail, don't block user
    return {
      okCount14d: 0,
      totalPreviews14d: 0,
      canQueue: false,
      required: 3
    };
  }
}

export async function canQueuePosts(userId: number): Promise<boolean> {
  const stats = await getPreviewStats(userId);
  return stats.canQueue;
}

export interface GateCheckResult {
  canQueue: boolean;
  reason?: string;
  required?: number;
  current?: number;
}

export async function checkPreviewGate(userId: number): Promise<GateCheckResult> {
  const stats = await getPreviewStats(userId);
  
  if (stats.canQueue) {
    return { canQueue: true };
  }

  return {
    canQueue: false,
    reason: "PREVIEW_GATE_NOT_MET",
    required: stats.required,
    current: stats.okCount14d
  };
}