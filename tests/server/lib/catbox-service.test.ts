import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatboxService } from '../../../server/lib/catbox-service.ts';

const originalFetch = globalThis.fetch;

describe('CatboxService.upload', () => {
  const fileBuffer = Buffer.from('sample-image-bytes');

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('rejects invalid userhash format before calling Catbox', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await CatboxService.upload({
      reqtype: 'fileupload',
      userhash: 'invalid',
      file: fileBuffer,
      filename: 'invalid-userhash.jpg',
      mimeType: 'image/jpeg'
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('user hash');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retries transient network failures and eventually succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    fetchSpy.mockResolvedValueOnce(new globalThis.Response('https://files.catbox.moe/test.png', { status: 200 }));

    const result = await CatboxService.upload({
      reqtype: 'fileupload',
      file: fileBuffer,
      filename: 'retry-success.png',
      mimeType: 'image/png'
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://files.catbox.moe/test.png');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to Litterbox when Catbox returns 412', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(
      new globalThis.Response('You must provide a userhash', { status: 412, statusText: 'Precondition Failed' })
    );
    fetchSpy.mockResolvedValueOnce(
      new globalThis.Response('https://litter.catbox.moe/temp.png', { status: 200, statusText: 'OK' })
    );

    const result = await CatboxService.upload({
      reqtype: 'fileupload',
      file: fileBuffer,
      filename: 'fallback.png',
      mimeType: 'image/png'
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://litter.catbox.moe/temp.png');
  });
});
