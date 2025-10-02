import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FallbackParams } from '../../../server/caption/openaiFallback.ts';
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
      headers: new Headers({ 'content-type': 'image/jpeg' }),
    }) as unknown as Response);

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => [{ label: 'NSFW', score: 0.9 }],
      headers: new Headers({ 'content-type': 'application/json' }),
    }) as unknown as Response);

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => [{ generated_text: 'sample caption' }],
      headers: new Headers({ 'content-type': 'application/json' }),
    }) as unknown as Response);

    const result = await nsfwCaptionFallback('https://example.com/image.jpg');
    expect(result.nsfw).toBe(true);
    expect(result.caption).toContain('[NSFW] sample caption');
  });

  it('treats image as SFW when detection API exhausts retries with 500 errors', async () => {
    vi.useFakeTimers();
    try {
      const imgBuffer = Buffer.from('test');
      const fetchMock = vi.spyOn(global, 'fetch');

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ generated_text: 'sample caption' }],
        headers: new Headers({ 'content-type': 'application/json' }),
      }) as unknown as Response);

      const promise = nsfwCaptionFallback('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.nsfw).toBe(false);
      expect(result.caption).toBe('sample caption');
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats image as SFW when detection API exhausts retries with 429 errors', async () => {
    vi.useFakeTimers();
    try {
      const imgBuffer = Buffer.from('test');
      const fetchMock = vi.spyOn(global, 'fetch');

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 429,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 429,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 429,
        headers: new Headers({}),
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ generated_text: 'sample caption' }],
        headers: new Headers({ 'content-type': 'application/json' }),
      }) as unknown as Response);

      const promise = nsfwCaptionFallback('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.nsfw).toBe(false);
      expect(result.caption).toBe('sample caption');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates NSFW flag through OpenAI fallback variants', async () => {
    const { openAICaptionFallback } = await import('../../../server/caption/openaiFallback.ts');

    const variants = await openAICaptionFallback({ platform: 'instagram', nsfw: true });

    expect(variants).toHaveLength(5);
    for (const variant of variants) {
      expect(variant.nsfw).toBe(true);
    }
  });

  it('ensures pipeline fallback preserves NSFW metadata and labeling', async () => {
    vi.resetModules();

    const fallbackCalls: FallbackParams[] = [];

    vi.doMock('../../../server/lib/gemini.ts', () => ({
      __esModule: true,
      getVisionModel: vi.fn(),
      getTextModel: vi.fn(),
      isGeminiAvailable: () => false,
    }));

    vi.doMock('../../../server/caption/openaiFallback.ts', async () => {
      const actual = await vi.importActual<typeof import('../../../server/caption/openaiFallback.ts')>(
        '../../../server/caption/openaiFallback.ts'
      );
      return {
        __esModule: true,
        ...actual,
        openAICaptionFallback: vi.fn(async (params: FallbackParams) => {
          fallbackCalls.push(params);
          return actual.openAICaptionFallback(params);
        }),
      };
    });

    const { pipeline } = await import('../../../server/caption/geminiPipeline.ts');

    const result = await pipeline({
      imageUrl: 'https://example.com/test.jpg',
      platform: 'instagram',
      voice: 'confident',
      nsfw: true,
    });

    expect(fallbackCalls).toHaveLength(1);
    expect(fallbackCalls[0].nsfw).toBe(true);
    expect(result.variants?.every(variant => variant.nsfw)).toBe(true);
    expect(result.final.nsfw).toBe(true);

    vi.resetModules();
  });

  it('retries NSFW detection on transient failures', async () => {
    vi.useFakeTimers();
    try {
      const imgBuffer = Buffer.from('retry');
      const fetchMock = vi.spyOn(global, 'fetch');

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => imgBuffer,
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ label: 'NSFW', score: 0.95 }],
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ generated_text: 'retry caption' }],
      }) as unknown as Response);

      const promise = nsfwCaptionFallback('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.nsfw).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries caption generation before succeeding', async () => {
    vi.useFakeTimers();
    try {
      const imgBuffer = Buffer.from('caption');
      const fetchMock = vi.spyOn(global, 'fetch');

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => imgBuffer,
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ label: 'SFW', score: 0.1 }],
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ generated_text: 'final caption' }],
      }) as unknown as Response);

      const promise = nsfwCaptionFallback('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.caption).toBe('final caption');
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws after exhausting caption retries', async () => {
    vi.useFakeTimers();
    try {
      const imgBuffer = Buffer.from('caption');
      const fetchMock = vi.spyOn(global, 'fetch');

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => imgBuffer,
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => [{ label: 'SFW', score: 0.1 }],
      }) as unknown as Response);

      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);
      fetchMock.mockImplementationOnce(async () => ({ ok: false }) as Response);

      const promise = nsfwCaptionFallback('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('caption request failed');
      expect(fetchMock).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
});
