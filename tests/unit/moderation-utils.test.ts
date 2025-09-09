import { describe, it, expect, vi } from 'vitest';

describe('moderation utils', () => {
  it('calculates similarity between content and posts', async () => {
    const { calculateSimilarity } = await import('../../moderation/moderation-utils');
    const content = 'hello world test';
    const posts = ['hello there', 'world peace', 'completely different'];
    const similarity = calculateSimilarity(content, posts);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('returns zero similarity for empty posts', async () => {
    const { calculateSimilarity } = await import('../../moderation/moderation-utils');
    const content = 'hello world';
    const posts: string[] = [];
    const similarity = calculateSimilarity(content, posts);
    expect(similarity).toBe(0);
  });

  it('calls ml safety service', async () => {
    global.fetch = vi.fn().mockResolvedValue({ 
      ok: true, 
      json: () => Promise.resolve({ nsfw: 0.1 }) 
    });
    const { mlSafetyCheck } = await import('../../moderation/moderation-utils');
    const result = await mlSafetyCheck('content');
    expect(fetch).toHaveBeenCalled();
    expect(result.nsfw).toBe(0.1);
  });

  it('throws error when ml safety service fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { mlSafetyCheck } = await import('../../moderation/moderation-utils');
    await expect(mlSafetyCheck('content')).rejects.toThrow('Network error');
  });
});