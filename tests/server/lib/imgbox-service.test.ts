import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImgboxService } from '../../../server/lib/imgbox-service.ts';

const originalFetch = globalThis.fetch;

describe('ImgboxService.upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('uploads image buffers successfully', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(
      new globalThis.Response("<script>var token = 'abc123';</script>", {
        status: 200,
        headers: {
          'set-cookie': 'imgbox_session=xyz; Path=/; HttpOnly'
        }
      })
    );

    fetchSpy.mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({
          success: true,
          files: [
            {
              id: '123',
              title: 'example.jpg',
              original_url: 'https://images.imgbox.com/aa/bb/example.jpg',
              thumbnail_url: 'https://thumbs.imgbox.com/aa/bb/example.jpg'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const result = await ImgboxService.upload({
      buffer: Buffer.from('test-bytes'),
      filename: 'example.jpg',
      contentType: 'image/jpeg'
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://images.imgbox.com/aa/bb/example.jpg');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects empty buffers before attempting upload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await ImgboxService.upload({
      buffer: Buffer.alloc(0),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No file');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
