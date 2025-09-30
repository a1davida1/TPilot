import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptionItem } from '../schema';
import { z } from 'zod';
import type { GenerativeModel } from '@google/generative-ai';
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
        textModel: null,
        getTextModel: () => textModelMock,
        visionModel: null,
        getVisionModel: () => null,
        isGeminiAvailable: () => true,
      }));

      return { textModelMock };
    }
  },
  {
    label: 'object-based textModel mock',
    applyGeminiMock: () => {
      const generateContent = vi.fn();

      const model = { generateContent } as unknown as GenerativeModel;

      vi.doMock('../../lib/gemini', () => ({
        textModel: model,
        getTextModel: () => model,
        visionModel: null,
        getVisionModel: () => null,
        isGeminiAvailable: () => true,
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

    const extractVariantsFromCall = (callIndex: number) => {
      const callArgs = textModelMock.mock.calls[callIndex]?.[0];
      const promptEntry = Array.isArray(callArgs) ? callArgs[0] : undefined;
      const promptText = promptEntry && typeof promptEntry.text === 'string' ? promptEntry.text : '';
      const serialized = promptText.slice(promptText.lastIndexOf('\n') + 1);
      try {
        return JSON.parse(serialized);
      } catch (error) {
        return [];
      }
    };
    
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


      expect(result.final.caption).toBe('Enjoying the peaceful morning light');
      expect(result.final.hashtags).toEqual(['#morninglight', '#peaceful']);
      expect(textModelMock).toHaveBeenCalledTimes(2);
    });

    it('should handle persistent violations by sanitizing output', async () => {
      // Mock both attempts returning banned content
      const mockBannedResponse = createMockResponse({
        winner_index: 0,
        final: {
          caption: 'Check out this amazing content! ✨',
          alt: 'Banned alt',
          hashtags: ['#content', '#creative'],
          cta: 'Check it out'
        },
        reason: 'Initial pick'
      });

      textModelMock
        .mockResolvedValueOnce(mockBannedResponse)

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

      (textModelMock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCleanResponse);

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
      expect(textModelMock).toHaveBeenCalledTimes(1);
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

      (textModelMock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

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

      (textModelMock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

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

describe.each(scenarios)('Ranking Integration Tests Part 2 ($label)', ({ applyGeminiMock }) => {
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
    const extractVariantsFromCall = (callIndex: number) => {
      const callArgs = textModelMock.mock.calls[callIndex]?.[0];
      const promptEntry = Array.isArray(callArgs) ? callArgs[0] : undefined;
      const promptText = promptEntry && typeof promptEntry.text === 'string' ? promptEntry.text : '';
      const serialized = promptText.slice(promptText.lastIndexOf('\n') + 1);
      try {
        return JSON.parse(serialized);
      } catch (error) {
        return [];
      }
    };

    it('should sanitize output when AI returns banned content', async () => {
      const mockBannedResponse = createMockResponse({
        final: {
          caption: 'Check out this amazing content! ✨',
          alt: 'A photo',
          hashtags: ['#content', '#creative', '#amazing'],
          cta: 'Link in bio for more!'
        },
        reason: 'Selected for engagement'
      });

      const mockCleanResponse = createMockResponse({
        final: {
          caption: 'Enjoying the peaceful morning light',
          alt: 'Person in a sunlit room',
          hashtags: ['#morninglight', '#peaceful'],
          cta: "What's your favorite time of day?"
        },
        reason: 'Clean, engaging content'
      });

      textModelMock
        .mockResolvedValueOnce(mockBannedResponse)
        .mockResolvedValueOnce(mockCleanResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Test caption',
          alt: 'Test alt',
          hashtags: ['#test'],
          cta: 'Test CTA',
          mood: 'engaging',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).toBe('Enjoying the peaceful morning light');
      expect(result.final.caption).not.toMatch(/amazing content/i);
      expect(result.final.caption).not.toContain('✨');
      expect(result.final.cta).not.toContain('Link in bio');
      expect(result.final.hashtags).toEqual(['#morninglight', '#peaceful']);
      expect(textModelMock).toHaveBeenCalledTimes(2);
    });

    it('should handle persistent violations by sanitizing output', async () => {
      const mockBannedResponse = createMockResponse({
        winner_index: 0,
        final: {
          caption: 'Check out this amazing content! ✨',
          alt: 'Banned alt',
          hashtags: ['#content', '#creative'],
          cta: 'Check it out'
        },
        reason: 'Initial pick'
      });

      textModelMock
        .mockResolvedValueOnce(mockBannedResponse)
        .mockResolvedValueOnce(mockBannedResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Clean test caption',
          alt: 'Clean test alt',
          hashtags: ['#photography'],
          cta: 'What do you think?',
          mood: 'engaging',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).not.toContain('✨');
      expect(result.final.caption).not.toMatch(/amazing content/i);
      expect(result.final.cta).toBe('What do you think?');
      expect(result.final.hashtags).toEqual(['#behindthescenes', '#handcrafted', '#maker', '#creator']);
      expect(result.reason).toContain('Sanitized');
    });


    it('should drop sparkle-filler winners before reranking', async () => {
      const mockBannedResponse = createMockResponse({
        winner_index: 0,
        final: {
          caption: 'Check out this amazing content! ✨',
          alt: 'Banned alt',
          hashtags: ['#content', '#creative'],
          cta: 'Check it out'
        },
        reason: 'Initial pick'
      });

      const mockHumanResponse = createMockResponse({
        winner_index: 0,
        final: {
          caption: 'Cozy morning tea with a splash of sunlight',
          alt: 'Warm mug near the window',
          hashtags: ['#morningtea'],
          cta: 'How do you start your day?'
        },
        reason: 'Human alternative'
      });

      textModelMock
        .mockResolvedValueOnce(mockBannedResponse)
        .mockResolvedValueOnce(mockHumanResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Filler sparkle caption',
          alt: 'Sparkle alt',
          hashtags: ['#content'],
          cta: 'Check it out',
          mood: 'excited',
          style: 'flashy',
          safety_level: 'normal',
          nsfw: false
        },
        {
          caption: 'Cozy morning tea with a splash of sunlight',
          alt: 'Warm mug near the window',
          hashtags: ['#morningtea'],
          cta: 'How do you start your day?',
          mood: 'calm',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).toBe('Cozy morning tea with a splash of sunlight');
      expect(result.final.caption).not.toMatch(/Check out this amazing content/i);
      expect(textModelMock).toHaveBeenCalledTimes(2);

      const firstVariants = extractVariantsFromCall(0);
      const secondVariants = extractVariantsFromCall(1);
      expect(firstVariants).toHaveLength(2);
      expect(secondVariants).toHaveLength(1);
      expect(secondVariants[0]?.caption).toBe('Cozy morning tea with a splash of sunlight');
    });

    it('should preserve clean content without modification', async () => {
      const mockCleanResponse = createMockResponse({
        final: {
          caption: 'Enjoying the peaceful morning in my garden',
          alt: 'Person tending to flowers in sunlit garden',
          hashtags: ['#gardening', '#morninglight', '#peaceful'],
          cta: "What's your favorite flower?"
        },
        reason: 'Clean, authentic content'
      });

      textModelMock.mockResolvedValueOnce(mockCleanResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Test caption',
          alt: 'Test alt',
          hashtags: ['#test'],
          cta: 'Test CTA',
          mood: 'engaging',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];


      const result = await rankAndSelect(variants, { platform: 'instagram' });

      expect(result.final.caption).toBe('Enjoying the peaceful morning in my garden');
      expect(result.final.cta).toBe("What's your favorite flower?");
      expect(result.final.hashtags).toEqual(['#gardening', '#morninglight', '#peaceful']);
      expect(result.reason).toBe('Clean, authentic content');
      expect(textModelMock).toHaveBeenCalledTimes(1);
    });

    it('should apply platform-specific hashtag limits', async () => {
      const mockResponse = createMockResponse({
        final: {
          caption: 'Clean content',
          alt: 'Clean alt',
          hashtags: ['#one', '#two', '#three', '#four', '#five'],
          cta: 'What do you think?'
        },
        reason: 'Good content'
      });

      textModelMock.mockResolvedValueOnce(mockResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Test caption',
          alt: 'Test alt',
          hashtags: ['#test'],
          cta: 'Test CTA',
          mood: 'engaging',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'x' });

      expect(result.final.hashtags).toHaveLength(2);
    });

    it('should provide empty hashtags for Reddit platform', async () => {
      const mockResponse = createMockResponse({
        final: {
          caption: 'Clean content',
          alt: 'Clean alt',
          hashtags: ['#test', '#reddit'],
          cta: 'What do you think?'
        },
        reason: 'Good content'
      });

      textModelMock.mockResolvedValueOnce(mockResponse);

      const variants: CaptionItemType[] = [
        {
          caption: 'Test caption',
          alt: 'Test alt',
          hashtags: ['#test'],
          cta: 'Test CTA',
          mood: 'engaging',
          style: 'authentic',
          safety_level: 'normal',
          nsfw: false
        }
      ];

      const result = await rankAndSelect(variants, { platform: 'reddit' });

      expect(result.final.hashtags).toEqual([]);
    });
  });
});

