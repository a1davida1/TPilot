
export type ToneOptions = {
  style?: string;
  mood?: string;
  extras: Record<string, string>;
};

const RESERVED_KEYS = new Set([
  'style',
  'mood',
  'platform',
  'voice',
  'imageUrl',
  'existingCaption',
  'theme',
  'context',
  'hint',
  'nsfw',
  'facts',
  'doNotDrop',
  'caption',
  'alt',
  'hashtags',
  'cta',
  'safety_level',
  'provider',
  'ranked',
  'final'
]);

export function extractToneOptions(input: Record<string, unknown>): ToneOptions {
  let style: string | undefined;
  let mood: string | undefined;
  const extras: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (key === 'style') {
      style = value;
      continue;
    }

    if (key === 'mood') {
      mood = value;
      continue;
    }

    if (RESERVED_KEYS.has(key)) {
      continue;
    }

    extras[key] = value;
  }

  return { style, mood, extras };
}
