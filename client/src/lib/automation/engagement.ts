/**
 * Stubs out engagement features by providing a deterministic reply generator while paving the
 * way for future LLM integrations and keeping a clear audit trail of each response.
 */

import { AuditTrail, AutomationStep } from "./audit-trail";
import { Persona } from "./types";

/**
 * Generates a short acknowledgement reply using persona metadata. The current
 * implementation keeps responses lightweight so product teams can wire in real
 * conversational models later without rewriting calling code.
 */
export const generateReply = (context: string, persona: Persona, trail: AuditTrail): string => {
  const reply = `${persona.displayName} appreciates the update!`;

  trail.log(AutomationStep.ReplyGenerated, {
    personaId: persona.id,
    contextPreview: context.slice(0, 80),
    replyLength: reply.length,
  });

  return reply;
};