
export type ToneOptions = {
  style?: string;
  mood?: string;
} & Partial<Record<string, string>>;

export function extractToneOptions(input: Record<string, unknown>): ToneOptions {
  const tone: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      tone[key] = value;
    }
  }

  return tone as ToneOptions;
}
