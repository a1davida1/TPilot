/**
 * Offers a centralized persona cache that feeds persona-aware automation utilities with
 * consistent metadata while recording every lookup, metric update, and scheduling decision.
 */

import { AuditTrail, AutomationStep } from "./audit-trail";
import { Persona, PostMetrics, SchedulingWindow } from "./types";

export class PersonaManager {
  private readonly cache = new Map<string, Persona>();
  private readonly metricHistory = new Map<string, PostMetrics[]>();

  constructor(initialPersonas: ReadonlyArray<Persona> = []) {
    initialPersonas.forEach((persona) => this.cache.set(persona.id, persona));
  }

  getPersona(id: string, trail: AuditTrail): Persona {
    const persona = this.cache.get(id);

    if (persona) {
      trail.log(AutomationStep.PersonaLoaded, { personaId: id, fromCache: true });
      return persona;
    }

    trail.log(AutomationStep.PersonaLoaded, { personaId: id, fromCache: false, hit: false });
    throw new Error(`Persona with id "${id}" is not registered`);
  }

  recordPostMetrics(personaId: string, metrics: PostMetrics, trail: AuditTrail): void {
    const history = this.metricHistory.get(personaId) ?? [];
    history.push(metrics);
    this.metricHistory.set(personaId, history);
    trail.log(AutomationStep.PostMetricsRecorded, {
      personaId,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      likes: metrics.likes,
      shares: metrics.shares,
      comments: metrics.comments,
      totalRecords: history.length,
    });
  }

  getSchedulingWindow(personaId: string, trail: AuditTrail): SchedulingWindow {
    const persona = this.getPersona(personaId, trail);
    const candidateWindows: SchedulingWindow[] = [
      persona.scheduling.defaultWindow,
      ...(persona.scheduling.additionalWindows ?? []),
    ];
    const selected = candidateWindows[0];

    trail.log(AutomationStep.SchedulingWindowSelected, {
      personaId,
      daypart: selected.daypart,
      startHour: selected.startHour,
      endHour: selected.endHour,
    });

    return selected;
  }
}