import { describe, expect, it } from 'vitest';

import { toOpenAIImageUrl, validateImageUrl } from '../lib/images';

describe('toOpenAIImageUrl', () => {
  it('normalizes url-safe base64 payloads into standard data URLs', () => {
    const rawBytes = Buffer.from([0xfb, 0xef, 0xfe, 0x7f, 0x40]);
    const urlSafe = rawBytes.toString('base64url');

    const result = toOpenAIImageUrl(urlSafe, 'image/png');

    expect(result.startsWith('data:image/png;base64,')).toBe(true);
    const [, base64Payload] = result.split(',', 2);
    const expectedPayload = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
    expect(base64Payload).toBe(expectedPayload);
  });

  it('cleans url-safe characters within existing data URLs', () => {
    const dirtyDataUrl = 'data:image/jpeg;base64,--__\n';

    const result = toOpenAIImageUrl(dirtyDataUrl);

    expect(result).toBe('data:image/jpeg;base64,++//');
  });
});

describe('validateImageUrl', () => {
  it('rejects obviously short base64 payloads', () => {
    expect(validateImageUrl('data:image/jpeg;base64,abcd')).toBe(false);
  });
});
