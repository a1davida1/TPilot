import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankAndSelect } from '../geminiPipeline';
import { RankResult } from '../schema';
import { CaptionItem } from '../schema';
import { z } from 'zod';
type CaptionItemType = z.infer<typeof CaptionItem>;
type GeminiContent = Array<{ text: string }>;
type TextModelMock = ReturnType<typeof vi.fn>;

const createMockResponse = (payload: unknown) => ({
  response: {
    text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload))
  }
});

type ScenarioConfig = {
  label: string;
  applyGeminiMock: () => { textModelMock: TextModelMock };
};

const scenarios: ScenarioConfig[] = [
  {
    label: 'function-based textModel mock',
    applyGeminiMock: () => {
      const textModelMock = vi.fn();

      vi.doMock('../../lib/gemini', () => ({
        textModel: textModelMock
      }));

      return { textModelMock };
    }
  },
  {
    label: 'object-based textModel mock',
    applyGeminiMock: () => {
      const generateContent = vi.fn();

      vi.doMock('../../lib/gemini', () => ({
        textModel: { generateContent }
      }));

      return { textModelMock: generateContent };
    }
  }
];

describe.each(scenarios)('Ranking Integration Tests ($label)', ({ applyGeminiMock }) => {
  let rankAndSelect: (typeof import('../geminiPipeline'))['rankAndSelect'];
  let textModelMock: TextModelMock;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../lib/prompts', () => ({
      load: vi.fn().mockImplementation((filename: string) => {
        if (filename === 'system.txt') return Promise.resolve('System prompt');
        if (filename === 'guard.txt') return Promise.resolve('Guard prompt');
        if (filename === 'rank.txt') return Promise.resolve('Ranking prompt with violation detection');
        return Promise.resolve('Mock prompt');
      })
    }));

    const { textModelMock: appliedMock } = applyGeminiMock();
    textModelMock = appliedMock;

    ({ rankAndSelect } = await import('../geminiPipeline'));
  });

  describe('rankAndSelect', () => {
    it('should sanitize output when AI returns banned content', async () => {
      // Mock AI returning banned content
      const mockBannedResponse = createMockResponse({
        final: {
          caption: 'Check out this amazing content! ✨',
          alt: 'A photo',
          hashtags: ['#content', '#creative', '#amazing'],
          cta: 'Link in bio for more!'
        },
        reason: 'Selected for engagement'
      });

      // Mock successful rerank attempt with clean content
      const mockCleanResponse = createMockResponse({
        final: {
          caption: 'Enjoying the peaceful morning light',
          alt: 'Person in a sunlit room',
          hashtags: ['#morninglight', '#peaceful'],
          cta: 'What\'s your favorite time of day?'
        },
        reason: 'Clean, engaging content'
      });

      textModelMock
        .mockResolvedValueOnce(mockBannedResponse)
        .mockResolvedValueOnce(mockCleanResponse);

      const variants: CaptionItemType[] = [
        {
          caption: "Test caption",
          alt: "Test alt",
          hashtags: ["#test"],
          cta: "Test CTA",
          mood: "engaging",
          style: "authentic",
          safety_level: "normal",
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).not.toContain('✨');
      expect(result.final.caption).not.toContain('amazing content');
      expect(result.final.cta).not.toContain('Link in bio');
      expect(result.final.hashtags).not.toContain('#content');
      expect(result.final.hashtags).not.toContain('#creative');
      
      // Should have called textModel twice (initial + rerank)
      expect(textModel).toHaveBeenCalledTimes(2);
    });

    it('should sanitize final output when rerank also fails', async () => {
      // Mock both attempts returning banned content
      const mockBannedResponse = JSON.stringify({
        final: {
          caption: "✨ Amazing content! Check it out! ✨",
          alt: "A photo",
          hashtags: ["#content", "#viral"],
          cta: "Link in bio!"
        },
        reason: "Engaging content"
      });

      (textModel as any)
        .mockResolvedValueOnce(mockBannedResponse)  // First attempt
        .mockResolvedValueOnce(mockBannedResponse); // Rerank also fails

      const variants: CaptionItemType[] = [
        {
          caption: "Clean test caption",
          alt: "Clean test alt",
          hashtags: ["#photography"],
          cta: "What do you think?",
          mood: "engaging",
          style: "authentic",
          safety_level: "normal",
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      // Should be sanitized
      expect(result.final.caption).not.toContain('✨');
      expect(result.final.caption).not.toContain('Amazing content');
      expect(result.final.cta).toBe("What do you think?");
      expect(result.final.hashtags).toEqual(["#behindthescenes", "#handcrafted", "#maker", "#creator"]);
      expect(result.reason).toContain('Sanitized');
    });

    it('should preserve clean content without modification', async () => {
      const mockCleanResponse = JSON.stringify({
        final: {
          caption: "Enjoying the peaceful morning in my garden",
          alt: "Person tending to flowers in sunlit garden",
          hashtags: ["#gardening", "#morninglight", "#peaceful"],
          cta: "What's your favorite flower?"
        },
        reason: "Clean, authentic content"
      });

      (textModel as any).mockResolvedValueOnce(mockCleanResponse);

      const variants: CaptionItemType[] = [
        {
          caption: "Test caption",
          alt: "Test alt", 
          hashtags: ["#test"],
          cta: "Test CTA",
          mood: "engaging",
          style: "authentic",
          safety_level: "normal",
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).toBe("Enjoying the peaceful morning in my garden");
      expect(result.final.cta).toBe("What's your favorite flower?");
      expect(result.final.hashtags).toEqual(["#gardening", "#morninglight", "#peaceful"]);
      expect(result.reason).toBe("Clean, authentic content");
      
      // Should only call textModel once
      expect(textModel).toHaveBeenCalledTimes(1);
    });

    it('should apply platform-specific hashtag limits', async () => {
      const mockResponse = JSON.stringify({
        final: {
          caption: "Clean content",
          alt: "Clean alt",
          hashtags: ["#one", "#two", "#three", "#four", "#five"], // Too many for X
          cta: "What do you think?"
        },
        reason: "Good content"
      });

      (textModel as any).mockResolvedValueOnce(mockResponse);

      const variants: CaptionItemType[] = [
        {
          caption: "Test caption",
          alt: "Test alt",
          hashtags: ["#test"],
          cta: "Test CTA",
          mood: "engaging",
          style: "authentic",
          safety_level: "normal",
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'x' });

      expect(result.final.hashtags).toHaveLength(2); // X platform limit
    });

    it('should provide empty hashtags for Reddit platform', async () => {
      const mockResponse = JSON.stringify({
        final: {
          caption: "Clean content",
          alt: "Clean alt",
          hashtags: ["#test", "#reddit"],
          cta: "What do you think?"
        },
        reason: "Good content"
      });

      (textModel as any).mockResolvedValueOnce(mockResponse);

      const variants: CaptionItemType[] = [
        {
          caption: "Test caption", 
          alt: "Test alt",
          hashtags: ["#test"],
          cta: "Test CTA",
          mood: "engaging",
          style: "authentic",
          safety_level: "normal",
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'reddit' });

      expect(result.final.hashtags).toEqual([]); // Reddit gets no hashtags
    });
  });
});