
import fs from 'fs/promises';
import path from 'path';

export interface HumanizationConfig {
  maxQuirks?: number;
  random?: () => number;
}

export interface ContentParameters {
  photoType: 'casual' | 'workout' | 'shower' | 'showing-skin' | 'spicy' | 'very-spicy' | 'all-xs' | 'needs_review';
  textTone: 'confident' | 'playful' | 'mysterious' | 'authentic' | 'sassy';
  style: string;
  includePromotion: boolean;
  selectedHashtags: string[];
  customPrompt?: string;
  platform: string;
  humanization?: HumanizationConfig;
  humanizedLevel?: number;
}

export interface PhotoInstructions {
  lighting: string;
  angles: string;
  composition: string;
  styling: string;
  technical: string;
  sceneSetup: string;
}

export interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions: PhotoInstructions;
  tags: string[];
}

export interface PresetVariation {
  titles: string[];
  content: string;
  photoInstructions: PhotoInstructions;
}

export interface PhotoConfig {
  themes: string[];
  settings: string[];
  clothing: string[];
  lighting: string;
  angles: string;
  mood: string;
}

export interface ToneStyle {
  starters: string[];
  descriptors: string[];
  endings: string[];
  emojis: string[];
  imperfectionTokens?: string[];
  connectors?: string[];
  titlePatterns?: TitlePatternDefinition[];
  interjections?: string[];
}

interface PersonalToneConfig {
  openers: string[];
  customPromptIntros: string[];
  promoHooks: string[];
  closers: string[];
}

type TitlePatternType = 'statement' | 'question' | 'fragment';

interface TitlePatternDefinition {
  template: string;
  type?: TitlePatternType;
  emojiProbability?: number;
}

interface TitlePatternContext {
  starter: string;
  theme: string;
  altTheme: string;
  connector: string;
  emoji: string;
  punctuation: string;
  hedge: string;
  photoType: string;
}

interface FragmentDefinition {
  builder: (context: FragmentRuntimeContext) => string;
  weight?: number;
}

interface ToneFragmentPool {
  intro: FragmentDefinition[];
  promo: FragmentDefinition[];
  connectors: string[];
  fillers: string[];
}

interface PhotoFragmentPool {
  body: FragmentDefinition[];
  connectors: string[];
}

interface FragmentRuntimeContext {
  pickDescriptor(): string;
  pickTheme(): string;
  pickSetting(): string;
  pickEmoji(): string;
  pickFiller(): string;
  mood: string;
  photoType: ContentParameters['photoType'];
}

export interface ManualTypingOptions {
  humanizedLevel?: number;
  rng?: () => number;
}

type HashtagLayout = 'inline' | 'blankLine' | 'dotLadder';

interface HashtagToken {
  type: 'tag' | 'connector';
  value: string;
}

const DEFAULT_MAX_HUMANIZATION_QUIRKS = 2;

type RandomGenerator = () => number;

interface HumanizationOptions {
  maxQuirks?: number;
  random?: RandomGenerator;
}

interface HumanizationContext {
  random: RandomGenerator;
  toneStyle: ToneStyle;
}

interface HumanizationQuirk {
  chance: number;
  apply: (text: string, context: HumanizationContext) => string;
}

const LOWERCASE_INTERJECTIONS: readonly string[] = ['hmm', 'haha', 'um', 'oh'];

const SPELLING_VARIATIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bkind of\b/i, replacement: 'kinda' },
  { pattern: /\bsort of\b/i, replacement: 'sorta' },
  { pattern: /\bgoing to\b/i, replacement: 'gonna' },
  { pattern: /\bwant to\b/i, replacement: 'wanna' }
];

const EM_DASH_ASIDES = [
  'wait, let me brag for a sec',
  'okay, mild obsession happening',
  'small flex, forgive me',
  'just being dramatic for effect'
];

const CORRECTION_SNIPPETS = [
  'extra glow',
  'actual vibe',
  'soft focus',
  'cozy energy',
  'spicy detail'
];

const STRIKETHROUGH_EXCLUSIONS = ['~~'];

const PLATFORM_LAYOUT_MAP: Record<string, HashtagLayout> = {
  instagram: 'blankLine',
  'instagram-stories': 'blankLine',
  threads: 'blankLine',
  twitter: 'inline',
  x: 'inline',
  bluesky: 'inline',
  tiktok: 'dotLadder',
  onlyfans: 'dotLadder'
};

const HASHTAG_CONNECTORS: readonly string[] = ['✨', '🔥', 'mood check', 'energy boost', 'vibes', 'glow up', '•', 'spark'];

const HASHTAG_CASE_FORMATTERS: readonly ((tag: string) => string)[] = [
  (value: string) => `#${value.replace(/\s+/g, '').toLowerCase()}`,
  (value: string) => `#${toPascalCase(value)}`,
  (value: string) => `#${value.replace(/\s+/g, '').toUpperCase()}`
];

export function applyHumanization(content: string, toneStyle: ToneStyle, options?: HumanizationOptions): string {
  if (content.trim().length === 0) {
    return content;
  }

  const random: RandomGenerator = options?.random ?? Math.random;
  const requestedMax = options?.maxQuirks ?? DEFAULT_MAX_HUMANIZATION_QUIRKS;
  const maxQuirks = Math.max(0, Math.floor(requestedMax));

  if (maxQuirks === 0) {
    return content;
  }

  const context: HumanizationContext = { random, toneStyle };

  const quirks: HumanizationQuirk[] = [
    { chance: 0.2, apply: addTrailingEllipsis },
    { chance: 0.15, apply: insertLowercaseInterjection },
    { chance: 0.1, apply: dropSentencePronoun },
    { chance: 0.15, apply: applySpellingVariationQuirk }
  ];

  if (toneStyle.imperfectionTokens && toneStyle.imperfectionTokens.length > 0) {
    quirks.push({ chance: 0.2, apply: injectImperfectionToken });
  }

  let result = content;
  let applied = 0;

  for (const quirk of quirks) {
    if (applied >= maxQuirks) {
      break;
    }

    if (random() < quirk.chance) {
      const updated = quirk.apply(result, context);
      if (updated !== result) {
        result = updated;
        applied += 1;
      }
    }
  }

  return result;
}

function addTrailingEllipsis(text: string): string {
  const trailingWhitespaceMatch = text.match(/\s*$/);
  const whitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : '';
  const trimmed = text.slice(0, text.length - whitespace.length);

  if (trimmed.endsWith('...')) {
    return text;
  }

  if (trimmed.endsWith('.')) {
    return `${trimmed.slice(0, -1)}...${whitespace}`;
  }

  return `${trimmed}...${whitespace}`;
}

function insertLowercaseInterjection(text: string, context: HumanizationContext): string {
  if (text.length === 0) {
    return text;
  }

  const chosenIndex = Math.floor(context.random() * LOWERCASE_INTERJECTIONS.length);
  const interjection = LOWERCASE_INTERJECTIONS[chosenIndex] ?? LOWERCASE_INTERJECTIONS[0];

  const punctuationPattern = /([.!?])\s+/;
  const match = punctuationPattern.exec(text);

  if (match && match.index !== undefined) {
    const insertAt = match.index + match[0].length;
    return `${text.slice(0, insertAt)}${interjection}, ${text.slice(insertAt)}`;
  }

  return `${interjection}... ${text}`;
}

function dropSentencePronoun(text: string): string {
  const pronounPattern = /(^|[.!?]\s+)I\s+/;
  const match = pronounPattern.exec(text);

  if (!match || match.index === undefined) {
    return text;
  }

  const start = match.index + match[1].length;
  const remainder = text.slice(start + 2);

  if (remainder.length === 0) {
    return text;
  }

  return `${text.slice(0, start)}${remainder[0].toUpperCase()}${remainder.slice(1)}`;
}

function applySpellingVariationQuirk(text: string): string {
  for (const variation of SPELLING_VARIATIONS) {
    const match = variation.pattern.exec(text);
    if (match && match.index !== undefined) {
      const matchedValue = match[0];
      const replacement = matchedValue[0] === matchedValue[0].toUpperCase()
        ? variation.replacement.charAt(0).toUpperCase() + variation.replacement.slice(1)
        : variation.replacement;

      return `${text.slice(0, match.index)}${replacement}${text.slice(match.index + matchedValue.length)}`;
    }
  }

  return text;
}

function injectImperfectionToken(text: string, context: HumanizationContext): string {
  const tokens = context.toneStyle.imperfectionTokens;
  if (!tokens || tokens.length === 0) {
    return text;
  }

  const choiceIndex = Math.floor(context.random() * tokens.length);
  const token = tokens[choiceIndex] ?? tokens[0];
  if (!token) {
    return text;
  }

  const trimmed = text.trimEnd();
  if (trimmed.toLowerCase().endsWith(token.toLowerCase())) {
    return text;
  }

  const trailingWhitespaceMatch = text.match(/\s*$/);
  const whitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : '';

  return `${trimmed} ${token}${whitespace}`;
}

function clampHumanizedLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  if (level < 0) {
    return 0;
  }
  if (level > 1) {
    return 1;
  }
  return level;
}

function isWhitespaceToken(token: string): boolean {
  return /^\s+$/.test(token);
}

function extractTokenParts(token: string): { prefix: string; core: string; suffix: string } {
  const prefixMatch = token.match(/^[^A-Za-z0-9'']+/u);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const suffixMatch = token.match(/[^A-Za-z0-9'']+$/u);
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const core = token.slice(prefix.length, token.length - suffix.length);

  return { prefix, core, suffix };
}

function tokenContainsUrlOrHashtag(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return false;
  }
  const lowered = trimmed.toLowerCase();
  return trimmed.startsWith('#') || lowered.includes('http://') || lowered.includes('https://') || lowered.startsWith('www.');
}

function isSafeToken(token?: string): boolean {
  if (!token) {
    return false;
  }
  if (tokenContainsUrlOrHashtag(token) || token.includes('#')) {
    return false;
  }
  const { core } = extractTokenParts(token);
  return core.length > 0;
}

function pickRandomIndex(indices: number[], rng: () => number): number | undefined {
  if (indices.length === 0) {
    return undefined;
  }
  const rawIndex = Math.floor(rng() * indices.length);
  const safeIndex = rawIndex >= indices.length ? indices.length - 1 : rawIndex;
  return indices[safeIndex];
}

function pickRandomValue(values: string[], rng: () => number): string | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const rawIndex = Math.floor(rng() * values.length);
  const index = rawIndex >= values.length ? values.length - 1 : rawIndex;
  return values[index];
}

function injectInterjection(text: string, interjection: string): string {
  if (!interjection.trim()) {
    return text;
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith(interjection)) {
    return text;
  }
  return `${interjection} ${text}`;
}

function injectDoubleSpace(text: string, rng: () => number): string {
  const tokens = text.split(/(\s+)/);
  const candidateIndices: number[] = [];

  tokens.forEach((token, index) => {
    if (token === ' ' && isSafeToken(tokens[index - 1]) && isSafeToken(tokens[index + 1])) {
      candidateIndices.push(index);
    }
  });

  const targetIndex = pickRandomIndex(candidateIndices, rng);
  if (targetIndex === undefined) {
    return text;
  }

  tokens[targetIndex] = '  ';
  return tokens.join('');
}

function injectEmDashAside(text: string, rng: () => number): string {
  const aside = pickRandomValue(EM_DASH_ASIDES, rng);
  if (!aside) {
    return text;
  }

  const tokens = text.split(/(\s+)/);
  const candidateIndices: number[] = [];

  tokens.forEach((token, index) => {
    if (!isWhitespaceToken(token) && isSafeToken(token) && !token.includes('—')) {
      candidateIndices.push(index);
    }
  });

  const targetIndex = pickRandomIndex(candidateIndices, rng);
  if (targetIndex === undefined) {
    return text;
  }

  const { prefix, core, suffix } = extractTokenParts(tokens[targetIndex]);
  if (!core) {
    return text;
  }

  tokens[targetIndex] = `${prefix}${core} — ${aside} —${suffix}`;
  return tokens.join('');
}

function injectCorrection(text: string, rng: () => number): string {
  const correction = pickRandomValue(CORRECTION_SNIPPETS, rng);
  if (!correction) {
    return text;
  }

  const tokens = text.split(/(\s+)/);
  const candidateIndices: number[] = [];

  tokens.forEach((token, index) => {
    if (!isWhitespaceToken(token) && isSafeToken(token) && !token.toLowerCase().includes('oops meant')) {
      candidateIndices.push(index);
    }
  });

  const targetIndex = pickRandomIndex(candidateIndices, rng);
  if (targetIndex === undefined) {
    return text;
  }

  const { prefix, core, suffix } = extractTokenParts(tokens[targetIndex]);
  if (!core) {
    return text;
  }

  tokens[targetIndex] = `${prefix}${core} (oops meant ${correction})${suffix}`;
  return tokens.join('');
}

function injectStrikethrough(text: string, rng: () => number): string {
  const tokens = text.split(/(\s+)/);
  const candidateIndices: number[] = [];

  tokens.forEach((token, index) => {
    if (!isWhitespaceToken(token) && isSafeToken(token) && !STRIKETHROUGH_EXCLUSIONS.some((marker) => token.includes(marker))) {
      const { core } = extractTokenParts(token);
      if (core.length > 2 && !/\s/u.test(core)) {
        candidateIndices.push(index);
      }
    }
  });

  const targetIndex = pickRandomIndex(candidateIndices, rng);
  if (targetIndex === undefined) {
    return text;
  }

  const { prefix, core, suffix } = extractTokenParts(tokens[targetIndex]);
  if (!core) {
    return text;
  }

  tokens[targetIndex] = `${prefix}~~${core}~~${suffix}`;
  return tokens.join('');
}

function toPascalCase(value: string): string {
  const segments = value.match(/[A-Za-z0-9]+/g);
  if (!segments) {
    return '';
  }
  return segments
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join('');
}

function isHashtagLayout(value: string): value is HashtagLayout {
  return value === 'inline' || value === 'blankLine' || value === 'dotLadder';
}

function extractLayoutOverride(platform: string): HashtagLayout | null {
  const hint = platform.split(':').pop();
  if (!hint) {
    return null;
  }
  return isHashtagLayout(hint) ? hint : null;
}

function resolveHashtagLayout(platform: string): HashtagLayout {
  const normalized = platform.trim().toLowerCase();
  const override = extractLayoutOverride(normalized);
  if (override) {
    return override;
  }
  if (normalized in PLATFORM_LAYOUT_MAP) {
    return PLATFORM_LAYOUT_MAP[normalized];
  }
  if (normalized.includes('instagram')) {
    return 'blankLine';
  }
  if (normalized.includes('twitter') || normalized.includes('x')) {
    return 'inline';
  }
  if (normalized.includes('tiktok')) {
    return 'dotLadder';
  }
  return 'dotLadder';
}

function normalizeHashtag(rawTag: string): string {
  return rawTag.replace(/^#+/, '').trim();
}

function applyRandomCasing(tag: string, random: () => number): string {
  const formatterIndex = Math.floor(random() * HASHTAG_CASE_FORMATTERS.length);
  const formatter = HASHTAG_CASE_FORMATTERS[formatterIndex];
  const formatted = formatter(tag);
  if (formatted.length <= 1) {
    return `#${tag.replace(/\s+/g, '')}`;
  }
  return formatted;
}

function selectConnector(random: () => number, connectorPool: readonly string[]): string | null {
  if (random() < 0.5) {
    return null;
  }
  const index = Math.floor(random() * connectorPool.length);
  return connectorPool[index];
}

function buildHashtagTokens(
  hashtags: string[],
  toneEmojis: readonly string[],
  random: () => number
): HashtagToken[] {
  const tokens: HashtagToken[] = [];
  const connectorPool: readonly string[] = toneEmojis.length > 0
    ? [...HASHTAG_CONNECTORS, ...toneEmojis]
    : HASHTAG_CONNECTORS;
  hashtags.forEach((rawTag, index) => {
    const normalized = normalizeHashtag(rawTag);
    if (!normalized) {
      return;
    }
    tokens.push({
      type: 'tag',
      value: applyRandomCasing(normalized, random)
    });
    if (index < hashtags.length - 1) {
      const connector = selectConnector(random, connectorPool);
      if (connector) {
        tokens.push({ type: 'connector', value: connector });
      }
    }
  });
  return tokens;
}

function inlineHashtagText(tokens: HashtagToken[]): string {
  const parts = tokens.map(token => token.value);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function applyInlineHashtags(content: string, tokens: HashtagToken[]): string {
  const inlineText = inlineHashtagText(tokens);
  if (!inlineText) {
    return content.trimEnd();
  }
  const trimmed = content.trimEnd();
  const punctuationMatch = trimmed.match(/([.!?…]+)$/u);
  if (!punctuationMatch) {
    return `${trimmed} ${inlineText}`;
  }
  return `${trimmed.slice(0, -punctuationMatch[0].length)} ${inlineText}${punctuationMatch[0]}`;
}

function applyBlankLineHashtags(content: string, tokens: HashtagToken[]): string {
  const trimmed = content.trimEnd();
  const blockEntries = tokens.map(token => token.value);
  if (blockEntries.length === 0) {
    return trimmed;
  }
  return `${trimmed}\n\n${blockEntries.join('\n\n')}`;
}

function applyDotLadderHashtags(content: string, tokens: HashtagToken[], random: () => number): string {
  const trimmed = content.trimEnd();
  const blockEntries = tokens.map(token => token.value);
  if (blockEntries.length === 0) {
    return trimmed;
  }
  const ladderHeight = 4 + Math.floor(random() * 3); // 4-6 lines to hide hashtags
  const ladder = Array.from({ length: ladderHeight }, () => '.').join('\n');
  return `${trimmed}\n\n${ladder}\n${blockEntries.join('\n')}`;
}

function applyHashtagLayout(
  content: string,
  tokens: HashtagToken[],
  layout: HashtagLayout,
  random: () => number
): string {
  switch (layout) {
    case 'inline':
      return applyInlineHashtags(content, tokens);
    case 'blankLine':
      return applyBlankLineHashtags(content, tokens);
    case 'dotLadder':
    default:
      return applyDotLadderHashtags(content, tokens, random);
  }
}

export function simulateManualTyping(content: string, toneStyle: ToneStyle, options: ManualTypingOptions = {}): string {
  const rng = options.rng ?? Math.random;
  const normalizedLevel = clampHumanizedLevel(options.humanizedLevel ?? 0);

  if (normalizedLevel <= 0) {
    return content;
  }

  const shouldApply = (baseProbability: number): boolean => rng() < baseProbability * normalizedLevel;

  let mutated = content;

  if (toneStyle.interjections && toneStyle.interjections.length > 0 && shouldApply(0.25)) {
    const interjection = pickRandomValue(toneStyle.interjections, rng);
    if (interjection) {
      mutated = injectInterjection(mutated, interjection);
    }
  }

  if (shouldApply(0.2)) {
    mutated = injectDoubleSpace(mutated, rng);
  }

  if (shouldApply(0.18)) {
    mutated = injectEmDashAside(mutated, rng);
  }

  if (shouldApply(0.15)) {
    mutated = injectCorrection(mutated, rng);
  }

  if (shouldApply(0.12)) {
    mutated = injectStrikethrough(mutated, rng);
  }

  return mutated;
}

// Photo Type Specific Content Variations
const photoTypeVariations = {
  'teasing': {
    themes: ['playful tease', 'subtle hint', 'flirty suggestion', 'mysterious allure', 'coy moment'],
    settings: ['bedroom door', 'mirror selfie', 'cozy couch', 'bath time', 'morning bed'],
    clothing: ['oversized shirt', 'silk robe', 'cute lingerie peek', 'towel wrap', 'strategic coverage'],
    lighting: 'Soft intimate lighting, warm candlelight, sunset glow',
    angles: 'Teasing glimpses, over-shoulder looks, partial reveals',
    mood: 'playful and teasing'
  },
  'behind-scenes': {
    themes: ['getting ready', 'makeup process', 'outfit selection', 'photoshoot prep', 'content creation'],
    settings: ['vanity mirror', 'wardrobe area', 'makeup station', 'photo setup', 'behind camera'],
    clothing: ['robe and lingerie', 'getting dressed', 'outfit changes', 'casual prep wear'],
    lighting: 'Natural backstage lighting, mirror lights, behind-the-scenes authenticity',
    angles: 'Candid preparation shots, mirror reflections, process documentation',
    mood: 'authentic and intimate'
  },
  'outfit': {
    themes: ['outfit reveal', 'fashion show', 'style showcase', 'wardrobe tour', 'clothing haul'],
    settings: ['bedroom mirror', 'dressing room', 'closet area', 'fashion backdrop', 'outfit display'],
    clothing: ['multiple outfits', 'lingerie sets', 'dress collection', 'style variations'],
    lighting: 'Bright fashion lighting, clear visibility, flattering angles',
    angles: 'Full body shots, detail close-ups, 360 turns, outfit transitions',
    mood: 'fashionable and stylish'
  },
  'casual': {
    themes: ['natural beauty', 'everyday moment', 'comfortable vibe', 'relaxed mood', 'candid capture'],
    settings: ['cozy bedroom', 'living room', 'coffee corner', 'reading nook', 'morning sunlight'],
    clothing: ['comfortable clothes', 'casual wear', 'cozy sweaters', 'relaxed fit', 'everyday style'],
    lighting: 'Natural window light, soft ambient lighting, golden hour glow',
    angles: 'Natural poses, candid moments, relaxed positioning',
    mood: 'comfortable and natural'
  },
  'workout': {
    themes: ['fitness journey', 'strength training', 'post-workout glow', 'active lifestyle', 'wellness focus'],
    settings: ['home gym', 'workout space', 'yoga mat', 'fitness studio', 'outdoor exercise'],
    clothing: ['activewear', 'sports bra', 'leggings', 'tank tops', 'workout gear'],
    lighting: 'Bright energetic lighting, natural gym light, motivational atmosphere',
    angles: 'Action shots, strength poses, progress documentation',
    mood: 'energetic and powerful'
  },
  'shower': {
    themes: ['self-care ritual', 'relaxation time', 'cleansing moment', 'peaceful solitude', 'steam dreams'],
    settings: ['bathroom', 'shower space', 'bathtub area', 'spa-like setting', 'private sanctuary'],
    clothing: ['towel wrap', 'minimal coverage', 'bath accessories', 'natural state'],
    lighting: 'Soft bathroom lighting, steam effects, water reflections',
    angles: 'Artistic water shots, steam silhouettes, relaxation moments',
    mood: 'peaceful and refreshing'
  },
  'showing-skin': {
    themes: ['body confidence', 'artistic expression', 'natural beauty', 'self-love', 'empowerment'],
    settings: ['private bedroom', 'artistic studio', 'natural lighting', 'intimate space', 'personal sanctuary'],
    clothing: ['minimal clothing', 'artistic draping', 'strategic coverage', 'natural confidence'],
    lighting: 'Artistic lighting, shadow play, body-positive illumination',
    angles: 'Tasteful artistic angles, empowering perspectives, confident poses',
    mood: 'confident and artistic'
  },
  'spicy': {
    themes: ['sensual mood', 'intimate moment', 'passionate expression', 'seductive energy', 'romantic vibe'],
    settings: ['dimly lit bedroom', 'intimate setting', 'romantic atmosphere', 'private space', 'cozy ambiance'],
    clothing: ['lingerie', 'silk items', 'elegant intimates', 'sensual fabrics', 'romantic wear'],
    lighting: 'Warm intimate lighting, candle glow, romantic ambiance',
    angles: 'Seductive poses, intimate perspectives, romantic framing',
    mood: 'romantic and seductive'
  },
  'very-spicy': {
    themes: ['intense passion', 'raw desire', 'uninhibited expression', 'bold confidence', 'fierce energy'],
    settings: ['private bedroom', 'intimate studio', 'personal space', 'artistic setting', 'bold environment'],
    clothing: ['minimal coverage', 'artistic nudity', 'bold choices', 'confident expression'],
    lighting: 'Dramatic lighting, bold contrasts, intense atmosphere',
    angles: 'Bold perspectives, confident poses, artistic intensity',
    mood: 'intense and passionate'
  },
  'all-xs': {
    themes: ['complete freedom', 'artistic expression', 'unlimited creativity', 'boundary pushing', 'raw art'],
    settings: ['private studio', 'artistic space', 'creative environment', 'personal gallery', 'art sanctuary'],
    clothing: ['artistic nudity', 'complete freedom', 'natural expression', 'unlimited creativity'],
    lighting: 'Professional studio lighting, artistic effects, creative illumination',
    angles: 'Unlimited creative perspectives, artistic freedom, boundary-free composition',
    mood: 'free and unlimited'
  },
  'needs_review': {
    themes: ['careful artistry', 'thoughtful expression', 'curated content', 'selective sharing', 'premium art'],
    settings: ['private studio', 'controlled environment', 'curated space', 'selective setting'],
    clothing: ['carefully chosen', 'artistically selected', 'thoughtfully curated'],
    lighting: 'Controlled lighting, careful illumination, selective exposure',
    angles: 'Curated perspectives, selective angles, thoughtful composition',
    mood: 'careful and curated'
  }
};

// Text Tone Styles
const textToneStyles: Record<ContentParameters['textTone'], ToneStyle> = {
  'confident': {
    starters: ["Just dropped", "Created some", "Brought you", "Here's what", "Made this"],
    descriptors: ["stunning", "powerful", "bold", "fierce", "incredible"],
    endings: ["and I'm proud of it", "feeling confident about this one", "own your power", "confidence is everything"],
    emojis: ["💪", "🔥", "✨", "👑", "💎"],
    imperfectionTokens: ['no doubt', 'for real'],
    connectors: [
      'locking in the',
      'dialed into that',
      'focused on delivering',
      'serving up',
      'owning that',
      'delivering on this'
    ],
    titlePatterns: [
      { template: '{starter} {connector} {theme} greatness{hedge}{punct}{emoji}', type: 'statement', emojiProbability: 0.8 },
      { template: '{starter} {theme} takeover locked in{punct}{emoji}', type: 'statement', emojiProbability: 0.7 },
      { template: '{theme} energy stays undefeated{punct}{emoji}', type: 'fragment', emojiProbability: 0.5 },
      { template: 'Who else wants {theme} levels like this{punct}{emoji}', type: 'question', emojiProbability: 0.4 },
      { template: 'Just{hedge} {theme} domination{punct}{emoji}', type: 'fragment', emojiProbability: 0.6 }
    ],
    interjections: ["hang on, hyping myself up", "wait, had to flex", "oops, brag moment"]
  },
  'playful': {
    starters: ["Guess what", "Oops!", "Surprise!", "Hey there", "So..."],
    descriptors: ["cute", "silly", "adorable", "cheeky", "mischievous"],
    endings: ["hope you like it!", "whoops! 🙈", "couldn't resist!", "being a little naughty"],
    emojis: ["😘", "🙈", "😇", "💕", "🎀"],
    imperfectionTokens: ['lol', 'hehe'],
    connectors: [
      'sneaking in some',
      'dropping off some',
      'slipping you some',
      'serving up',
      'sprinkling in',
      'sharing a bit of'
    ],
    titlePatterns: [
      { template: '{starter} {hedge} {theme} shenanigans just landed{punct}{emoji}', type: 'statement', emojiProbability: 0.85 },
      { template: '{starter} {connector} {theme} giggles{punct}{emoji}', type: 'statement', emojiProbability: 0.8 },
      { template: 'Could you handle {theme} chaos with me{punct}{emoji}', type: 'question', emojiProbability: 0.6 },
      { template: 'Just{hedge} a little {theme} tease{punct}{emoji}', type: 'fragment', emojiProbability: 0.7 },
      { template: '{theme} mood switched on{punct}{emoji}', type: 'fragment', emojiProbability: 0.5 }
    ],
    interjections: ["lol, no wait...", "jk (kinda)", "brb hyping this"]
  },
  'mysterious': {
    starters: ["Something happened", "In the shadows", "Late night", "Behind closed doors", "Secret moment"],
    descriptors: ["hidden", "forbidden", "mysterious", "secretive", "enigmatic"],
    endings: ["but that's all I'll say", "the rest remains hidden", "some secrets are worth keeping", "only for those who understand"],
    emojis: ["🌙", "🖤", "🕯️", "🔮", "💫"],
    imperfectionTokens: ['lowkey', 'shh'],
    connectors: [
      'hinting at the',
      'whispering about the',
      'veiling the',
      'masking those',
      'keeping quiet about the',
      'circling around these'
    ],
    titlePatterns: [
      { template: '{starter} {connector} {theme}{punct}{emoji}', type: 'statement', emojiProbability: 0.5 },
      { template: 'Just{hedge} a glimpse of {theme}{punct}{emoji}', type: 'fragment', emojiProbability: 0.4 },
      { template: 'Could you decode these {theme} whispers{punct}{emoji}', type: 'question', emojiProbability: 0.4 },
      { template: 'Behind closed doors it\'s {theme} everything{punct}{emoji}', type: 'statement', emojiProbability: 0.6 },
      { template: 'Shadows guard my {theme} secrets{punct}{emoji}', type: 'fragment', emojiProbability: 0.5 }
    ],
    interjections: ["shh, wait—", "hmm, maybe I said too much", "oops, almost spoiled it"]
  },
  'authentic': {
    starters: ["Real talk", "Being honest", "Just me", "Genuine moment", "Truth is"],
    descriptors: ["real", "honest", "genuine", "authentic", "true"],
    endings: ["just being myself", "no filters needed", "this is who I am", "raw and real"],
    emojis: ["💯", "✨", "🌸", "💗", "🌟"],
    imperfectionTokens: ['tbh', 'real talk'],
    connectors: [
      'sharing my',
      'opening up about the',
      'showing the',
      'documenting my',
      'living in this',
      'leaning into the'
    ],
    titlePatterns: [
      { template: '{starter} {connector} {theme} moments{punct}{emoji}', type: 'statement', emojiProbability: 0.7 },
      { template: 'Just{hedge} {theme} realness{punct}{emoji}', type: 'fragment', emojiProbability: 0.6 },
      { template: 'Anyone else feeling this {theme} energy{punct}{emoji}', type: 'question', emojiProbability: 0.5 },
      { template: 'My day was all {theme}{punct}{emoji}', type: 'statement', emojiProbability: 0.6 },
      { template: 'Letting you see the {theme} side{punct}{emoji}', type: 'fragment', emojiProbability: 0.5 }
    ],
    interjections: ["wait, let me be real", "oh, actually—", "haha, small stumble"]
  },
  'sassy': {
    starters: ["Listen up", "Well well", "Oh please", "You think", "Honey"],
    descriptors: ["fierce", "bold", "attitude", "confidence", "sass"],
    endings: ["deal with it", "take it or leave it", "that's how I roll", "bow down"],
    emojis: ["💅", "😏", "🔥", "👑", "💄"],
    imperfectionTokens: ['periodt', 'mkay'],
    connectors: [
      'serving up',
      'dropping that',
      'bringing the',
      'delivering full-on',
      'throwing down the',
      'flexing that'
    ],
    titlePatterns: [
      { template: '{starter}, {connector} {theme} attitude{punct}{emoji}', type: 'statement', emojiProbability: 0.85 },
      { template: 'Just{hedge} {theme} spice because I can{punct}{emoji}', type: 'statement', emojiProbability: 0.7 },
      { template: 'Think you can handle this {theme} heat{punct}{emoji}', type: 'question', emojiProbability: 0.6 },
      { template: 'Serving {theme} looks all day{punct}{emoji}', type: 'fragment', emojiProbability: 0.8 },
      { template: '{starter} {theme} drama{punct}{emoji}', type: 'fragment', emojiProbability: 0.7 }
    ],
    interjections: ["ugh wait—", "hold on, I did not just", "lol no actually"]
  }
};

const fallbackConnectors = ['with that', 'featuring a', 'serving up the', 'bringing some', 'showing off the'];

const personalToneConfigs: Record<ContentParameters['textTone'], PersonalToneConfig> = {
  confident: {
    openers: [
      'Hey you, figured you deserved first look.',
      'Giving you the private drop before anyone else sees it.',
      'You keep asking for the bold moments first, so here we go.'
    ],
    customPromptIntros: [
      'You asked me to channel',
      'You nudged me toward',
      'Taking your cue, I wrapped the shoot around'
    ],
    promoHooks: [
      'The rest is locked in the VIP vault waiting on you.',
      'Slide in when you want the full set—I tucked it aside for you.',
      'Your private feed has the uncut shots queued just for you.'
    ],
    closers: [
      'You keep me sharpening every detail just for you.',
      'Now tell me if it hits the way you imagined.',
      'Stay close and keep pushing me—I love giving you more.'
    ]
  },
  playful: {
    openers: [
      'Hey you, come peek at this before the crowd catches up.',
      'Pssst, sliding this to you first.',
      'You get the sneaky peek, okay?'
    ],
    customPromptIntros: [
      'Because you whispered about',
      'Since you dared me to try',
      'Following your little request for'
    ],
    promoHooks: [
      'I hid the bloopers and extra spice in your stash—come grab them.',
      'The secret folder with the rest is already labelled with your name.',
      'Hop over to our spot; the bonus clips are lounging there for you.'
    ],
    closers: [
      'Now tell me if it makes you blush like it did me.',
      'Only you get to giggle at the full story with me.',
      'Text me your reaction—I live for that little gasp.'
    ]
  },
  mysterious: {
    openers: [
      'Lean in, I saved this secret for you.',
      'Only you get this shadowy glimpse.',
      'Sharing a hush-hush moment with you alone.'
    ],
    customPromptIntros: [
      'You hinted that you craved',
      'Because you murmured about',
      'Following your quiet wish for'
    ],
    promoHooks: [
      'The rest waits in the dark corner reserved for you.',
      'You know the hidden doorway—step through when you want the rest.',
      'Our secret stash has more, but only when you come looking.'
    ],
    closers: [
      'Keep this between us and tell me how it makes you feel.',
      'Whisper back if you want me to reveal even more.',
      'I trust you to hold this secret close.'
    ]
  },
  authentic: {
    openers: [
      'Sending this straight to you because you always get me.',
      "You're the one I wanted to share this real moment with first.",
      "Only you understand why this matters, so it's yours first."
    ],
    customPromptIntros: [
      'Since you asked for something honest with',
      'You told me you wanted more of',
      'Because you crave the realness of'
    ],
    promoHooks: [
      'The rest of the story is sitting in our private space waiting for you.',
      'Come sit with me in the members corner—everything else is there for you.',
      'Your subscription feed has the full heart-on-sleeve set queued up.'
    ],
    closers: [
      'Thanks for letting me be this open with you.',
      'Tell me how it lands—I trust your take.',
      'Stay close; sharing it with you makes it feel safe.'
    ]
  },
  sassy: {
    openers: [
      'Alright you, soak this in before anyone gets jealous.',
      "Told you I'd spoil you first, so don't waste it.",
      "You know you love being the favorite—here's proof."
    ],
    customPromptIntros: [
      "Because you couldn't stop talking about",
      'You dared me to go bigger with',
      'Per your dramatic request for'
    ],
    promoHooks: [
      'The rest is locked up with your name on it—come earn it.',
      'I parked the wildest shots in your private gallery, so move.',
      'Snag the rest in our corner before I change my mind.'
    ],
    closers: [
      'Now remind me why you deserve round two.',
      "Tell me you can handle more and maybe I'll believe you.",
      "Don't keep me waiting if you want the encore."
    ]
  }
};

const fallbackTitlePatterns: TitlePatternDefinition[] = [
  { template: '{starter} {connector} {theme} session{punct}{emoji}', type: 'statement' },
  { template: '{starter} {theme} vibes just dropped{punct}{emoji}', type: 'statement' },
  { template: 'Today was{hedge} all about {theme}{punct}{emoji}', type: 'statement' },
  { template: 'Can you handle these {theme} moments{punct}{emoji}', type: 'question', emojiProbability: 0.5 },
  { template: 'Just {theme} energy right now{punct}{emoji}', type: 'fragment', emojiProbability: 0.6 }
];

const punctuationOptions = ['!', '…', '.'] as const;
const hedgeOptions = ['', '', '', '', 'kind of', 'sort of', 'maybe', 'almost', 'kinda', 'low-key', 'just about'] as const;

const DEFAULT_EMOJI_PROBABILITY = 0.7;
const MIN_TITLES = 3;
const MAX_TITLES = 5;
const MAX_TITLE_GENERATION_ATTEMPTS = 40;
const patternPlaceholderRegex = /\{(starterLower|starter|themeAlt|theme|connector|hedge|punct|punctuation|emoji|photoType)\}/gu;

function randomFromArray<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error('Cannot select from an empty array');
  }

  return values[Math.floor(Math.random() * values.length)];
}

function pickAlternateTheme(themes: readonly string[], current: string): string {
  const alternatives = themes.filter(theme => theme !== current);
  return alternatives.length > 0 ? randomFromArray(alternatives) : current;
}

function choosePunctuation(type: TitlePatternType | undefined): string {
  if (type === 'question') {
    return '?';
  }

  if (type === 'fragment') {
    return Math.random() < 0.5 ? '' : randomFromArray(punctuationOptions);
  }

  return randomFromArray(punctuationOptions);
}

function selectEmoji(emojis: readonly string[], probability: number): string {
  if (emojis.length === 0 || Math.random() >= probability) {
    return '';
  }

  return randomFromArray(emojis);
}

function cleanGeneratedTitle(value: string): string {
  return value
    .replace(/\s+([?!….,])/gu, '$1')
    .replace(/,\s*/gu, ', ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function ensureTerminalPunctuation(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function capitalizeSentence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function renderTitleFromPattern(pattern: TitlePatternDefinition, context: TitlePatternContext): string {
  const replacements: Record<string, string> = {
    starter: context.starter,
    starterLower: context.starter.toLowerCase(),
    theme: context.theme,
    themeAlt: context.altTheme,
    connector: context.connector,
    hedge: context.hedge ? ` ${context.hedge}` : '',
    punct: context.punctuation,
    punctuation: context.punctuation,
    emoji: context.emoji ? ` ${context.emoji}` : '',
    photoType: context.photoType
  };

  let result = pattern.template.replace(patternPlaceholderRegex, (_match: string, key: string) => replacements[key] ?? '');

  if (!pattern.template.includes('{punct}') && pattern.type !== 'fragment') {
    result += context.punctuation;
  }

  if (pattern.type === 'question' && !result.trim().endsWith('?')) {
    result = `${result.trim()}?`;
  }

  return cleanGeneratedTitle(result);
}

function shuffleArray<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = temp;
  }

  return values;
}

export const toneFragmentPools: Record<ContentParameters['textTone'], ToneFragmentPool> = {
  'confident': {
    fillers: ['honestly', 'not gonna lie', 'for real', 'straight up', 'seriously'],
    connectors: ['btw,', 'plus,', 'so here\'s the kicker:', 'and yeah,', 'because yeah,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I pulled together something ${context.pickDescriptor()} in the ${context.pickSetting()}.`
      },
      {
        builder: context => `I\'m serving ${context.pickDescriptor()} energy with that ${context.pickTheme()} concept ${context.pickEmoji()}`
      },
      {
        builder: context => `Built this drop like a pro and it shows in every ${context.pickDescriptor()} detail.`
      },
      {
        builder: context => `That ${context.pickTheme()} moment turned into a ${context.pickDescriptor()} flex real quick.`
      }
    ],
    promo: [
      {
        weight: 2,
        builder: context => `VIPs get the full ${context.pickDescriptor()} reel — it\'s stacked with ${context.pickTheme()} angles.`
      },
      {
        builder: () => `Slide into the premium tier if you want the complete story — I\'m not trimming the heat.`
      },
      {
        builder: context => `Premium fam knows I don\'t play — the extras are straight ${context.pickDescriptor()} moments ${context.pickEmoji()}`
      }
    ]
  },
  'playful': {
    fillers: ['kinda', 'honestly', 'not gonna lie', 'low-key', 'sorta'],
    connectors: ['btw,', 'so yeah,', 'and yup,', 'alsooo,', 'meanwhile,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I went ${context.pickDescriptor()} with this ${context.pickTheme()} idea.`
      },
      {
        builder: context => `I\'m giggling because that ${context.pickSetting()} turned into something ${context.pickDescriptor()} real fast.`
      },
      {
        builder: context => `Tell me why I\'m obsessed with this ${context.pickTheme()} moment ${context.pickEmoji()}`
      },
      {
        builder: context => `I kinda let the ${context.pickDescriptor()} vibes run wild today and I\'m not sorry.`
      }
    ],
    promo: [
      {
        builder: context => `If you wanna peek at the rest, it\'s hiding in my VIP corner being all ${context.pickDescriptor()}.`
      },
      {
        weight: 2,
        builder: () => `Full blooper reel and spicy outtakes are chilling behind the subscribe button 😘`
      },
      {
        builder: context => `Promise the premium set has even more ${context.pickDescriptor()} silliness waiting.`
      }
    ]
  },
  'mysterious': {
    fillers: ['quietly', 'low-key', 'hushed', 'softly', 'honestly'],
    connectors: ['in the shadows,', 'between us,', 'just saying,', 'and yet,', 'meanwhile,'],
    intro: [
      {
        weight: 2,
        builder: context => `${formatFiller(context.pickFiller())} I wandered through a ${context.pickTheme()} night and captured the whispers.`
      },
      {
        builder: context => `There\'s a ${context.pickDescriptor()} hush in that ${context.pickSetting()} that I can\'t shake.`
      },
      {
        builder: context => `Some ${context.pickTheme()} secrets slipped out and I just let the camera listen ${context.pickEmoji()}`
      },
      {
        builder: context => `Let\'s just say the ${context.pickDescriptor()} mood got recorded quietly.`
      }
    ],
    promo: [
      {
        builder: context => `The deeper layers stay locked for those curious enough to chase the ${context.pickDescriptor()} glow.`
      },
      {
        builder: () => `Only the inner circle gets the full tale — the rest remains tucked away.`
      },
      {
        weight: 2,
        builder: context => `Follow the trail if you crave the entire ${context.pickTheme()} enigma.`
      }
    ]
  },
  'authentic': {
    fillers: ['honestly', 'for real', 'not gonna lie', 'truthfully', 'kinda'],
    connectors: ['real talk,', 'btw,', 'and honestly,', 'because, honestly,', 'meanwhile,'],
    intro: [
      {
        weight: 2,
        builder: context => `${formatFiller(context.pickFiller())} it\'s just me leaning into that ${context.pickTheme()} story.`
      },
      {
        builder: context => `I kept it ${context.pickDescriptor()} in the ${context.pickSetting()} — nothing staged, promise.`
      },
      {
        builder: context => `I\'m sharing the ${context.pickTheme()} moment exactly how it felt ${context.pickEmoji()}`
      },
      {
        builder: () => `I\'m just letting the candid vibes breathe today.`
      }
    ],
    promo: [
      {
        builder: context => `If you vibe with the realness, the full gallery stays cozy with my subs — it\'s all ${context.pickDescriptor()}.`
      },
      {
        builder: () => `I dropped more raw takes for members — zero polish, just truth.`
      },
      {
        weight: 2,
        builder: context => `Subscribers get the extended cut and every ${context.pickDescriptor()} breath in between.`
      }
    ]
  },
  'sassy': {
    fillers: ['honestly', 'not gonna lie', 'dead serious', 'kinda', 'for real'],
    connectors: ['btw,', 'so yeah,', 'and guess what,', 'meanwhile,', 'also,'],
    intro: [
      {
        weight: 3,
        builder: context => `${formatFiller(context.pickFiller())} I snapped ${context.pickDescriptor()} shots and I\'m feeling myself.`
      },
      {
        builder: context => `Try keeping up with this ${context.pickDescriptor()} attitude coming straight from the ${context.pickSetting()}.`
      },
      {
        builder: context => `I let the ${context.pickTheme()} fantasy play and now you\'re welcome ${context.pickEmoji()}`
      },
      {
        builder: () => `I\'m not toning it down — why would I?`
      }
    ],
    promo: [
      {
        builder: context => `If you\'re bold enough, the premium feed is stacked with unapologetic ${context.pickDescriptor()} clips.`
      },
      {
        builder: () => `VIPs get the talk-back moments — the spice, the shade, all of it.`
      },
      {
        weight: 2,
        builder: context => `Subscribers already know the ${context.pickTheme()} aftermath stays locked up with me.`
      }
    ]
  }
};

export const photoTypeFragmentPools: Record<ContentParameters['photoType'], PhotoFragmentPool> = {
  'casual': {
    connectors: ['in that moment,', 'and then,', 'so naturally,', 'right after,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Sunlight through the ${context.pickSetting()} made everything feel ${context.pickDescriptor()} and undone.`
      },
      {
        builder: context => `Messy hair, comfy layers, and the ${context.mood} vibe kinda took over.`
      },
      {
        builder: context => `It\'s just me and that ${context.pickTheme()} slice of life — nothing forced, just ease.`
      },
      {
        builder: context => `We\'re talking soft laughs, bare feet, and a ${context.pickDescriptor()} calm.`
      }
    ]
  },
  'workout': {
    connectors: ['after the last rep,', 'between sets,', 'and then,', 'while catching breath,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Sweat dripping in the ${context.pickSetting()} and I\'m feeling ${context.pickDescriptor()} strong.`
      },
      {
        builder: context => `That ${context.pickTheme()} grind left my pulse racing and my smile all kinds of wild.`
      },
      {
        builder: context => `I\'m flexing, laughing, and letting the ${context.mood} glow show.`
      },
      {
        builder: context => `Endorphins hit, music stayed loud, and the camera caught the ${context.pickDescriptor()} finish.`
      }
    ]
  },
  'shower': {
    connectors: ['under the steam,', 'while the water fell,', 'between droplets,', 'softly,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `Steam wrapped the ${context.pickSetting()} and everything went ${context.pickDescriptor()} and hazy.`
      },
      {
        builder: context => `Water traced my shoulders while that ${context.pickTheme()} idea soaked in.`
      },
      {
        builder: context => `It\'s all warm tiles, slick skin, and a ${context.mood} hush.`
      },
      {
        builder: context => `I\'m letting the droplets tell the ${context.pickDescriptor()} story.`
      }
    ]
  },
  'showing-skin': {
    connectors: ['with every curve,', 'frame by frame,', 'and then,', 'meanwhile,', 'slowly,'],
    body: [
      {
        builder: context => `Soft fabrics slipped away until the ${context.pickDescriptor()} shapes owned the ${context.pickSetting()}.`
      },
      {
        weight: 2,
        builder: context => `Shadow lines on skin made that ${context.pickTheme()} story glow.`
      },
      {
        builder: context => `I\'m celebrating the body, the light, and that ${context.mood} confidence.`
      },
      {
        builder: context => `The lens lingered because every angle felt ${context.pickDescriptor()} and intentional.`
      }
    ]
  },
  'spicy': {
    connectors: ['no lie,', 'right when the heat rose,', 'and after that,', 'meanwhile,', 'between whispers,'],
    body: [
      {
        weight: 2,
        builder: context => `Silk, shadows, and a ${context.pickDescriptor()} smirk turned the ${context.pickSetting()} molten.`
      },
      {
        builder: context => `I rode that ${context.pickTheme()} wave until the room felt like embers.`
      },
      {
        builder: context => `The ${context.mood} tension snapped right as the shutter clicked.`
      },
      {
        builder: context => `We played with light so every highlight screamed ${context.pickDescriptor()}.`
      }
    ]
  },
  'very-spicy': {
    connectors: ['truth be told,', 'and yeah,', 'while the candles burned,', 'between heartbeats,', 'meanwhile,'],
    body: [
      {
        weight: 2,
        builder: context => `No filter, just ${context.pickDescriptor()} intensity draped across the ${context.pickSetting()}.`
      },
      {
        builder: context => `Every ${context.pickTheme()} whisper turned louder and I didn\'t flinch.`
      },
      {
        builder: context => `It\'s bare skin, raw edges, and a ${context.mood} surrender.`
      },
      {
        builder: context => `I held the pose until the fire looked right back.`
      }
    ]
  },
  'all-xs': {
    connectors: ['full disclosure,', 'meanwhile,', 'when the limits fell,', 'after that,', 'between bold beats,'],
    body: [
      {
        weight: 2,
        builder: context => `Pushed every boundary in that ${context.pickSetting()} — it\'s ${context.pickDescriptor()} freedom.`
      },
      {
        builder: context => `The ${context.pickTheme()} vision went all the way and I didn\'t look back.`
      },
      {
        builder: context => `We played with every angle until the art felt limitless and ${context.pickDescriptor()}.`
      },
      {
        builder: context => `It\'s wild, raw, and dripping in ${context.mood} abandon.`
      }
    ]
  },
  'needs_review': {
    connectors: ['keeping it safe,', 'in that locked room,', 'between us,', 'meanwhile,', 'carefully,'],
    body: [
      {
        builder: context => `There\'s explicit artistry here — ${context.pickDescriptor()} and unapologetic.`
      },
      {
        weight: 2,
        builder: context => `Every ${context.pickTheme()} scene pushes the frame with intent.`
      },
      {
        builder: context => `I\'m curating what feels right, keeping the ${context.mood} promise intact.`
      },
      {
        builder: context => `Handled every shot carefully so it stays ${context.pickDescriptor()} and respectful.`
      }
    ]
  }
};

export const generalConnectors = ['btw,', 'so yeah,', 'and honestly,', 'plus,', 'meanwhile'];

interface SectionOptions {
  min?: number;
  max?: number;
  skipChance?: number;
}

function formatFiller(filler: string): string {
  const trimmed = filler.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[,:;!?]$/.test(capitalized) ? capitalized : `${capitalized},`;
}

function cleanSpacing(text: string): string {
  return text.replace(/\s+([,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function randomInt(min: number, max: number): number {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  if (maxValue < minValue) {
    return minValue;
  }
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty collection');
  }
  return items[Math.floor(Math.random() * items.length)];
}

function pickUniqueValue(values: string[], used: Set<string>): string {
  if (values.length === 0) {
    return '';
  }
  const available = values.filter(value => !used.has(value));
  const pool = available.length > 0 ? available : values;
  const choice = pickRandom(pool);
  used.add(choice);
  return choice;
}

function shuffleArrayInPlace<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

function pickWeightedIndex<T extends { weight?: number }>(items: T[]): number {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  if (totalWeight <= 0) {
    return 0;
  }
  let roll = Math.random() * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    roll -= items[index].weight ?? 1;
    if (roll <= 0) {
      return index;
    }
  }
  return items.length - 1;
}

export function selectWeightedUniqueFragments<T extends { weight?: number }>(items: T[], count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const available = [...items];
  const maxCount = Math.min(count, available.length);
  const selections: T[] = [];

  for (let index = 0; index < maxCount; index += 1) {
    const selectionIndex = pickWeightedIndex(available);
    selections.push(available[selectionIndex]);
    available.splice(selectionIndex, 1);
  }

  return selections;
}

function buildSection(pool: FragmentDefinition[], context: FragmentRuntimeContext, options?: SectionOptions): string {
  if (pool.length === 0) {
    return '';
  }

  const sectionOptions: Required<SectionOptions> = {
    min: options?.min ?? 2,
    max: options?.max ?? 3,
    skipChance: options?.skipChance ?? 0.2
  };

  const fragmentCount = randomInt(sectionOptions.min, sectionOptions.max);
  const selectedFragments = selectWeightedUniqueFragments(pool, fragmentCount);

  if (selectedFragments.length > 1 && Math.random() < sectionOptions.skipChance) {
    selectedFragments.splice(Math.floor(Math.random() * selectedFragments.length), 1);
  }

  const builtFragments = selectedFragments
    .map(fragment => fragment.builder(context).trim())
    .filter(fragmentText => fragmentText.length > 0);

  if (builtFragments.length === 0) {
    return '';
  }

  return cleanSpacing(shuffleArrayInPlace(builtFragments).join(' '));
}

function createFragmentContext(
  toneStyle: ToneStyle,
  photoConfig: PhotoConfig,
  fillers: string[],
  photoType: ContentParameters['photoType']
): FragmentRuntimeContext {
  const descriptorUsage = new Set<string>();
  const themeUsage = new Set<string>();
  const settingUsage = new Set<string>();
  const fillerPool = fillers.length > 0 ? fillers : ['honestly'];

  return {
    pickDescriptor: () => pickUniqueValue(toneStyle.descriptors, descriptorUsage),
    pickTheme: () => pickUniqueValue(photoConfig.themes, themeUsage),
    pickSetting: () => pickUniqueValue(photoConfig.settings, settingUsage),
    pickEmoji: () => (toneStyle.emojis.length > 0 ? pickRandom(toneStyle.emojis) : ''),
    pickFiller: () => pickRandom(fillerPool),
    mood: photoConfig.mood,
    photoType
  };
}

function buildCustomPromptSegment(customPrompt: string, connectors: string[]): string {
  const trimmedPrompt = customPrompt.trim();
  if (trimmedPrompt.length === 0) {
    return '';
  }

  const connectorPool = connectors.length > 0 ? connectors : generalConnectors;
  const prefix = connectorPool.length > 0 && Math.random() < 0.9 ? pickRandom(connectorPool) : '';
  const suffix = connectorPool.length > 0 && Math.random() < 0.35 ? pickRandom(connectorPool) : '';

  const parts: string[] = [];
  if (prefix) {
    parts.push(prefix);
  }
  parts.push(trimmedPrompt);
  if (suffix) {
    parts.push(suffix);
  }

  return cleanSpacing(parts.join(' '));
}

// Generate content based on all parameters
export function generateAdvancedContent(params: ContentParameters): GeneratedContent {
  // Check if this is a preset request and use preset variations
  const presetVariation = getRandomPresetVariation(params.style);
  if (presetVariation) {
    console.log(`🎯 Using preset variation for: ${params.style}`);
    return {
      titles: presetVariation.titles,
      content: presetVariation.content,
      photoInstructions: {
        lighting: presetVariation.photoInstructions.lighting,
        angles: presetVariation.photoInstructions.angles || "natural angles",
        composition: presetVariation.photoInstructions.composition,
        styling: presetVariation.photoInstructions.styling,
        technical: presetVariation.photoInstructions.technical || "natural lighting",
        sceneSetup: presetVariation.photoInstructions.sceneSetup || "casual setting"
      },
      tags: ['preset-content', params.style, params.platform]
    };
  }

  // Fallback to existing system for non-preset requests
  const photoConfig = photoTypeVariations[params.photoType as keyof typeof photoTypeVariations] || photoTypeVariations['casual'] as PhotoConfig;
  const toneStyle = textToneStyles[params.textTone as keyof typeof textToneStyles] || textToneStyles['authentic'] as ToneStyle;

  const titles = generateTitles(params, photoConfig, toneStyle);
  const content = generateMainContent(params, photoConfig, toneStyle);
  const photoInstructions = generatePhotoInstructions(params, photoConfig);
  const tags = generateTags(params, photoConfig);

  return {
    titles,
    content,
    photoInstructions,
    tags
  };
}

async function loadPresetVariations(): Promise<Record<string, PresetVariation[]>> {
  try {
    const presetPath = path.join(process.cwd(), 'prompts', 'preset-variations.json');
    const data = await fs.readFile(presetPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('No preset variations file found, using built-in presets');
    return {
      'morning-coffee': [{
        titles: ["Morning coffee and cozy vibes ☕", "Starting my day right", "Coffee in hand, ready for anything"],
        content: "There's something magical about that first sip of coffee in the morning. Messy hair, cozy sweater, and that peaceful moment before the day begins. Just me and my thoughts in the quiet morning light.",
        photoInstructions: {
          lighting: "Soft morning light, golden hour glow through windows",
          angles: "Candid morning shots, cozy intimate angles",
          composition: "Natural comfortable framing with coffee elements",
          styling: "Cozy morning wear, comfortable and relaxed",
          technical: "Natural lighting, soft focus, warm tones",
          sceneSetup: "Cozy morning setting with coffee and natural light"
        }
      }],
      'workout-motivation': [{
        titles: ["Post-workout glow hits different 💪", "Feeling strong and unstoppable", "Sweat, determination, and pride"],
        content: "Just finished an intense workout and I'm feeling incredible. There's something about pushing your limits that makes you feel alive. Endorphins flowing, muscles burning in the best way, and that sense of accomplishment.",
        photoInstructions: {
          lighting: "Bright energetic lighting, motivational atmosphere",
          angles: "Strong empowering angles, action documentation",
          composition: "Athletic framing showing strength and determination",
          styling: "Workout gear, athletic wear, fitness focused",
          technical: "Clear bright lighting, action-ready settings",
          sceneSetup: "Gym or workout space, fitness equipment visible"
        }
      }]
    };
  }
}

let presetVariationsCache: Record<string, PresetVariation[]> | null = null;

async function getPresetVariations(): Promise<Record<string, PresetVariation[]>> {
  if (!presetVariationsCache) {
    presetVariationsCache = await loadPresetVariations();
  }
  return presetVariationsCache;
}

function getRandomPresetVariation(presetId: string): PresetVariation | null {
  // This is a synchronous version that returns null for non-preset requests
  // The async loading is handled elsewhere
  return null;
}

function generateTitles(params: ContentParameters, photoConfig: PhotoConfig, toneStyle: ToneStyle): string[] {
  const desiredTitleCount = Math.floor(Math.random() * (MAX_TITLES - MIN_TITLES + 1)) + MIN_TITLES;
  const themes = photoConfig.themes;
  const starters = toneStyle.starters;
  const emojis = toneStyle.emojis;
  
  const connectorPool = (toneStyle.connectors ?? []).filter(connector => connector.trim().length > 0);
  const connectors = connectorPool.length > 0 ? connectorPool : fallbackConnectors;
  const basePatterns = toneStyle.titlePatterns && toneStyle.titlePatterns.length > 0 ? toneStyle.titlePatterns : fallbackTitlePatterns;
  const specialPatterns: TitlePatternDefinition[] = [];
  const readablePhotoType = params.photoType.replace(/-/g, ' ');

  if (params.photoType === 'all-xs') {
    specialPatterns.push(
      { template: 'Warning: {theme} content ahead - not for everyone{punct}{emoji}', type: 'statement', emojiProbability: 0.5 },
      { template: '{starter} the limits are gone tonight{punct}{emoji}', type: 'statement', emojiProbability: 0.6 }
    );
  } else if (params.photoType === 'very-spicy') {
    specialPatterns.push(
      { template: '{starter} {theme} intensity unlocked{punct}{emoji}', type: 'statement', emojiProbability: 0.7 },
      { template: 'Taking {themeAlt} right to the edge{punct}{emoji}', type: 'fragment', emojiProbability: 0.6 }
    );
  } else if (params.photoType === 'spicy') {
    specialPatterns.push(
      { template: '{theme} mood activated{punct}{emoji}', type: 'fragment', emojiProbability: 0.7 },
      { template: '{starter} turning the {theme} heat way up{punct}{emoji}', type: 'statement', emojiProbability: 0.6 }
    );
  }

  const patternPool: TitlePatternDefinition[] = [
    ...basePatterns,
    ...specialPatterns,
    ...(toneStyle.titlePatterns && toneStyle.titlePatterns.length > 0 ? fallbackTitlePatterns : [])
  ];

  const generatedTitles = new Set<string>();
  let attempts = 0;

  while (generatedTitles.size < desiredTitleCount && attempts < MAX_TITLE_GENERATION_ATTEMPTS) {
    attempts += 1;

    const pattern = randomFromArray(patternPool);
    const starter = randomFromArray(starters);
    const theme = randomFromArray(themes);
    const altTheme = pickAlternateTheme(themes, theme);
    const connector = randomFromArray(connectors);
    const punctuation = choosePunctuation(pattern.type);
    const emoji = selectEmoji(emojis, pattern.emojiProbability ?? DEFAULT_EMOJI_PROBABILITY);
    const hedge = pattern.template.includes('{hedge}') ? randomFromArray(hedgeOptions) : '';

    const context: TitlePatternContext = {
      starter,
      theme,
      altTheme,
      connector,
      emoji,
      punctuation,
      hedge,
      photoType: readablePhotoType
    };

    const candidate = renderTitleFromPattern(pattern, context);

    if (candidate.length > 0) {
      generatedTitles.add(candidate);
    }
  }

  if (generatedTitles.size < MIN_TITLES) {
    while (generatedTitles.size < MIN_TITLES) {
      const fallbackStarter = randomFromArray(starters);
      const fallbackTheme = randomFromArray(themes);
      const fallbackPattern = fallbackTitlePatterns[generatedTitles.size % fallbackTitlePatterns.length];
      const fallbackContext: TitlePatternContext = {
        starter: fallbackStarter,
        theme: fallbackTheme,
        altTheme: pickAlternateTheme(themes, fallbackTheme),
        connector: randomFromArray(connectors),
        emoji: selectEmoji(emojis, DEFAULT_EMOJI_PROBABILITY),
        punctuation: choosePunctuation(fallbackPattern.type),
        hedge: fallbackPattern.template.includes('{hedge}') ? randomFromArray(hedgeOptions) : '',
        photoType: readablePhotoType
      };

      generatedTitles.add(renderTitleFromPattern(fallbackPattern, fallbackContext));
    }
  }

  const shuffledTitles = shuffleArray(Array.from(generatedTitles));

  return shuffledTitles.slice(0, desiredTitleCount);
}

function generateMainContent(params: ContentParameters, photoConfig: PhotoConfig, toneStyle: ToneStyle): string {
  const themes = photoConfig.themes;
  const settings = photoConfig.settings;
  const descriptors = toneStyle.descriptors;
  const endings = toneStyle.endings;
  const emojis = toneStyle.emojis;
  const personalTone = personalToneConfigs[params.textTone];

  const segments: string[] = [];
  const starter = pickRandom(toneStyle.starters);
  const opener = pickRandom(personalTone.openers);
  const descriptor = pickRandom(descriptors);
  const theme = pickRandom(themes);
  const setting = pickRandom(settings);
  const emoji = pickRandom(emojis);

  segments.push(`${opener} ${starter} I curated some ${descriptor} ${theme} moments in my ${setting} just for you ${emoji}.`);

  if (params.photoType === 'casual') {
    segments.push('Just me being my natural self for you—coffee in hand, messy hair, and that perfect morning light while I imagined you here with me.');
  } else if (params.photoType === 'workout') {
    segments.push('Pushed past my limits because I know you crave that post-session glow—every drop of sweat proof that I was thinking about you.');
  } else if (params.photoType === 'shower') {
    segments.push('Water, steam, and a room full of thoughts about you while the mirror fogged up like our private secret.');
  } else if (params.photoType === 'showing-skin') {
    segments.push('Turned the lens into a love letter—each curve and shadow composed with you in mind.');
  } else if (params.photoType === 'spicy') {
    segments.push('Let the heat rise just for you: silk sliding, shadows flickering, my gaze locked where I picture you standing.');
  } else if (params.photoType === 'very-spicy') {
    segments.push('Dropped every guard because you can handle it—raw passion, unapologetic and saved for your eyes only.');
  } else if (params.photoType === 'all-xs') {
    segments.push('Let myself go completely with you in mind—no limits, just the unfiltered truth I keep for you.');
  } else if (params.photoType === 'needs_review') {
    segments.push('Created something special that only you deserve to see—carefully curated with your desires in mind.');
  }

  const customPrompt = params.customPrompt?.trim();
  if (customPrompt) {
    const promptIntro = pickRandom(personalTone.customPromptIntros);
    segments.push(ensureTerminalPunctuation(`${promptIntro} ${customPrompt}`));
  }

  if (params.includePromotion) {
    segments.push(pickRandom(personalTone.promoHooks));
  }

  const ending = capitalizeSentence(ensureTerminalPunctuation(pickRandom(endings)));
  const closer = pickRandom(personalTone.closers);
  segments.push(`${ending} ${closer}`);

  let content = segments.filter(segment => segment.trim().length > 0).join(' ');

  if (params.selectedHashtags.length > 0) {
    const layout = resolveHashtagLayout(params.platform);
    const tokens = buildHashtagTokens(params.selectedHashtags, emojis, Math.random);
    content = applyHashtagLayout(content, tokens, layout, Math.random);
  }

  const humanizedLevel = params.humanizedLevel ?? 0;
  if (humanizedLevel > 0) {
    content = simulateManualTyping(content, toneStyle, { humanizedLevel });
  }

  const humanized = applyHumanization(content, toneStyle, {
    maxQuirks: params.humanization?.maxQuirks,
    random: params.humanization?.random
  });

  return humanized;
}

function generatePhotoInstructions(params: ContentParameters, photoConfig: PhotoConfig): GeneratedContent['photoInstructions'] {
  return {
    lighting: photoConfig.lighting + (params.photoType === 'shower' ? ', emphasis on steam and water reflections' : 
               params.photoType === 'workout' ? ', bright and energetic to show determination' :
               params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', dramatic contrasts and artistic shadows' : ''),
    angles: photoConfig.angles + (params.textTone === 'confident' ? ', powerful perspective shots' :
            params.textTone === 'playful' ? ', fun candid angles' :
            params.textTone === 'mysterious' ? ', shadowy artistic angles' : ''),
    composition: `${photoConfig.mood} composition with ${params.photoType === 'casual' ? 'natural framing' :
                 params.photoType === 'workout' ? 'dynamic action elements' :
                 params.photoType === 'shower' ? 'steam and water elements' :
                 params.photoType === 'showing-skin' ? 'artistic tasteful framing' :
                 params.photoType === 'spicy' ? 'seductive elegant framing' :
                 params.photoType === 'very-spicy' ? 'bold intimate framing' :
                 'unlimited creative framing'}`,
    styling: `${photoConfig.clothing.join(' or ')}, ${photoConfig.mood} aesthetic`,
    technical: `High resolution, sharp focus, professional quality${params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', studio-grade equipment recommended' : ''}`,
    sceneSetup: `${photoConfig.settings.join(' or ')}, ${params.photoType} theme environment`
  };
}

function generateTags(params: ContentParameters, photoConfig: PhotoConfig): string[] {
  const baseTags = [params.photoType, params.textTone, params.platform];
  const themeTags = photoConfig.themes.slice(0, 2);
  const customTags = params.style ? [params.style] : [];

  return [...baseTags, ...themeTags, ...customTags];
}
