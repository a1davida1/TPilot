import { describe, expect, it } from 'vitest';

import { toOpenAIImageUrl, validateImageUrl } from '../lib/images';

describe('toOpenAIImageUrl', () => {
  it('normalizes URL-safe base64 payloads into standard data URLs', () => {
    const urlSafeBase64 = 'YWJj-WRlZg__';

    const result = toOpenAIImageUrl(urlSafeBase64, 'image/png');

    expect(result.startsWith('data:image/png;base64,')).toBe(true);
    const encoded = result.split(',')[1];
    expect(encoded).toBe('YWJj+WRlZg//');
    expect(encoded).not.toMatch(/[-_]/);
  });
});

describe('validateImageUrl', () => {
  it('rejects data URLs with clearly insufficient payload length', () => {
    const invalidDataUrl = 'data:image/png;base64,short';

    expect(validateImageUrl(invalidDataUrl)).toBe(false);
  });
});
