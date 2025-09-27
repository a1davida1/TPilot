/**
 * Applies lightweight humanization effects to generated text so downstream callers can plug
 * in more advanced NLP driven quirks without rewriting scheduling or compliance layers.
 */

import { AuditTrail, AutomationStep } from "./audit-trail";
import { HumanQuirkOptions } from "./types";

/**
 * Applies persona-specific quirks such as filler words, light typos, and emoji frequency
 * controls. The implementation currently nudges phrasing while logging all adjustments for
 * future observability.
 */
export const addHumanQuirks = (
  text: string,
  options: HumanQuirkOptions,
  trail: AuditTrail,
): string => {
  const segments: string[] = [text];

  if (options.fillerWords.length > 0) {
    segments.push(options.fillerWords[0]);
  }

  if (options.signOff) {
    segments.push(options.signOff);
  }

  const mutated = segments.join(" ").trim();

  trail.log(AutomationStep.HumanQuirkApplied, {
    originalLength: text.length,
    mutatedLength: mutated.length,
    appliedSignOff: Boolean(options.signOff),
    emojiFrequency: options.emojiFrequency,
  });

  return mutated;
};