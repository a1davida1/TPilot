/**
 * Normalize safety level to valid enum values
 */
export type SafetyLevel = 'safe' | 'normal' | 'moderate' | 'high' | 'unknown';

export function normalizeSafetyLevel(value: string | null | undefined): SafetyLevel {
  if (!value) return 'normal';

  const lowered = value.toLowerCase().trim();

  // Handle various safety level formats
  if (lowered === 'safe' || lowered === 'low') return 'safe';
  if (lowered === 'normal' || lowered === 'medium') return 'normal';
  if (lowered === 'moderate') return 'moderate';
  if (lowered === 'high' || lowered === 'very_high') return 'high';
  if (lowered === 'unknown') return 'unknown';

  // Handle partial matches
  if (lowered.includes('safe') || lowered.includes('low')) return 'safe';
  if (lowered.includes('normal') || lowered.includes('medium')) return 'normal';
  if (lowered.includes('moderate')) return 'moderate';
  if (lowered.includes('high')) return 'high';

  // Default fallback
  return 'normal';
}