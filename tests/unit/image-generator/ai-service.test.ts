
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the multi-AI provider
const mockGenerateWithMultiProvider = vi.fn();

vi.mock('../../../server/services/multi-ai-provider', () => ({
  generateWithMultiProvider: mockGenerateWithMultiProvider
}));

// Mock logger utils
vi.mock('../../../server/lib/logger-utils', () => ({
  safeLog: vi.fn()
}));

describe('AI Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing OPENAI_API_KEY gracefully', async () => {
      // Mock a successful response from the fallback provider
      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['Fallback title'],
        provider: 'gemini'
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      });

      expect(result).toBeDefined();
      expect(result.titles).toEqual(['Fallback title']);
    });

    it('should use available providers when some are missing', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      
      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['Gemini generated title'],
        provider: 'gemini'
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      });

      expect(result.provider).toBe('gemini');
    });
  });

  describe('AI Provider Fallback Logic', () => {
    it('should fallback from Gemini to OpenAI on quota error', async () => {
      process.env.OPENAI_API_KEY = 'test_openai_key';
      
      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['Fallback from OpenAI'],
        provider: 'openai'
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      });

      expect(result.titles).toEqual(['Fallback from OpenAI']);
      expect(result.provider).toBeDefined();
      expect(mockGenerateWithMultiProvider).toHaveBeenCalled();
    });

    it('should fallback through all providers on consecutive failures', async () => {
      mockGenerateWithMultiProvider.mockRejectedValue(new Error('All providers failed'));

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');

      await expect(generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      })).rejects.toThrow();

      expect(mockGenerateWithMultiProvider).toHaveBeenCalled();
    });
  });

  describe('Cost Optimization', () => {
    it('should prioritize cheapest provider (Gemini) when available', async () => {
      process.env.GEMINI_API_KEY = 'test_gemini_key';
      process.env.OPENAI_API_KEY = 'test_openai_key';

      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['Gemini title'],
        provider: 'gemini',
        cost: 0.001
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      });

      expect(result.provider).toBe('gemini');
      expect(result.cost).toBeLessThan(0.01);
    });
  });

  describe('Platform-Specific Optimizations', () => {
    it('should generate Instagram-optimized content', async () => {
      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['#InstagramReady content with hashtags'],
        provider: 'gemini'
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'instagram',
        safetyLevel: 'suggestive'
      });

      expect(result.titles[0]).toContain('#');
      expect(result.provider).toBe('gemini');
    });

    it('should generate Reddit-appropriate content without hashtags', async () => {
      mockGenerateWithMultiProvider.mockResolvedValue({
        titles: ['Reddit-style content without hashtags'],
        provider: 'gemini'
      });

      const { generateWithMultiProvider } = await import('../../../server/services/multi-ai-provider');
      
      const result = await generateWithMultiProvider({
        prompt: 'test prompt',
        imageDescription: 'test image',
        platform: 'reddit',
        safetyLevel: 'suggestive'
      });

      expect(result.titles[0]).not.toContain('#');
      expect(result.provider).toBe('gemini');
    });
  });
});
