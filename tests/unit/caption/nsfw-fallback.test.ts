import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nsfwCaptionFallback } from '../../../server/caption/nsfwFallback.ts';

describe('nsfwCaptionFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns caption tagged as NSFW', async () => {
    const imgBuffer = Buffer.from('test');
    const fetchMock = vi.spyOn(global, 'fetch');

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      arrayBuffer: async () => imgBuffer,
      headers: new Headers({ 'content-type': 'image/jpeg' })
    }) as unknown as Response);

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => [{ label: 'NSFW', score: 0.9 }]
    }) as unknown as Response);

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => [{ generated_text: 'sample caption' }]
    }) as unknown as Response);

    const result = await nsfwCaptionFallback('https://example.com/image.jpg');
    expect(result.nsfw).toBe(true);
    expect(result.caption).toContain('[NSFW] sample caption');
  });
});