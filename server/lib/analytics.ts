import { db } from "../db.js";
import { eventLogs } from "../../shared/schema.js";

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './logger-utils.js';
export async function trackEvent(userId: number | null, type: string, meta: Record<string, unknown> = {}) {
  try {
    await db.insert(eventLogs).values({
      userId: userId ?? null,
      type,
      meta
    });
  } catch (e) {
    // swallow analytics errors
    logger.error(...formatLogArgs("trackEvent failed", e));
  }
}