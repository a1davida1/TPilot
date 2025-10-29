/**
 * Shared Design Tokens
 * Apple-inspired design system with consistent spacing, typography, and animations
 */

// Spacing Scale (4px base unit)
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px - element spacing
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px - card padding
  8: '2rem',     // 32px - section spacing
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
} as const;

// Typography Scale (Apple-inspired, using 17px body text)
export const typography = {
  display: {
    fontSize: '4.5rem',      // 72px
    lineHeight: '5rem',      // 80px
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  h1: {
    fontSize: '3rem',        // 48px
    lineHeight: '3.5rem',    // 56px
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontSize: '2.25rem',     // 36px
    lineHeight: '2.75rem',   // 44px
    fontWeight: 600,
  },
  h3: {
    fontSize: '1.5rem',      // 24px
    lineHeight: '2rem',      // 32px
    fontWeight: 600,
  },
  body: {
    fontSize: '1.0625rem',   // 17px (Apple standard)
    lineHeight: '1.5rem',    // 24px
    fontWeight: 400,
  },
  caption: {
    fontSize: '0.8125rem',   // 13px
    lineHeight: '1.125rem',  // 18px
    fontWeight: 400,
  },
  label: {
    fontSize: '0.9375rem',   // 15px
    lineHeight: '1.25rem',   // 20px
    fontWeight: 500,
  },
} as const;

// Border Radius Scale
export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',  // Pill shape
} as const;

// Animation Tokens (Spring physics for Apple-like feel)
export const animation = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    // Spring physics (Apple-style)
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    // Smooth ease
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Ease in/out
    inOut: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
} as const;

// Shadow Scale
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
} as const;

// Z-Index Scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;

// Breakpoints (mobile-first)
export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
} as const;
