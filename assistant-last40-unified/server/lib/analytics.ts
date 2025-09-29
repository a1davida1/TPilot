import { db } from "../db.js";
import { eventLogs } from "../../shared/schema.js";

export async function trackEvent(userId: number | null, type: string, meta: Record<string, unknown> = {}) {
  try {
    await db.insert(eventLogs).values({
      userId: userId ?? null,
      type,
      meta
    });
  } catch (e) {
    // swallow analytics errors
    console.error("trackEvent failed", e);
  }
}