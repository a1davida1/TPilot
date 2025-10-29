/**
 * Haptic Feedback Utilities
 * Provides haptic feedback on mobile devices (if supported)
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (!isHapticSupported()) return;

  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 100, 20],
    error: [30, 100, 30, 100, 30],
  };

  const pattern = patterns[type];
  
  if (Array.isArray(pattern)) {
    navigator.vibrate(pattern);
  } else {
    navigator.vibrate(pattern);
  }
}

/**
 * React hook for haptic feedback
 */
export function useHaptic() {
  const supported = isHapticSupported();

  return {
    supported,
    trigger: triggerHaptic,
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    success: () => triggerHaptic('success'),
    warning: () => triggerHaptic('warning'),
    error: () => triggerHaptic('error'),
  };
}
