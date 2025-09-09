import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pipeline } from '../../server/caption/geminiPipeline.js';
import { pipelineRewrite } from '../../server/caption/rewritePipeline.js';
import { pipelineTextOnly } from '../../server/caption/textOnlyPipeline.js';

// Mock dependencies
vi.mock('../../server/lib/gemini.js', () => ({
  textModel: {
    generateContent: vi.fn(),
  },
  visionModel: {
    generateContent: vi.fn(),
  },
}));

vi.mock('../../server/storage.js', () => ({
  storage: {
    getUserById: vi.fn(),
    createContentGeneration: vi.fn(),
    updateContentGeneration: vi.fn(),
  },
}));

describe('Caption Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gemini Pipeline', () => {
    it('should handle image-based caption generation', async () => {
      const mockImageUrl = 'data:image/jpeg;base64,abc123';
      const mockPlatform = 'instagram';
      const mockVoice = 'flirty_playful';

      // Mock successful responses
      const mockFactsResponse = {
        response: {
          text: () => JSON.stringify({
            objects: ['woman', 'lingerie'],
            setting: 'bedroom',
            mood: 'seductive',
          }),
        },
      };

      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify([
            {
              caption: 'Feeling gorgeous tonight ✨',
              hashtags: ['#lingerie', '#confidence'],
              safety_level: 'spicy_safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'What do you think?',
            },
          ]),
        },
      };

      const mockRankResponse = {
        response: {
          text: () => JSON.stringify({
            final: {
              caption: 'Feeling gorgeous tonight ✨',
              hashtags: ['#lingerie', '#confidence'],
              safety_level: 'spicy_safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'What do you think?',
            },
          }),
        },
      };

      const { textModel, visionModel } = await import('../../server/lib/gemini.js');
      visionModel.generateContent.mockResolvedValueOnce(mockFactsResponse);
      textModel.generateContent
        .mockResolvedValueOnce(mockVariantsResponse)
        .mockResolvedValueOnce(mockRankResponse);

      const result = await pipeline({
        imageUrl: mockImageUrl,
        platform: mockPlatform,
        voice: mockVoice,
      });

      expect(result.final).toMatchObject({
        caption: expect.any(String),
        safety_level: expect.stringMatching(/safe|low|spicy_safe/),
      });
    });

    it('should handle safety level normalization', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify([
            {
              caption: 'Test caption',
              hashtags: ['#test'],
              safety_level: 'suggestive', // Should be normalized to spicy_safe
              mood: 'confident',
              style: 'authentic',
              cta: 'Check it out',
            },
          ]),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      textModel.generateContent.mockResolvedValue(mockResponse);

      // This would normally be called as part of the pipeline
      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const result = await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['test'] },
      });

      expect(result[0].safety_level).toBe('spicy_safe');
    });
  });

  describe('Text-Only Pipeline', () => {
    it('should generate content without image context', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify([
            {
              caption: 'Motivational content for today!',
              hashtags: ['#motivation', '#mindset'],
              safety_level: 'normal',
              mood: 'inspiring',
              style: 'authentic',
              cta: 'What motivates you?',
            },
          ]),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      textModel.generateContent.mockResolvedValue(mockResponse);

      const result = await pipelineTextOnly({
        platform: 'instagram',
        voice: 'inspiring',
        theme: 'motivation',
        context: 'morning motivation post',
      });

      expect(result.final).toMatchObject({
        caption: expect.stringContaining('Motivational'),
        safety_level: 'normal',
      });
    });
  });

  describe('Rewrite Pipeline', () => {
    it('should improve existing captions', async () => {
      const existingCaption = 'Basic caption here';
      const mockResponse = {
        response: {
          text: () => JSON.stringify([
            {
              caption: 'Enhanced and engaging caption! ✨',
              hashtags: ['#enhanced', '#content'],
              safety_level: 'normal',
              mood: 'engaging',
              style: 'authentic',
              cta: 'What do you think?',
            },
          ]),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const genSpy = vi.spyOn(textModel, 'generateContent').mockResolvedValue(mockResponse);

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      expect(result.final.caption).not.toBe(existingCaption);
      expect(result.final.caption).toContain('Enhanced');

      genSpy.mockRestore();
    });
  });
});