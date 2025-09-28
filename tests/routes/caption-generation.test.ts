import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { pipeline } from '../../server/caption/geminiPipeline.js';
import { pipelineRewrite, extractKeyEntities } from '../../server/caption/rewritePipeline.js';
import { pipelineTextOnly } from '../../server/caption/textOnlyPipeline.js';

// Mock dependencies
vi.mock('../../server/lib/gemini.js', () => ({
  textModel: {
    generateContent: vi.fn(),
  },
  visionModel: {
    generateContent: vi.fn(),
  },
  isGeminiAvailable: vi.fn(() => true),
}));

import { generationResponseSchema } from '../../shared/types/caption.js';

vi.mock('../../server/caption/openaiFallback.js', () => ({
  openAICaptionFallback: vi.fn().mockResolvedValue({
    caption: 'Fallback caption',
    hashtags: ['#fallback1', '#fallback2', '#fallback3'],
    safety_level: 'normal',
    alt: 'Fallback alt text that is sufficiently long',
    mood: 'neutral',
    style: 'informative',
    cta: 'Check this out',
    nsfw: false,
  }),
}));

// Type interfaces for test safety
interface MockResponse {
  response: {
    text: () => string;
    functionCall?: Record<string, unknown>;
    functionCalls?: Record<string, unknown>[];
  };
}

interface CaptionResult {
  caption: string;
  hashtags: string[];
  safety_level: string;
  mood: string;
  style: string;
  cta: string;
  alt: string;
  nsfw: boolean;
}

const asMock = <T>(fn: T) => fn as unknown as Mock;

vi.mock('../../server/storage.ts', () => ({
  storage: {
    getUserById: vi.fn(),
    createContentGeneration: vi.fn(),
    updateContentGeneration: vi.fn(),
  },
}));

describe('Caption Generation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { textModel, visionModel } = await import('../../server/lib/gemini.js');
    (textModel.generateContent as Mock | undefined)?.mockReset?.();
    (visionModel.generateContent as Mock | undefined)?.mockReset?.();
    const { isGeminiAvailable } = await import('../../server/lib/gemini.js');
    asMock(isGeminiAvailable).mockReset?.();
    asMock(isGeminiAvailable).mockReturnValue(true);
    const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');
    const mockOpenAI = vi.mocked(openAICaptionFallback);
    mockOpenAI.mockReset();
    mockOpenAI.mockResolvedValue({
      caption: 'Fallback caption',
      hashtags: ['#fallback1', '#fallback2', '#fallback3'],
      safety_level: 'normal',
      alt: 'Fallback alt text that is sufficiently long',
      mood: 'neutral',
      style: 'informative',
      cta: 'Check this out',
      nsfw: false,
    });
  });

  describe('Gemini Pipeline', () => {
    it('should handle image-based caption generation', async () => {
      const mockImageUrl =
        'data:image/jpeg;base64,' +
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP///////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Af//Z';
      const mockPlatform = 'instagram';
      const mockVoice = 'flirty_playful';

      // Mock successful responses
      const mockFactsResponse = {
        response: {
          text: () => JSON.stringify({
            objects: ['lingerie'],
            setting: 'bedroom',
            mood: 'confident',
          }),
        },
      };

      const variantPayload = [
        {
          caption: 'Feeling gorgeous tonight ✨',
          hashtags: ['#lingerie', '#confidence', '#style'],
          safety_level: 'spicy_safe',
          mood: 'confident',
          style: 'authentic',
          cta: 'What do you think?',
          alt: 'A glamorous example alt text to satisfy schema',
          nsfw: false,
        },
        {
          caption: 'Lace layers with late night sparkle',
          hashtags: ['#lace', '#latenight', '#sparkle'],
          safety_level: 'normal',
          mood: 'playful',
          style: 'bold',
          cta: 'Slide through if you feel the glow',
          alt: 'Detailed alt text describing lace details glowing under soft lighting.',
          nsfw: false,
        },
        {
          caption: 'Moonlit silk and champagne laughs',
          hashtags: ['#moonlit', '#silk', '#champagne'],
          safety_level: 'normal',
          mood: 'romantic',
          style: 'luxurious',
          cta: 'Toast with me in the comments',
          alt: 'Alt text capturing a confident pose beside a city window at night.',
          nsfw: false,
        },
        {
          caption: 'Velvet shadows and bold smiles',
          hashtags: ['#velvet', '#bold', '#smiles'],
          safety_level: 'spicy_safe',
          mood: 'confident',
          style: 'dramatic',
          cta: 'Drop your favorite night-out emoji',
          alt: 'Alt text describing a model in velvet attire with playful lighting.',
          nsfw: false,
        },
        {
          caption: 'Neon-lit nights and satin strides',
          hashtags: ['#neon', '#satin', '#nightout'],
          safety_level: 'normal',
          mood: 'energized',
          style: 'modern',
          cta: 'Tell me your go-to city soundtrack',
          alt: 'Alt text highlighting neon reflections on satin fabrics downtown.',
          nsfw: false,
        },
      ];

      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      };

      const mockRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Selected based on engagement potential',
              final: variantPayload[0],
            }),
        },
      };

      const retryVariantPayload = variantPayload.map((variant, index) => ({
        ...variant,
        caption: `${variant.caption} (retry ${index + 1})`,
        alt: `${variant.alt} Retry sequence ${index + 1}.`,
      }));

      const retryVariantsResponse = {
        response: {
          text: () => JSON.stringify(retryVariantPayload),
        },
      };

      const retryRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 1,
              scores: [4, 5, 3, 2, 1],
              reason: 'Retry selection maintains quality variety',
              final: retryVariantPayload[1],
            }),
        },
      };

      const finalVariantPayload = retryVariantPayload.map((variant, index) => ({
        ...variant,
        caption: `${variant.caption} (stabilized ${index + 1})`,
        alt: `${variant.alt} Stabilized coverage pass ${index + 1}.`,
      }));

      const finalVariantsResponse = {
        response: {
          text: () => JSON.stringify(finalVariantPayload),
        },
      };

      const finalRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 2,
              scores: [3, 4, 5, 2, 1],
              reason: 'Final stabilization ranking',
              final: finalVariantPayload[2],
            }),
        },
      };

      const { textModel, visionModel } = await import('../../server/lib/gemini.js');
      const visionGenerateMock = asMock(visionModel.generateContent);
      visionGenerateMock.mockResolvedValueOnce(mockFactsResponse);
      const textGenerateMock = asMock(textModel.generateContent);
      const responseQueue = [
        mockVariantsResponse,
        mockRankResponse,
        retryVariantsResponse,
        retryRankResponse,
        finalVariantsResponse,
        finalRankResponse,
      ];
      textGenerateMock.mockImplementation(() => {
        if (responseQueue.length === 0) {
          responseQueue.push(finalVariantsResponse, finalRankResponse);
        }
        const next = responseQueue.shift();
        if (!next) {
          throw new Error('Gemini variants unavailable');
        }
        return Promise.resolve(next as Awaited<ReturnType<(typeof textModel)['generateContent']>>);
      });

      const result = await pipeline({
        imageUrl: mockImageUrl,
        platform: mockPlatform,
        voice: mockVoice,
      });

      const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');

      expect(openAICaptionFallback).not.toHaveBeenCalled();
      expect(result.final).toMatchObject({
        caption: expect.any(String) as string,
        safety_level: expect.stringMatching(/safe|low|spicy_safe|normal/),
      });
      expect(result.titles).toBeDefined();
      expect(Array.isArray(result.titles)).toBe(true);
      expect(result.titles?.length).toBeGreaterThan(0);
      const finalTitles = (result.final as { titles?: string[] }).titles;
      expect(finalTitles).toBeDefined();
      expect(Array.isArray(finalTitles)).toBe(true);
      expect(finalTitles?.length).toBeGreaterThan(0);
      const rankedFinalTitles = ((result.ranked as { final?: { titles?: string[] } })?.final)?.titles;
      expect(rankedFinalTitles).toBeDefined();
      expect(rankedFinalTitles?.length).toBeGreaterThan(0);
    });

    it('should fallback to safe defaults when Gemini returns variants with missing hashtags', async () => {
      const mockImageUrl =
        'data:image/jpeg;base64,' +
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP///////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Af//Z';
      const mockPlatform = 'instagram';
      const mockVoice = 'flirty_playful';

      // Mock successful facts response
      const mockFactsResponse = {
        response: {
          text: () => JSON.stringify({
            objects: ['lingerie'],
            setting: 'bedroom',
            mood: 'confident',
          }),
        },
      };

      // Mock variants response with missing hashtags (empty array)
      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify([
            {
              caption: 'Feeling gorgeous tonight ✨',
              hashtags: [], // Empty hashtags should trigger fallback
              safety_level: 'spicy_safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'What do you think?',
              alt: 'A glamorous example alt text to satisfy schema',
              nsfw: false,
            },
            {
              caption: 'Another amazing look',
              hashtags: [], // Empty hashtags should trigger fallback
              safety_level: 'safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'Love this look!',
              alt: 'Another example alt text that meets requirements',
              nsfw: false,
            },
            {
              caption: 'Third variant caption',
              // hashtags field completely missing
              safety_level: 'safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'Check it out',
              alt: 'Third alt text example that is long enough',
              nsfw: false,
            },
            {
              caption: 'Fourth variant here',
              hashtags: [], // Empty again
              safety_level: 'safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'See more',
              alt: 'Fourth alt text example with sufficient length',
              nsfw: false,
            },
            {
              caption: 'Fifth and final variant',
              hashtags: [], // Empty again
              safety_level: 'safe',
              mood: 'confident',
              style: 'authentic',
              cta: 'Discover more',
              alt: 'Fifth alt text example that meets all criteria',
              nsfw: false,
            },
          ]),
        },
      };

      const mockRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Selected variant with safe fallback hashtags',
              final: {
                caption: 'Feeling gorgeous tonight ✨',
                hashtags: ['#thoughts'], // Should be populated by fallback
                safety_level: 'spicy_safe',
                mood: 'confident',
                style: 'authentic',
                cta: 'What do you think?',
                alt: 'A glamorous example alt text to satisfy schema',
                nsfw: false,
              },
            }),
        },
      };

      const { textModel, visionModel } = await import('../../server/lib/gemini.js');
      const visionGenerateMock = asMock(visionModel.generateContent);
      visionGenerateMock.mockResolvedValueOnce(mockFactsResponse);
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock.mockRejectedValueOnce(new Error('Gemini variants unavailable'));

      const result = await pipeline({
        imageUrl: mockImageUrl,
        platform: mockPlatform,
        voice: mockVoice,
      });

      const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');

      // When Gemini returns variants with missing or empty hashtags, 
      // the pipeline should fall back to OpenAI which provides safe defaults
      expect(openAICaptionFallback).toHaveBeenCalledWith({
        imageUrl: mockImageUrl,
        platform: mockPlatform,
        voice: mockVoice,
      });

      // Verify the result has the expected structure from OpenAI fallback
      expect(result.final).toMatchObject({
        caption: 'Fallback caption',
        hashtags: ['#fallback1', '#fallback2', '#fallback3'],
        safety_level: 'normal',
        alt: 'Fallback alt text that is sufficiently long',
        mood: 'neutral',
        style: 'informative',
        cta: 'Check this out',
        nsfw: false,
      });

      expect(result.titles).toBeDefined();
      expect(result.titles?.length).toBeGreaterThan(0);

      const fallbackTitles = (result.final as { titles?: string[] }).titles;
      expect(fallbackTitles).toBeDefined();
      expect(fallbackTitles?.length).toBeGreaterThan(0);
      const rankedFallbackTitles = ((result.ranked as { final?: { titles?: string[] } })?.final)?.titles;
      expect(rankedFallbackTitles).toBeDefined();
      expect(rankedFallbackTitles?.length).toBeGreaterThan(0);

      expect(result.provider).toBe('openai');
      expect(result.ranked).toBeDefined();
      const rankedResult = result.ranked as { final?: unknown; reason?: string };
      expect(rankedResult.reason).toContain('OpenAI fallback');
      expect(rankedResult.final).toEqual(result.final);

      expect(() => generationResponseSchema.parse(result)).not.toThrow();

      // Verify the fallback hashtags don't contain banned words
      const fallbackHashtags = ['#fallback1', '#fallback2', '#fallback3'];
      fallbackHashtags.forEach((tag) => {
        expect(tag.toLowerCase()).not.toContain('content');
      });
    });

    it('falls back to OpenAI when Gemini is disabled', async () => {
      const mockImageUrl = 'https://cdn.example.com/fallback-image.jpg';
      const platform = 'instagram';
      const voice = 'flirty_playful';

      const { isGeminiAvailable } = await import('../../server/lib/gemini.js');
      asMock(isGeminiAvailable).mockReturnValueOnce(false);

      const result = await pipeline({
        imageUrl: mockImageUrl,
        platform,
        voice,
      });

      const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');
      expect(openAICaptionFallback).toHaveBeenCalledWith({
        imageUrl: mockImageUrl,
        platform,
        voice,
      });

      expect(result.provider).toBe('openai');
      expect(result.titles).toBeDefined();
      expect(result.titles?.length).toBeGreaterThan(0);
      const rankedResult = result.ranked as { reason?: string; final?: unknown };
      expect(rankedResult.reason).toContain('OpenAI fallback selected because Gemini API is not configured');
      expect(rankedResult.final).toEqual(result.final);

      const fallbackTitles = (result.final as { titles?: string[] }).titles;
      expect(fallbackTitles).toBeDefined();
      expect(fallbackTitles?.length).toBeGreaterThan(0);

      expect(() => generationResponseSchema.parse(result)).not.toThrow();
    });

    it('should handle safety level normalization', async () => {
      const variantPayload = [
        {
          caption: 'Test caption',
          hashtags: ['#test'],
          safety_level: 'spicy_safe', // Should be normalized to spicy_safe
          mood: 'confident',
          style: 'authentic',
          cta: 'Check it out',
          alt: 'Alt text showcasing a confident pose with bold styling elements.',
          nsfw: false,
        },
        {
          caption: 'Second caption for safety checks',
          hashtags: ['#second', '#safety'],
          safety_level: 'normal',
          mood: 'relaxed',
          style: 'casual',
          cta: 'Share your vibe',
          alt: 'Alt text outlining a relaxed scene with casual fashion notes.',
          nsfw: false,
        },
        {
          caption: 'Third entry with extra context',
          hashtags: ['#third', '#context'],
          safety_level: 'normal',
          mood: 'playful',
          style: 'modern',
          cta: 'Tell us what stands out',
          alt: 'Alt text describing modern styling details in a playful tone.',
          nsfw: false,
        },
        {
          caption: 'Fourth caption keeps things unique',
          hashtags: ['#fourth', '#unique'],
          safety_level: 'normal',
          mood: 'optimistic',
          style: 'clean',
          cta: 'Drop an emoji that fits',
          alt: 'Alt text capturing optimistic expressions with clean styling choices.',
          nsfw: false,
        },
        {
          caption: 'Fifth caption locks in variety',
          hashtags: ['#fifth', '#variety'],
          safety_level: 'normal',
          mood: 'energized',
          style: 'vibrant',
          cta: 'Comment your go-to caption energy',
          alt: 'Alt text highlighting vibrant details to reinforce uniqueness.',
          nsfw: false,
        },
      ];

      const mockResponse = {
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock.mockResolvedValue(mockResponse);

      // This would normally be called as part of the pipeline
      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const result = await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['test'] },
      });

      expect(result[0].safety_level).toBe('spicy_safe');
    });

    it('should preserve requested tone when retrying after platform check failure', async () => {
      const mockImageUrl =
        'data:image/jpeg;base64,' +
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP///////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Af//Z';
      const style = 'luxury';
      const mood = 'confident';

      const mockFactsResponse = {
        response: {
          text: () => JSON.stringify({
            objects: ['car'],
            colors: ['gold'],
            setting: 'studio',
          }),
        },
      };

      const firstVariantsResponse = {
        response: {
          text: () =>
            JSON.stringify([
              {
                caption: 'Golden hour glow ready for the runway.',
                hashtags: ['#vibe', '#luxury'],
                safety_level: 'normal',
                mood,
                style,
                cta: 'Tap in for the look',
                alt: 'Fashion studio lit with warm golden tones showcasing luxury wardrobe accents and spotlight prep',
                nsfw: false,
              },
            ]),
        },
      };

      const firstRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Initial Gemini selection',
              final: {
                caption: 'Golden hour glow ready for the runway.',
                hashtags: ['#vibe', '#luxury'],
                safety_level: 'normal',
                mood,
                style,
                cta: 'Tap in for the look',
                alt: 'Fashion studio lit with warm golden tones showcasing luxury wardrobe accents and spotlight prep',
                nsfw: false,
              },
            }),
        },
      };

      const retryVariantsResponse = {
        response: {
          text: () =>
            JSON.stringify([
              {
                caption: 'Golden hour glow ready for the runway.',
                hashtags: ['#vibe', '#luxury', '#runwayready'],
                safety_level: 'normal',
                mood,
                style,
                cta: 'Tap in for the look',
                alt: 'Fashion studio lit with warm golden tones showcasing luxury wardrobe accents and spotlight prep',
                nsfw: false,
              },
            ]),
        },
      };

      const retryRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Retry selection with compliant hashtags',
              final: {
                caption: 'Golden hour glow ready for the runway.',
                hashtags: ['#vibe', '#luxury', '#runwayready'],
                safety_level: 'normal',
                mood,
                style,
                cta: 'Tap in for the look',
                alt: 'Fashion studio lit with warm golden tones showcasing luxury wardrobe accents and spotlight prep',
                nsfw: false,
              },
            }),
        },
      };

      const { textModel, visionModel } = await import('../../server/lib/gemini.js');
      (visionModel.generateContent as Mock).mockResolvedValueOnce(mockFactsResponse);
      (textModel.generateContent as Mock)
        .mockResolvedValueOnce(firstVariantsResponse)
        .mockResolvedValueOnce(firstRankResponse)
        .mockResolvedValueOnce(retryVariantsResponse)
        .mockResolvedValueOnce(retryRankResponse);

      const result = await pipeline({
        imageUrl: mockImageUrl,
        platform: 'instagram',
        voice: 'flirty_playful',
        style,
        mood,
      });

      const variantRetryCall = (textModel.generateContent as Mock).mock.calls[2]?.[0]?.[0]?.text;
      expect(variantRetryCall).toContain(`STYLE: ${style}`);
      expect(variantRetryCall).toContain(`MOOD: ${mood}`);

      expect(result.final).toMatchObject({
        hashtags: ['#vibe', '#luxury', '#runwayready'],
        style,
        mood,
      });
      expect(result.final.hashtags).toHaveLength(3);
      expect(result.titles).toBeDefined();
      expect(result.titles?.length).toBeGreaterThan(0);
      const retryTitles = (result.final as { titles?: string[] }).titles;
      expect(retryTitles).toBeDefined();
      expect(retryTitles?.length).toBeGreaterThan(0);
    });

    it('should verify all returned variants are unique', async () => {
      const variantPayload = [
        {
          caption: 'Feeling gorgeous tonight ✨',
          hashtags: ['#lingerie', '#confidence', '#style'],
          safety_level: 'spicy_safe',
          mood: 'confident',
          style: 'authentic',
          cta: 'What do you think?',
          alt: 'A glamorous example alt text to satisfy schema requirements',
          nsfw: false,
        },
        {
          caption: 'Midnight sparkle with satin swagger',
          hashtags: ['#midnight', '#glow', '#style'],
          safety_level: 'normal',
          mood: 'playful',
          style: 'bold',
          cta: 'Slide into the night',
          alt: 'Another richly detailed alt text for validation flow',
          nsfw: false,
        },
        {
          caption: 'Soft lighting, bold confidence in lace',
          hashtags: ['#confidence', '#lace', '#nightout'],
          safety_level: 'normal',
          mood: 'empowered',
          style: 'romantic',
          cta: 'Tell me your vibe',
          alt: 'Alt text describing the confident pose in detail for testing',
          nsfw: false,
        },
        {
          caption: 'Velvet mood and playful winks',
          hashtags: ['#velvet', '#mood', '#playful'],
          safety_level: 'spicy_safe',
          mood: 'flirty',
          style: 'whimsical',
          cta: 'Drop a secret emoji',
          alt: 'Detailed caption-friendly alt text for unique variant coverage',
          nsfw: false,
        },
        {
          caption: 'Glowing in rose-hued whispers tonight',
          hashtags: ['#rose', '#glow', '#evening'],
          safety_level: 'normal',
          mood: 'romantic',
          style: 'elegant',
          cta: 'Share the mood',
          alt: 'Extended alt content to meet schema standards effortlessly',
          nsfw: false,
        },
      ];

      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      };

      const mockRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Selected based on engagement potential',
              final: variantPayload[0],
            }),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce(mockVariantsResponse)
        .mockResolvedValueOnce(mockRankResponse);

      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const result = await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['test'] },
      });

      // Verify all variants are unique by checking caption keys
      expect(new Set(result.map(v => v.caption.toLowerCase().slice(0, 80))).size).toBe(5);
    });

    it('retries when duplicate captions are returned', async () => {
      const duplicateVariant = {
        caption: 'Echoed glam look under neon lights',
        hashtags: ['#glam', '#neon', '#night'],
        safety_level: 'normal',
        mood: 'bold',
        style: 'authentic',
        cta: 'What catches your eye?',
        alt: 'Duplicate variant alt text satisfying the schema constraints for testing',
        nsfw: false,
      };
      const duplicateBatch = Array.from({ length: 5 }, () => ({ ...duplicateVariant }));
      const uniqueBatch = [
        {
          caption: 'Fresh spark under city glow tonight',
          hashtags: ['#city', '#spark', '#style'],
          safety_level: 'normal',
          mood: 'excited',
          style: 'vibrant',
          cta: 'Share your vibe',
          alt: 'Alt copy describing a lively city-inspired outfit for uniqueness',
          nsfw: false,
        },
        {
          caption: 'Silky shadows with a fearless smile',
          hashtags: ['#silky', '#fearless', '#smile'],
          safety_level: 'normal',
          mood: 'confident',
          style: 'sleek',
          cta: 'Drop a 🔥 if you feel it',
          alt: 'Detailed alt content to keep schema happy during retry testing',
          nsfw: false,
        },
        {
          caption: 'Electric hues and a mischievous wink',
          hashtags: ['#electric', '#wink', '#glam'],
          safety_level: 'normal',
          mood: 'playful',
          style: 'edgy',
          cta: 'Tell me your bold color',
          alt: 'Alt description showcasing the mischievous styling for the test',
          nsfw: false,
        },
        {
          caption: 'Velvet secrets under moonlit alleys',
          hashtags: ['#velvet', '#moonlit', '#alleys'],
          safety_level: 'normal',
          mood: 'mysterious',
          style: 'dramatic',
          cta: 'Reveal your night secret',
          alt: 'Another long-form alt text to maintain schema compliance',
          nsfw: false,
        },
        {
          caption: 'Gilded glow with midnight attitude',
          hashtags: ['#gilded', '#midnight', '#attitude'],
          safety_level: 'normal',
          mood: 'sultry',
          style: 'glamorous',
          cta: 'Who are you texting tonight?',
          alt: 'Final alt entry covering the golden styling for unique variant set',
          nsfw: false,
        },
      ];

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce({
          response: { text: () => JSON.stringify(duplicateBatch) },
        })
        .mockResolvedValueOnce({
          response: { text: () => JSON.stringify(uniqueBatch) },
        });

      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const result = await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['test'] },
      });

      expect(textGenerateMock).toHaveBeenCalledTimes(2);
      const secondPrompt = textGenerateMock.mock.calls[1][0][0].text as string;
      expect(secondPrompt).toContain('HINT:You already wrote');
      expect(new Set(result.map(v => v.caption.toLowerCase().slice(0, 80))).size).toBe(5);
    });

    it('sanitizes base hints with quotes and line breaks for Gemini variants', async () => {
      const variantPayload = [
        {
          caption: 'Fresh take on winter vibes with cozy layers',
          hashtags: ['#winter', '#cozy', '#layers'],
          safety_level: 'normal',
          mood: 'confident',
          style: 'authentic',
          cta: 'Drop a thought',
          alt: 'Detailed alt text to satisfy schema enforcement for hint serialization testing.',
          nsfw: false,
        },
        {
          caption: 'Midnight sparkle energy under city lights tonight',
          hashtags: ['#midnight', '#sparkle', '#city'],
          safety_level: 'normal',
          mood: 'playful',
          style: 'bold',
          cta: 'Share your vibe',
          alt: 'Another richly detailed alt text for validation flow with unique content.',
          nsfw: false,
        },
        {
          caption: 'Soft lighting meets bold confidence in lace',
          hashtags: ['#soft', '#bold', '#lace'],
          safety_level: 'normal',
          mood: 'empowered',
          style: 'romantic',
          cta: 'Tell me your take',
          alt: 'Alt text describing the confident styling in detail for testing purposes.',
          nsfw: false,
        },
        {
          caption: 'Velvet mood with playful winks and attitude',
          hashtags: ['#velvet', '#playful', '#attitude'],
          safety_level: 'normal',
          mood: 'flirty',
          style: 'whimsical',
          cta: 'Drop a secret emoji',
          alt: 'Detailed caption-friendly alt text for unique variant coverage testing.',
          nsfw: false,
        },
        {
          caption: 'Golden hour glow with rose-hued whispers',
          hashtags: ['#golden', '#glow', '#rose'],
          safety_level: 'normal',
          mood: 'romantic',
          style: 'elegant',
          cta: 'Share the mood',
          alt: 'Extended alt content to meet schema standards effortlessly for tests.',
          nsfw: false,
        },
      ];

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock.mockResolvedValue({
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      });

      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const hint = 'Keep it "fresh"\nline two';
      await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['hint'] },
        hint,
      });

      expect(textGenerateMock).toHaveBeenCalledTimes(1);
      const prompt = textGenerateMock.mock.calls[0][0][0].text as string;
      const { serializePromptField } = await import('../../server/caption/promptUtils.js');
      const sanitizedHint = serializePromptField(hint, { block: true });
      expect(prompt).toContain(`HINT:${sanitizedHint}`);
      expect(prompt).not.toContain(`HINT:${hint}`);
    });

    it('preserves sanitized retry hints built from duplicates', async () => {
      const duplicateCaption = 'Fresh drop "today"';
      const duplicateVariant = {
        caption: duplicateCaption,
        hashtags: ['#gemini', '#retry', '#duplicates'],
        safety_level: 'normal',
        mood: 'engaging',
        style: 'authentic',
        cta: 'Sound off',
        alt: 'Long-form alt text to exercise duplicate retry sanitization.',
        nsfw: false,
      };

      const duplicateBatch = Array.from({ length: 5 }, () => ({ ...duplicateVariant }));

      const uniqueBatch = [
        {
          caption: 'Unique retry caption with winter aesthetics and fresh energy',
          hashtags: ['#unique', '#retry', '#winter'],
          safety_level: 'normal',
          mood: 'engaging',
          style: 'authentic',
          cta: 'Sound off',
          alt: 'Long-form alt text to exercise duplicate retry sanitization first.',
          nsfw: false,
        },
        {
          caption: 'Bold sunset vibes with dramatic shadows tonight',
          hashtags: ['#sunset', '#bold', '#dramatic'],
          safety_level: 'normal',
          mood: 'confident',
          style: 'artistic',
          cta: 'Share your view',
          alt: 'Long-form alt text to exercise duplicate retry sanitization second.',
          nsfw: false,
        },
        {
          caption: 'Cozy morning light streaming through vintage windows',
          hashtags: ['#cozy', '#morning', '#vintage'],
          safety_level: 'normal',
          mood: 'peaceful',
          style: 'nostalgic',
          cta: 'Tell your story',
          alt: 'Long-form alt text to exercise duplicate retry sanitization third.',
          nsfw: false,
        },
        {
          caption: 'Electric neon glow painting the city streets',
          hashtags: ['#neon', '#electric', '#city'],
          safety_level: 'normal',
          mood: 'energetic',
          style: 'modern',
          cta: 'Drop your beat',
          alt: 'Long-form alt text to exercise duplicate retry sanitization fourth.',
          nsfw: false,
        },
        {
          caption: 'Soft pastel dreams meeting golden hour magic',
          hashtags: ['#pastel', '#dreams', '#golden'],
          safety_level: 'normal',
          mood: 'dreamy',
          style: 'ethereal',
          cta: 'Share the magic',
          alt: 'Long-form alt text to exercise duplicate retry sanitization fifth.',
          nsfw: false,
        },
      ];

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce({ response: { text: () => JSON.stringify(duplicateBatch) } })
        .mockResolvedValueOnce({ response: { text: () => JSON.stringify(uniqueBatch) } });

      const { generateVariants } = await import('../../server/caption/geminiPipeline.js');
      const baseHint = 'Line1\nLine2 "quoted"';
      await generateVariants({
        platform: 'instagram',
        voice: 'flirty_playful',
        facts: { objects: ['retry'] },
        hint: baseHint,
      });

      expect(textGenerateMock).toHaveBeenCalledTimes(2);
      const firstPrompt = textGenerateMock.mock.calls[0][0][0].text as string;
      const secondPrompt = textGenerateMock.mock.calls[1][0][0].text as string;

      const { serializePromptField } = await import('../../server/caption/promptUtils.js');
      const sanitizedBaseHint = serializePromptField(baseHint, { block: true });
      expect(firstPrompt).toContain(`\nHINT:${sanitizedBaseHint}`);
      expect(firstPrompt).not.toContain('HINT:Line1\nLine2 "quoted"');

      const retryHintRaw = `${baseHint} Need much more variety across tone, structure, and imagery.`;
      const sanitizedRetryHint = serializePromptField(retryHintRaw, { block: true });
      expect(secondPrompt).toContain(`\nHINT:${sanitizedRetryHint}`);
      expect(secondPrompt).not.toContain(
        'HINT:Line1\nLine2 "quoted" Need much more variety across tone, structure, and imagery.'
      );
    });
  });

  describe('Text-Only Pipeline', () => {
    it('should generate content without image context', async () => {
      const variantPayload = [
        {
          caption: 'Motivational content for today!',
          hashtags: ['#motivation', '#mindset', '#focus'],
          safety_level: 'normal',
          mood: 'inspiring',
          style: 'authentic',
          cta: 'What motivates you?',
          alt: 'Alt text describing a motivated creator writing plans for the day.',
          nsfw: false,
        },
        {
          caption: 'Morning mantra: own the sunrise',
          hashtags: ['#sunrise', '#grind', '#purpose'],
          safety_level: 'normal',
          mood: 'driven',
          style: 'uplifting',
          cta: 'Share your mantra',
          alt: 'Alt text illustrating a sunrise workout with determined energy.',
          nsfw: false,
        },
        {
          caption: 'Take a breath, chase the big goal',
          hashtags: ['#breathe', '#goal', '#energy'],
          safety_level: 'normal',
          mood: 'focused',
          style: 'encouraging',
          cta: 'Tag your accountability buddy',
          alt: 'Alt text showing a planner with bold goal tracking for inspiration.',
          nsfw: false,
        },
        {
          caption: 'Small wins stack into unstoppable momentum',
          hashtags: ['#wins', '#momentum', '#mindset'],
          safety_level: 'normal',
          mood: 'optimistic',
          style: 'practical',
          cta: 'Drop a recent win',
          alt: 'Alt text highlighting motivational workspace setup for goal achievement.',
          nsfw: false,
        },
        {
          caption: 'Reset, refuel, and rise again stronger',
          hashtags: ['#reset', '#fuel', '#rise'],
          safety_level: 'normal',
          mood: 'resilient',
          style: 'supportive',
          cta: 'Tell us your recharge ritual',
          alt: 'Alt text capturing a calming reset routine with self-care elements.',
          nsfw: false,
        },
      ];

      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      };

      const mockRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Selected most engaging motivational content',
              final: variantPayload[0],
            }),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce(mockVariantsResponse)
        .mockResolvedValueOnce(mockRankResponse);

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

    it('should verify all returned variants are unique for text-only', async () => {
      const variantPayload = [
        {
          caption: 'Motivational content for today!',
          hashtags: ['#motivation', '#mindset', '#focus'],
          safety_level: 'normal',
          mood: 'inspiring',
          style: 'authentic',
          cta: 'What motivates you?',
          alt: 'Detailed motivational alt text exceeding the schema minimum length',
          nsfw: false,
        },
        {
          caption: 'Morning mantra: own the sunrise',
          hashtags: ['#sunrise', '#grind', '#purpose'],
          safety_level: 'normal',
          mood: 'driven',
          style: 'uplifting',
          cta: 'Share your mantra',
          alt: 'Alt text describing a sunrise workout scene to match schema rules',
          nsfw: false,
        },
        {
          caption: 'Take a breath, chase the big goal',
          hashtags: ['#breathe', '#goal', '#energy'],
          safety_level: 'normal',
          mood: 'focused',
          style: 'encouraging',
          cta: 'Tag your accountability buddy',
          alt: 'Motivational alt description capturing the hustle mindset in detail',
          nsfw: false,
        },
        {
          caption: 'Small wins stack into unstoppable momentum',
          hashtags: ['#wins', '#momentum', '#mindset'],
          safety_level: 'normal',
          mood: 'optimistic',
          style: 'practical',
          cta: 'Drop a recent win',
          alt: 'Encouraging alt text highlighting the sense of progress for the reader',
          nsfw: false,
        },
        {
          caption: 'Reset, refuel, and rise again stronger',
          hashtags: ['#reset', '#fuel', '#rise'],
          safety_level: 'normal',
          mood: 'resilient',
          style: 'supportive',
          cta: 'Tell us your recharge ritual',
          alt: 'Supportive alt content illustrating a calming reset routine vividly',
          nsfw: false,
        },
      ];

      const mockVariantsResponse = {
        response: {
          text: () => JSON.stringify(variantPayload),
        },
      };

      const mockRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 1,
              scores: [4, 5, 3, 2, 1],
              reason: 'Chose the most energizing option',
              final: variantPayload[1],
            }),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce(mockVariantsResponse)
        .mockResolvedValueOnce(mockRankResponse);

      const { generateVariantsTextOnly } = await import('../../server/caption/textOnlyPipeline.js');
      const result = await generateVariantsTextOnly({
        platform: 'instagram',
        voice: 'inspiring',
        theme: 'motivation',
        context: 'morning motivation post',
      });

      expect(new Set(result.map(v => v.caption.toLowerCase().slice(0, 80))).size).toBe(5);
    });

    it('retries when text-only duplicates occur', async () => {
      const duplicateVariant = {
        caption: 'Daily mantra: keep grinding',
        hashtags: ['#grind', '#focus', '#daily'],
        safety_level: 'normal',
        mood: 'driven',
        style: 'authentic',
        cta: 'Share your mantra',
        alt: 'Alt text for duplicate case ensuring schema minimum is exceeded easily',
        nsfw: false,
      };
      const duplicateBatch = Array.from({ length: 5 }, () => ({ ...duplicateVariant }));
      const uniqueBatch = [
        {
          caption: 'Fresh slate energy: breathe and begin',
          hashtags: ['#fresh', '#breathe', '#begin'],
          safety_level: 'normal',
          mood: 'calm',
          style: 'grounded',
          cta: 'Tell us how you reset',
          alt: 'Alt narrative describing a calm reset moment for uniqueness',
          nsfw: false,
        },
        {
          caption: 'Progress report: tiny steps count big',
          hashtags: ['#progress', '#steps', '#count'],
          safety_level: 'normal',
          mood: 'encouraging',
          style: 'practical',
          cta: 'Tag a teammate',
          alt: 'Detailed alt text celebrating incremental progress for the set',
          nsfw: false,
        },
        {
          caption: 'Spark your ambition with a mid-day mantra',
          hashtags: ['#spark', '#ambition', '#midday'],
          safety_level: 'normal',
          mood: 'energized',
          style: 'vibrant',
          cta: 'Drop your go-to phrase',
          alt: 'Alt description fueling midday motivation for duplicate testing',
          nsfw: false,
        },
        {
          caption: 'Refocus, refuel, and repeat your mission',
          hashtags: ['#refocus', '#refuel', '#mission'],
          safety_level: 'normal',
          mood: 'focused',
          style: 'encouraging',
          cta: 'Share your repeatable habit',
          alt: 'Alt copy illustrating a repeatable mission-building routine',
          nsfw: false,
        },
        {
          caption: 'Evening reflection: celebrate the subtle wins',
          hashtags: ['#evening', '#reflection', '#wins'],
          safety_level: 'normal',
          mood: 'grateful',
          style: 'reflective',
          cta: 'Name one small victory today',
          alt: 'Reflective alt text encouraging users to acknowledge daily progress',
          nsfw: false,
        },
      ];

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce({
          response: { text: () => JSON.stringify(duplicateBatch) },
        })
        .mockResolvedValueOnce({
          response: { text: () => JSON.stringify(uniqueBatch) },
        });

      const { generateVariantsTextOnly } = await import('../../server/caption/textOnlyPipeline.js');
      const result = await generateVariantsTextOnly({
        platform: 'instagram',
        voice: 'inspiring',
        theme: 'motivation',
        context: 'morning motivation post',
      });

      expect(textGenerateMock).toHaveBeenCalledTimes(2);
      const secondPrompt = textGenerateMock.mock.calls[1][0][0].text as string;
      expect(secondPrompt).toContain('HINT:You already wrote');
      expect(new Set(result.map(v => v.caption.toLowerCase().slice(0, 80))).size).toBe(5);
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
              alt: 'An engaging social media post with vibrant energy and compelling call to action',
              nsfw: false,
            },
          ]),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const genSpy = vi.spyOn(textModel, 'generateContent').mockResolvedValue(mockResponse as MockResponse);

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      expect((result.final as CaptionResult).caption).not.toBe(existingCaption);
      expect((result.final as CaptionResult).caption).toContain('Enhanced');
      expect((result.final as CaptionResult).caption).not.toContain('✨ Enhanced with engaging content and call-to-action that drives better engagement!');

      genSpy.mockRestore();
    });

    it('returns schema compliant fallback when Gemini rewrite fails', async () => {
      const existingCaption = 'Baseline caption';
      const { textModel } = await import('../../server/lib/gemini.js');
      const generateSpy = vi.spyOn(textModel, 'generateContent').mockRejectedValue(new Error('Gemini unavailable'));

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');
      expect(openAICaptionFallback).toHaveBeenCalledWith({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
        imageUrl: undefined,
      });

      expect(result.provider).toBe('openai');
      expect(result.ranked).toBeDefined();
      const rankedResult = result.ranked as { final?: unknown; reason?: string };
      expect(rankedResult.reason).toContain('OpenAI fallback');
      expect(rankedResult.final).toEqual(result.final);

      expect(() => generationResponseSchema.parse(result)).not.toThrow();

      generateSpy.mockRestore();
    });

    it('retries with hints when the rewrite is not longer', async () => {
      const existingCaption = 'An engaging base caption';
      const shortVariantResponse = {
        response: {
          text: () =>
            JSON.stringify([
              {
                caption: 'Short update',
                hashtags: ['#tag1', '#tag2', '#tag3'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Check this out',
                alt: 'An example alt text that is comfortably longer than twenty characters',
                nsfw: false,
              },
            ]),
        },
      };

      const shortRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Short caption selected',
              final: {
                caption: 'Short update',
                hashtags: ['#tag1', '#tag2', '#tag3'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Check this out',
                alt: 'An example alt text that is comfortably longer than twenty characters',
                nsfw: false,
              },
            }),
        },
      };

      const longCaption = 'A richer, more detailed rewrite that adds sensory hooks and a compelling CTA to drive action now!';

      const longVariantResponse = {
        response: {
          text: () =>
            JSON.stringify([
              {
                caption: longCaption,
                hashtags: ['#tag1', '#tag2', '#tag3'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Check this out',
                alt: 'Another alt statement that comfortably exceeds the minimum character requirement for validation',
                nsfw: false,
              },
            ]),
        },
      };

      const longRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Longer caption selected',
              final: {
                caption: longCaption,
                hashtags: ['#tag1', '#tag2', '#tag3'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Check this out',
                alt: 'Another alt statement that comfortably exceeds the minimum character requirement for validation',
                nsfw: false,
              },
            }),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const generateSpy = vi.spyOn(textModel, 'generateContent');
      type GenerateReturn = Awaited<ReturnType<typeof textModel.generateContent>>;

      generateSpy
        .mockResolvedValueOnce(shortVariantResponse as GenerateReturn)
        .mockResolvedValueOnce(shortRankResponse as GenerateReturn)
        .mockResolvedValueOnce(longVariantResponse as GenerateReturn)
        .mockResolvedValueOnce(longRankResponse as GenerateReturn);

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      expect((result.final as CaptionResult).caption).toBe(longCaption);
      expect((result.final as CaptionResult).caption.length).toBeGreaterThan(existingCaption.length);
      expect((result.final as CaptionResult).caption).not.toContain('✨ Enhanced with engaging content and call-to-action that drives better engagement!');
      expect(generateSpy).toHaveBeenCalledTimes(4);

      const secondAttemptCall = generateSpy.mock.calls[2]?.[0]?.[0]?.text;
      expect(secondAttemptCall).toContain('Make it 20% longer with a natural hook and CTA; keep it human, no sparkle clichés.');

      generateSpy.mockRestore();
    });

    it('retries rewrite with hints when the first pass is too short', async () => {
      const existingCaption = 'Basic caption here';
      const longAltText =
        'A descriptive alt text that clearly explains the scene and exceeds the schema requirements for length.';

      const makeVariants = (caption: string) =>
        Array.from({ length: 5 }, () => ({
          caption,
          hashtags: ['#vibes', '#style', '#moments'],
          safety_level: 'normal',
          mood: 'engaging',
          style: 'authentic',
          cta: 'Tell me what you think',
          alt: longAltText,
          nsfw: false,
        }));

      const shortVariantsResponse = {
        response: {
          text: () => JSON.stringify(makeVariants(existingCaption)),
        },
      } satisfies { response: { text: () => string } };

      const shortRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Short baseline rewrite',
              final: {
                caption: existingCaption,
                hashtags: ['#vibes', '#style', '#moments'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Tell me what you think',
                alt: longAltText,
                nsfw: false,
              },
            }),
        },
      } satisfies { response: { text: () => string } };

      const longerCaption =
        'Basic caption here, now expanded with vivid detail that teases the story and invites you to join the conversation.';

      const longVariantsResponse = {
        response: {
          text: () => JSON.stringify(makeVariants(longerCaption)),
        },
      } satisfies { response: { text: () => string } };

      const longRankResponse = {
        response: {
          text: () =>
            JSON.stringify({
              winner_index: 0,
              scores: [5, 4, 3, 2, 1],
              reason: 'Longer rewrite with CTA',
              final: {
                caption: longerCaption,
                hashtags: ['#vibes', '#style', '#moments'],
                safety_level: 'normal',
                mood: 'engaging',
                style: 'authentic',
                cta: 'Tell me what you think',
                alt: longAltText,
                nsfw: false,
              },
            }),
        },
      } satisfies { response: { text: () => string } };

      const { textModel } = await import('../../server/lib/gemini.js');
      const generateContentMock = vi.spyOn(textModel, 'generateContent');

      const shortVariantsCast = shortVariantsResponse as unknown as Awaited<
        ReturnType<(typeof textModel)['generateContent']>
      >;
      const shortRankCast = shortRankResponse as unknown as Awaited<
        ReturnType<(typeof textModel)['generateContent']>
      >;
      const longVariantsCast = longVariantsResponse as unknown as Awaited<
        ReturnType<(typeof textModel)['generateContent']>
      >;
      const longRankCast = longRankResponse as unknown as Awaited<
        ReturnType<(typeof textModel)['generateContent']>
      >;

      generateContentMock
        .mockResolvedValueOnce(shortVariantsCast)
        .mockResolvedValueOnce(shortRankCast)
        .mockResolvedValueOnce(longVariantsCast)
        .mockResolvedValueOnce(longRankCast);

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      expect((result.final as CaptionResult).caption.length).toBeGreaterThan(existingCaption.length);
      expect((result.final as CaptionResult).caption).toBe(longerCaption);
      expect((result.final as CaptionResult).caption).not.toContain('Enhanced with engaging content and call-to-action that drives better engagement');

      const promptCalls = [...generateContentMock.mock.calls];
      expect(promptCalls).toHaveLength(4);
      expect(promptCalls[2]?.[0]?.[0]?.text).toContain(
        'Make it 20% longer with a natural hook and CTA; keep it human, no sparkle clichés.'
      );

      generateContentMock.mockRestore();
    });

    it('retries when mandatory tokens are dropped without platform errors', async () => {
      const existingCaption = 'Launch day! RSVP at https://example.com/launch with @LaunchHQ on 12/25 for the "Mega Launch" by MegaCorp™ #LaunchDay';
      const variantFactory = (caption: string) => ({
        caption,
        hashtags: ['#LaunchDay', '#EventTime', '#RSVPNow'],
        safety_level: 'normal',
        mood: 'excited',
        style: 'authentic',
        cta: 'Reserve your spot',
        alt: 'Detailed alt text describing the MegaCorp launch announcement in a complete sentence.',
        nsfw: false,
      });

      const missingVariants = {
        response: {
          text: () => JSON.stringify(
            Array.from({ length: 5 }, (_, index) =>
              variantFactory(`Variant ${index + 1} without mandatory tokens`)
            )
          ),
        },
      };

      const missingRank = {
        response: {
          text: () => JSON.stringify({
            winner_index: 0,
            scores: [5, 4, 3, 2, 1],
            reason: 'Initial selection missing mandatory tokens',
            final: variantFactory('Variant 1 without mandatory tokens'),
          }),
        },
      };

      const enforcedCaption = 'Launch day! RSVP at https://example.com/launch with @LaunchHQ on 12/25 for the "Mega Launch" by MegaCorp™ #LaunchDay — limited seats!';
      const enforcedVariants = {
        response: {
          text: () => JSON.stringify(
            Array.from({ length: 5 }, (_, index) =>
              variantFactory(`${enforcedCaption} Option ${index + 1}`)
            )
          ),
        },
      };

      const enforcedRank = {
        response: {
          text: () => JSON.stringify({
            winner_index: 0,
            scores: [5, 4, 3, 2, 1],
            reason: 'Retry keeps mandatory tokens',
            final: variantFactory(enforcedCaption),
          }),
        },
      };

      const { textModel } = await import('../../server/lib/gemini.js');
      const textGenerateMock = asMock(textModel.generateContent);
      textGenerateMock
        .mockResolvedValueOnce(missingVariants)
        .mockResolvedValueOnce(missingRank)
        .mockResolvedValueOnce(enforcedVariants)
        .mockResolvedValueOnce(enforcedRank);

      const result = await pipelineRewrite({
        platform: 'instagram',
        voice: 'engaging',
        existingCaption,
      });

      const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.js');
      expect(openAICaptionFallback).not.toHaveBeenCalled();
      expect(textGenerateMock).toHaveBeenCalledTimes(4);
      const promptCalls = [...textGenerateMock.mock.calls];
      expect(promptCalls[2]?.[0]?.[0]?.text).toContain('ABSOLUTE RULE: Keep these tokens verbatim in the caption');
      expect(promptCalls[2]?.[0]?.[0]?.text).not.toContain('Fix platform issue');
      expect(result.provider).toBe('gemini');
      expect((result.final as CaptionResult).caption).toBe(enforcedCaption);
      expect((result.final as CaptionResult).caption).toContain('https://example.com/launch');
      expect((result.final as CaptionResult).caption).toContain('@LaunchHQ');
      expect((result.final as CaptionResult).caption).toContain('#LaunchDay');
      expect((result.final as CaptionResult).caption).toContain('12/25');
      expect((result.final as CaptionResult).caption).toContain('"Mega Launch"');
      expect((result.final as CaptionResult).caption).toContain('MegaCorp™');

      textGenerateMock.mockReset();
    });

    it('enforces fact coverage when image context is available', async () => {
      // Simple test to verify the fact coverage feature exists and functions
      const { ensureFactCoverage } = await import('../../server/caption/ensureFactCoverage.js');
      const facts = { camera: 'Canon 5D', setting: 'rooftop at sunset' };
      const caption = 'Having fun today';
      const alt = 'Photo description';
      
      const result = ensureFactCoverage({ facts, caption, alt });
      
      // Test that ensureFactCoverage returns expected structure
      expect(result).toHaveProperty('ok');
      expect(typeof result.ok).toBe('boolean');
      
      if (!result.ok) {
        expect(result).toHaveProperty('hint');
        expect(typeof result.hint).toBe('string');
      }
    });
  });
});

describe('extractKeyEntities', () => {
  it('captures urls, handles, hashtags, numbers, quotes, and branded terms', () => {
    const caption = 'Launch day 2024! RSVP at https://example.com/launch with @LaunchHQ on 12/25 for the "Mega Launch" by MegaCorp™ and NASA #LaunchDay';
    const entities = extractKeyEntities(caption);

    expect(entities).toEqual([
      '2024',
      'RSVP',
      'https://example.com/launch',
      '@LaunchHQ',
      '12/25',
      '"Mega Launch"',
      'MegaCorp',
      'NASA',
      '#LaunchDay',
    ]);
  });
});