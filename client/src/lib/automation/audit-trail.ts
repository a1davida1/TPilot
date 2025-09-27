/**
 * Provides a lightweight audit trail for automation features so that upstream orchestrators
 * can trace every decision made while generating, scheduling, and moderating content.
 */

export enum AutomationStep {
  HumanQuirkApplied = "human_quirk_applied",
  VoicePackApplied = "voice_pack_applied",
  PersonaLoaded = "persona_loaded",
  PostMetricsRecorded = "post_metrics_recorded",
  SchedulingWindowSelected = "scheduling_window_selected",
  PostScheduled = "post_scheduled",
  ReplyGenerated = "reply_generated",
  ComplianceEvaluated = "compliance_evaluated",
}

export interface AuditTrailEntry {
  readonly timestamp: Date;
  readonly step: AutomationStep;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AuditTrail {
  readonly entries: ReadonlyArray<AuditTrailEntry>;
  log(step: AutomationStep, payload: Record<string, unknown>): void;
}

export const createAuditTrail = (): AuditTrail => {
  const entries: AuditTrailEntry[] = [];

  return {
    get entries() {
      return entries.slice();
    },
    log(step, payload) {
      const snapshot: AuditTrailEntry = {
        timestamp: new Date(),
        step,
        payload: { ...payload },
      };
      entries.push(snapshot);
    },
  };
};