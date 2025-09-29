import { describe, expect, it } from 'vitest';
import { getProtectionPreview, protectionPresets } from '../../../client/src/lib/image-protection';

describe('image protection presets', () => {
  it('exposes presets for each protection level', () => {
    expect(Object.keys(protectionPresets)).toEqual(['light', 'standard', 'heavy']);

    Object.values(protectionPresets).forEach(preset => {
      const { blur, quality, resize } = preset;
      expect(quality ?? 0).toBeGreaterThan(0);
      expect(blur ?? 0).toBeGreaterThan(0);
      expect(resize ?? 0).toBeLessThanOrEqual(100);
    });
  });

  it('formats readable previews for UI display', () => {
    const preview = getProtectionPreview('standard');

    expect(preview).toContain('Blur: 1');
    expect(preview).toContain('Noise: 10%');
    expect(preview).toContain('Quality: 88%');
  });
});