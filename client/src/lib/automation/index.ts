/**
 * Aggregates the automation toolkit exports so feature teams can import cohesive helpers for
 * voice, humanization, scheduling, engagement, and observability.
 */

export { AutomationStep, createAuditTrail } from "./audit-trail";
export type { AuditTrail, AuditTrailEntry } from "./audit-trail";
export { addHumanQuirks } from "./humanization";
export { applyVoicePack } from "./voice-packs";
export { PersonaManager } from "./persona-manager";
export { schedulePost } from "./scheduling";
export { generateReply } from "./engagement";
export type {
  Daypart,
  DaypartPreference,
  OffsetRange,
  SchedulingWindow,
  VoicePack,
  HumanQuirkOptions,
  PersonaScheduling,
  Persona,
  Post,
  ScheduledPost,
  PostMetrics,
} from "./types";