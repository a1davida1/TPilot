
import type { CommunityVoicePack } from './community-voice-packs.js';

export interface ConversationalToneConfig {
  readonly platform?: string;
  readonly voiceMarkers: readonly string[];
  readonly fillerWords: readonly string[];
  readonly contractionProbability: number;
  readonly voiceMarkerProbability: number;
  readonly fragmentProbability: number;
  readonly allowImperfections?: boolean;
  readonly random?: () => number;
}

export interface ConversationalToneResult {
  text: string;
  voiceMarkersUsed: string[];
  contractionsApplied: number;
  fragmentsInserted: number;
}

const BASE_VOICE_MARKERS: readonly string[] = ['tbh', 'honestly', 'ngl', 'fr', 'I mean'];
const BASE_FILLERS: readonly string[] = ['and yeah,', 'so, like,', 'no lie,', 'for real,', 'not gonna lie,'];
const DEFAULT_FRAGMENT_TEMPLATE = (marker: string): string => `${marker} not gonna lie.`;

interface ContractionRule {
  readonly matcher: RegExp;
  readonly replacement: string;
}

const CONTRACTION_RULES: readonly ContractionRule[] = [
  { matcher: /\bI am\b/gi, replacement: "I'm" },
  { matcher: /\bare not\b/gi, replacement: "aren't" },
  { matcher: /\bis not\b/gi, replacement: "isn't" },
  { matcher: /\bwas not\b/gi, replacement: "wasn't" },
  { matcher: /\bwere not\b/gi, replacement: "weren't" },
  { matcher: /\bdo not\b/gi, replacement: "don't" },
  { matcher: /\bdid not\b/gi, replacement: "didn't" },
  { matcher: /\bdoes not\b/gi, replacement: "doesn't" },
  { matcher: /\bwill not\b/gi, replacement: "won't" },
  { matcher: /\bcan not\b/gi, replacement: "can't" },
  { matcher: /\bcannot\b/gi, replacement: "can't" },
  { matcher: /\bhave not\b/gi, replacement: "haven't" },
  { matcher: /\bhas not\b/gi, replacement: "hasn't" },
  { matcher: /\bhad not\b/gi, replacement: "hadn't" },
  { matcher: /\bshould have\b/gi, replacement: "should've" },
  { matcher: /\bcould have\b/gi, replacement: "could've" },
  { matcher: /\bwould have\b/gi, replacement: "would've" },
  { matcher: /\bI would\b/gi, replacement: "I'd" },
  { matcher: /\bI will\b/gi, replacement: "I'll" },
  { matcher: /\bI have\b/gi, replacement: "I've" },
  { matcher: /\bthat is\b/gi, replacement: "that's" },
  { matcher: /\bthere is\b/gi, replacement: "there's" }
];

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

function pickRandom<T>(values: readonly T[], random: () => number): T {
  if (values.length === 0) {
    throw new Error('Attempted to pick from an empty collection');
  }
  const index = Math.floor(random() * values.length);
  return values[index] ?? values[0];
}

function lowercaseFirst(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function applyCaseFromSource(source: string, replacement: string): string {
  if (source.toUpperCase() === source) {
    return replacement.toUpperCase();
  }
  if (source.toLowerCase() === source) {
    return replacement.toLowerCase();
  }
  if (source[0] === source[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function applyContractions(sentence: string, probability: number, random: () => number): { text: string; applied: number } {
  let result = sentence;
  let applied = 0;
  for (const rule of CONTRACTION_RULES) {
    if (random() > probability) {
      continue;
    }
    const matcher = new RegExp(rule.matcher);
    const replaced = result.replace(matcher, match => {
      applied += 1;
      return applyCaseFromSource(match, rule.replacement);
    });
    result = replaced;
  }
  return { text: result, applied };
}

function maybeInjectVoiceMarker(
  sentence: string,
  voiceMarkers: readonly string[],
  probability: number,
  random: () => number,
  used: string[]
): string {
  if (voiceMarkers.length === 0 || random() > probability) {
    return sentence;
  }
  const marker = pickRandom(voiceMarkers, random);
  used.push(marker);
  const trimmed = sentence.trim();
  if (trimmed.length === 0) {
    return `${marker}, ${sentence}`;
  }
  if (trimmed.length <= 40) {
    return `${marker}, ${trimmed}`;
  }
  if (random() < 0.5) {
    return `${marker}, ${lowercaseFirst(trimmed)}`;
  }
  return `${trimmed} (${marker})`;
}

function ensureSentenceVariance(
  sentences: string[],
  fillerWords: readonly string[],
  fragmentProbability: number,
  random: () => number,
  used: string[]
): { sentences: string[]; fragmentsInserted: number } {
  const normalized = [...sentences];
  let fragmentsInserted = 0;

  const hasShort = normalized.some(sentence => sentence.trim().length <= 50);
  if (!hasShort && normalized.length > 0 && random() < clamp(fragmentProbability, 0, 1)) {
    const marker = used[0] ?? (fillerWords.length > 0 ? fillerWords[0] : 'honestly');
    const fragment = DEFAULT_FRAGMENT_TEMPLATE(marker.replace(/[, ]+$/u, ''));
    normalized.splice(1, 0, fragment);
    fragmentsInserted += 1;
  }

  const hasLong = normalized.some(sentence => sentence.trim().length >= 110);
  if (!hasLong && normalized.length >= 2) {
    const filler = fillerWords.length > 0 ? pickRandom(fillerWords, random) : 'and yeah,';
    const merged = `${normalized[0].trim()} ${filler} ${lowercaseFirst(normalized[1].trim())}`.replace(/\s+/gu, ' ');
    normalized.splice(0, 2, merged);
  }

  return { sentences: normalized, fragmentsInserted };
}

function splitIntoSentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?])\s+/u).filter(part => part.trim().length > 0);
}

function joinSentences(sentences: string[], original: string): string {
  const trailingWhitespaceMatch = original.match(/\s+$/u);
  const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : '';
  return `${sentences.join(' ').replace(/\s+/gu, ' ').trim()}${trailingWhitespace}`;
}

export function applyConversationalTone(text: string, config: ConversationalToneConfig): ConversationalToneResult {
  if (text.trim().length === 0) {
    return {
      text,
      voiceMarkersUsed: [],
      contractionsApplied: 0,
      fragmentsInserted: 0
    };
  }

  const random = config.random ?? Math.random;
  const voiceMarkers = config.voiceMarkers.length > 0 ? config.voiceMarkers : BASE_VOICE_MARKERS;
  const fillerWords = config.fillerWords.length > 0 ? config.fillerWords : BASE_FILLERS;
  const voiceMarkersUsed: string[] = [];
  let contractionsApplied = 0;

  const paragraphs = text.split(/\n\n+/u);
  const processedParagraphs = paragraphs.map(paragraph => {
    const sentences = splitIntoSentences(paragraph);
    const processedSentences = sentences.map(sentence => {
      const contractionResult = applyContractions(sentence, clamp(config.contractionProbability, 0, 1), random);
      contractionsApplied += contractionResult.applied;
      const withVoiceMarker = maybeInjectVoiceMarker(
        contractionResult.text,
        voiceMarkers,
        clamp(config.voiceMarkerProbability, 0, 1),
        random,
        voiceMarkersUsed
      );
      return withVoiceMarker;
    });

    const varianceResult = ensureSentenceVariance(
      processedSentences,
      fillerWords,
      config.fragmentProbability,
      random,
      voiceMarkersUsed
    );
    return joinSentences(varianceResult.sentences, paragraph);
  });

  return {
    text: processedParagraphs.join('\n\n'),
    voiceMarkersUsed,
    contractionsApplied,
    fragmentsInserted: processedParagraphs.length - paragraphs.length
  };
}

export function buildConversationalToneConfig(
  communityPack: CommunityVoicePack,
  overrides: Partial<ConversationalToneConfig> | undefined,
  random: () => number,
  platform?: string
): ConversationalToneConfig {
  const baseMarkers = Array.from(new Set([
    ...BASE_VOICE_MARKERS,
    ...communityPack.voiceMarkers
  ]));

  const fillerWords = Array.from(new Set([
    ...BASE_FILLERS,
    ...communityPack.lexicon,
    ...communityPack.callouts
  ])).filter(entry => entry.trim().length > 0);

  return {
    platform,
    voiceMarkers: overrides?.voiceMarkers ?? baseMarkers,
    fillerWords: overrides?.fillerWords ?? fillerWords,
    contractionProbability: overrides?.contractionProbability ?? 0.55,
    voiceMarkerProbability: overrides?.voiceMarkerProbability ?? 0.6,
    fragmentProbability: overrides?.fragmentProbability ?? 0.35,
    allowImperfections: overrides?.allowImperfections ?? true,
    random: overrides?.random ?? random
  };
}
