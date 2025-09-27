/**
 * Transforms generated copy to align with persona-specific voice packs, capturing each
 * transformation step for observability via the automation audit trail.
 */

import { AuditTrail, AutomationStep } from "./audit-trail";
import { VoicePack } from "./types";

const sentenceCase = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const titleCase = (input: string): string =>
  input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");

const applyCaseStyle = (text: string, caseStyle: VoicePack["caseStyle"]): string => {
  switch (caseStyle) {
    case "sentence":
      return sentenceCase(text);
    case "title":
      return titleCase(text);
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "original":
    default:
      return text;
  }
};

const stripDisallowedPhrases = (text: string, phrases: ReadonlyArray<string>): string =>
  phrases.reduce<string>((acc, phrase) => acc.replace(new RegExp(phrase, "gi"), ""), text);

/**
 * Applies a voice pack to the provided text by normalizing casing, removing disallowed
 * phrases, and appending optional prefixes or suffixes. All adjustments are recorded in the
 * provided audit trail for debugging and compliance review.
 */
export const applyVoicePack = (text: string, pack: VoicePack, trail: AuditTrail): string => {
  const sanitized = stripDisallowedPhrases(text, pack.disallowedPhrases).trim();
  const transformed = applyCaseStyle(sanitized, pack.caseStyle);
  const withAffordances = [pack.prefix, transformed, pack.suffix]
    .filter((segment): segment is string => Boolean(segment))
    .join(" ")
    .trim();

  trail.log(AutomationStep.VoicePackApplied, {
    voicePackId: pack.id,
    caseStyle: pack.caseStyle,
    disallowedCount: pack.disallowedPhrases.length,
    appliedPrefix: Boolean(pack.prefix),
    appliedSuffix: Boolean(pack.suffix),
  });

  return withAffordances;
};