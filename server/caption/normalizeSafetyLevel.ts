export function normalizeSafetyLevel(level: string): 'normal' | 'low' | 'spicy_safe' | 'needs_review' {
  const lower = level.toLowerCase();
  if (lower === 'high' || lower === 'normal') return 'normal';
  if (lower === 'medium' || lower === 'moderate') return 'low';
  if (lower === 'low' || lower === 'spicy_safe') return 'spicy_safe';
  if (lower === 'needs_review' || lower === 'nsfw') return 'needs_review';
  return 'normal';
}