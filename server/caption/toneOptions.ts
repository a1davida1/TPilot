
export type ToneOptions = {
  style?: string;
  mood?: string;
} & Partial<Record<string, string>>;

export function extractToneOptions(input: Record<string, unknown>): ToneOptions {
  const tone: ToneOptions = {};

  const styleValue = input['style'];
  if (typeof styleValue === 'string') {
    tone.style = styleValue;
  }

  const moodValue = input['mood'];
  if (typeof moodValue === 'string') {
    tone.mood = moodValue;
  }

  return tone;
}
