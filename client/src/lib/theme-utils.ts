/**
 * Theme utility functions for ensuring WCAG AA compliance
 */

export const WCAG_AA_RATIO = 4.5;
export const WCAG_AAA_RATIO = 7;

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (1/6 <= h && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (2/6 <= h && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (3/6 <= h && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (4/6 <= h && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (5/6 <= h && h < 1) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Calculate relative luminance of a color
 */
export function getLuminance(r: number, g: number, b: number): number {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
  color1: [number, number, number],
  color2: [number, number, number]
): number {
  const lum1 = getLuminance(color1[0], color1[1], color1[2]);
  const lum2 = getLuminance(color2[0], color2[1], color2[2]);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 */
export function meetsWCAGAA(
  foreground: [number, number, number],
  background: [number, number, number]
): boolean {
  return getContrastRatio(foreground, background) >= WCAG_AA_RATIO;
}

/**
 * Get accessible text color for background
 */
export function getAccessibleTextColor(backgroundColor: [number, number, number]): 'light' | 'dark' {
  const whiteContrast = getContrastRatio([255, 255, 255], backgroundColor);
  const blackContrast = getContrastRatio([0, 0, 0], backgroundColor);
  
  return whiteContrast > blackContrast ? 'light' : 'dark';
}

/**
 * CSS custom property helpers
 */
export function getCSSCustomProperty(property: string): string {
  if (typeof document === 'undefined') return '';
  
  return getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim();
}

export function setCSSCustomProperty(property: string, value: string): void {
  if (typeof document === 'undefined') return;
  
  document.documentElement.style.setProperty(property, value);
}

/**
 * Theme validation helper - Enhanced
 */
export function validateThemeColors(): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  
  // Test comprehensive color combinations
  const tests = [
    // Base surfaces
    { bg: '--background', fg: '--foreground', name: 'background-foreground' },
    { bg: '--card', fg: '--card-foreground', name: 'card-foreground' },
    { bg: '--popover', fg: '--popover-foreground', name: 'popover-foreground' },
    
    // Interactive elements
    { bg: '--primary', fg: '--primary-foreground', name: 'primary-foreground' },
    { bg: '--secondary', fg: '--secondary-foreground', name: 'secondary-foreground' },
    { bg: '--muted', fg: '--muted-foreground', name: 'muted-foreground' },
    
    // State colors
    { bg: '--destructive', fg: '--destructive-foreground', name: 'destructive-foreground' },
    { bg: '--success', fg: '--success-foreground', name: 'success-foreground' },
    { bg: '--warning', fg: '--warning-foreground', name: 'warning-foreground' },
    
    // Accent colors
    { bg: '--accent', fg: '--accent-foreground', name: 'accent-foreground' },
  ];
  
  tests.forEach(test => {
    try {
      const bgValue = getCSSCustomProperty(test.bg);
      const fgValue = getCSSCustomProperty(test.fg);
      
      if (bgValue && fgValue) {
        // Parse HSL values
        const bgHsl = bgValue.split(' ').map(Number);
        const fgHsl = fgValue.split(' ').map(Number);
        
        const bgRgb = hslToRgb(bgHsl[0], bgHsl[1], bgHsl[2]);
        const fgRgb = hslToRgb(fgHsl[0], fgHsl[1], fgHsl[2]);
        
        results[test.name] = meetsWCAGAA(fgRgb, bgRgb);
      } else {
        results[test.name] = false;
      }
    } catch (_error) {
      results[test.name] = false;
    }
  });
  
  return results;
}

/**
 * Enhanced theme utility functions
 */

// Get theme-aware color for dynamic styling
export function getThemeColor(cssVariable: string): string {
  return `hsl(var(${cssVariable}))`;
}

// Get theme-aware color with alpha
export function getThemeColorWithAlpha(cssVariable: string, alpha: number): string {
  return `hsl(var(${cssVariable}) / ${alpha})`;
}

// Generate theme-aware gradient
export function createThemeGradient(colors: string[], direction = '135deg'): string {
  const themeColors = colors.map(color => `hsl(var(${color}))`).join(', ');
  return `linear-gradient(${direction}, ${themeColors})`;
}

// Validate if current theme meets accessibility standards
export function validateCurrentTheme(): { isValid: boolean; failedPairs: string[] } {
  const results = validateThemeColors();
  const failedPairs = Object.entries(results)
    .filter(([, isValid]) => !isValid)
    .map(([pair]) => pair);
  
  return {
    isValid: failedPairs.length === 0,
    failedPairs
  };
}

// Get optimal text color for a background
export function getOptimalTextColor(backgroundColor: string): 'light' | 'dark' {
  try {
    const value = getCSSCustomProperty(backgroundColor);
    if (!value) return 'dark';
    
    const [h, s, l] = value.split(' ').map(Number);
    const rgb = hslToRgb(h, s, l);
    
    return getAccessibleTextColor(rgb);
  } catch {
    return 'dark';
  }
}

// Generate semantic class names with theme awareness
export function generateThemeClasses() {
  return {
    // Surface classes
    surface: 'bg-background text-foreground border-border',
    surfaceElevated: 'bg-card text-card-foreground border-card-border shadow-lg',
    surfaceOverlay: 'bg-popover text-popover-foreground border-border shadow-xl',
    
    // Interactive classes
    interactive: 'hover:bg-hover active:bg-active focus:ring-2 focus:ring-ring transition-colors',
    
    // Text classes  
    textReadable: 'text-foreground font-medium',
    textMuted: 'text-muted-foreground font-medium',
    textEmphasis: 'text-foreground font-semibold',
    
    // Button classes
    buttonPrimary: 'bg-primary text-primary-foreground hover:bg-primary-600 shadow-lg transition-all',
    buttonSecondary: 'bg-secondary text-secondary-foreground hover:bg-hover border border-border transition-all',
    buttonDestructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg transition-all',
    
    // State classes
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    destructive: 'bg-destructive text-destructive-foreground'
  };
}

// Development helper to log theme validation
export function debugThemeValidation() {
  if (typeof window === 'undefined' || !console) return;
  
  const validation = validateCurrentTheme();
  if (validation.isValid) {
    // eslint-disable-next-line no-console
    console.log('✅ Theme validation passed - all color pairs meet WCAG AA standards');
  } else {
    console.warn('⚠️ Theme validation failed for the following pairs:', validation.failedPairs);
    // eslint-disable-next-line no-console
    console.log('Consider adjusting these color combinations for better accessibility');
  }
  
  return validation;
}