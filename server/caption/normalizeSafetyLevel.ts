export function normalizeSafetyLevel(level: string): 'safe' | 'low' | 'spicy_safe' | 'explicit' {
  const lower = level.toLowerCase();
  if (lower === 'high' || lower === 'safe') return 'safe';
  if (lower === 'medium' || lower === 'moderate') return 'low';
  if (lower === 'low' || lower === 'suggestive') return 'spicy_safe';
  if (lower === 'explicit' || lower === 'nsfw') return 'explicit';
  return 'safe';
}