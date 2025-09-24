
import type { CommunityVoicePack } from './community-voice-packs.js';

export interface AuthenticityScoreDetails {
  voiceMarkerDensity: number;
  firstPersonRatio: number;
  sentenceVariance: number;
  humorReferenceCount: number;
  callbacksUsed: number;
}

export interface AuthenticityScore {
  score: number;
  details: AuthenticityScoreDetails;
  warnings: string[];
}

export interface AuthenticityScoreInput {
  readonly content: string;
  readonly titles: readonly string[];
  readonly voiceMarkersUsed: readonly string[];
  readonly callbacksUsed: readonly string[];
  readonly communityPack: CommunityVoicePack;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function calculateSentenceVariance(sentences: string[]): number {
  if (sentences.length <= 1) {
    return sentences.length === 1 ? clamp(sentences[0].length / 120, 0, 1) : 0;
  }
  const lengths = sentences.map(sentence => sentence.trim().length).filter(length => length > 0);
  if (lengths.length === 0) {
    return 0;
  }
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  const variance = maxLength - minLength;
  return clamp(variance / Math.max(1, maxLength), 0, 1);
}

function countFirstPerson(content: string): number {
  const matches = content.match(/\b(I|me|my|mine|myself)\b/giu);
  return matches ? matches.length : 0;
}

function countHumorReferences(content: string, pack: CommunityVoicePack): number {
  const lowerContent = content.toLowerCase();
  return pack.humorReferences.reduce((count, reference) => {
    return lowerContent.includes(reference.toLowerCase()) ? count + 1 : count;
  }, 0);
}

export function scoreAuthenticity(input: AuthenticityScoreInput): AuthenticityScore {
  const sentences = input.content.split(/(?<=[.!?])\s+/u).filter(sentence => sentence.trim().length > 0);
  const wordCount = input.content.split(/\s+/u).filter(word => word.length > 0).length;
  const firstPersonCount = countFirstPerson(input.content);
  const humorReferences = countHumorReferences(input.content, input.communityPack);

  const voiceMarkerDensity = clamp(
    safeDivide(input.voiceMarkersUsed.length, Math.max(1, sentences.length)),
    0,
    1
  );
  const firstPersonRatio = clamp(safeDivide(firstPersonCount, Math.max(1, wordCount)), 0, 1);
  const sentenceVariance = calculateSentenceVariance(sentences);
  const callbacksUsed = input.callbacksUsed.length;

  const humorScore = clamp(
    safeDivide(humorReferences, Math.max(1, input.communityPack.humorReferences.length)),
    0,
    1
  );

  const score = parseFloat(
    (
      voiceMarkerDensity * 0.25 +
      firstPersonRatio * 0.35 +
      sentenceVariance * 0.2 +
      humorScore * 0.15 +
      clamp(callbacksUsed / 3, 0, 1) * 0.05
    ).toFixed(3)
  );

  const warnings: string[] = [];
  if (firstPersonRatio < 0.15) {
    warnings.push('Increase first-person storytelling for authenticity.');
  }
  if (voiceMarkerDensity < 0.15) {
    warnings.push('Conversation markers are sparse; try adding vernacular touches.');
  }
  if (sentenceVariance < 0.1) {
    warnings.push('Sentence lengths feel too uniform—vary pacing.');
  }
  if (humorReferences === 0 && input.communityPack.humorReferences.length > 0) {
    warnings.push('Consider referencing community humor or inside jokes.');
  }

  return {
    score,
    details: {
      voiceMarkerDensity,
      firstPersonRatio,
      sentenceVariance,
      humorReferenceCount: humorReferences,
      callbacksUsed
    },
    warnings
  };
}
