import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAccessibleTextColor,
  getContrastRatio,
  hslToRgb,
  meetsWCAGAA,
  setCSSCustomProperty,
  validateThemeColors,
} from '../client/src/lib/theme-utils';

describe('theme system accessibility', () => {
  const themeVariables = new Map<string, string>();
  const setPropertySpy = vi.fn();

  beforeEach(() => {
    themeVariables.clear();
    themeVariables.set('--background', '0 0 0');
    themeVariables.set('--foreground', '0 0 100');
    themeVariables.set('--card', '0 0 10');
    themeVariables.set('--card-foreground', '0 0 100');
    themeVariables.set('--primary', '260 80 35');
    themeVariables.set('--primary-foreground', '0 0 100');
    themeVariables.set('--secondary', '210 80 25');
    themeVariables.set('--secondary-foreground', '0 0 100');
    themeVariables.set('--muted', '180 10 35');
    themeVariables.set('--muted-foreground', '0 0 95');

    const mockDocumentElement = {
      style: {
        setProperty: setPropertySpy,
      },
    } as unknown as HTMLElement;

    const computedStyle: Partial<CSSStyleDeclaration> = {
      getPropertyValue: (property: string) => themeVariables.get(property) ?? '',
    };

    vi.stubGlobal('document', {
      documentElement: mockDocumentElement,
    } as unknown as Document);

    vi.stubGlobal(
      'getComputedStyle',
      vi.fn(() => computedStyle as CSSStyleDeclaration),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setPropertySpy.mockClear();
  });

  it('converts HSL values to RGB triplets', () => {
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255]);
    expect(hslToRgb(120, 60, 50)).toEqual([102, 204, 102]);
  });

  it('computes sufficient contrast ratios for accessible color pairs', () => {
    const darkBackground = hslToRgb(0, 0, 0);
    const lightForeground = hslToRgb(0, 0, 100);

    const contrastRatio = getContrastRatio(lightForeground, darkBackground);

    expect(contrastRatio).toBeGreaterThanOrEqual(7);
    expect(meetsWCAGAA(lightForeground, darkBackground)).toBe(true);
  });

  it('validates that configured theme tokens meet WCAG AA', () => {
    const results = validateThemeColors();

    expect(results).toMatchObject({
      'background-foreground': true,
      'card-foreground': true,
      'primary-foreground': true,
      'secondary-foreground': true,
      'muted-foreground': true,
    });
  });

  it('marks combinations with missing tokens as inaccessible', () => {
    themeVariables.delete('--muted-foreground');

    const results = validateThemeColors();

    expect(results['muted-foreground']).toBe(false);
  });

  it('sets CSS custom properties on the document element', () => {
    setCSSCustomProperty('--background', '0 0 0');

    expect(setPropertySpy).toHaveBeenCalledWith('--background', '0 0 0');
  });
});