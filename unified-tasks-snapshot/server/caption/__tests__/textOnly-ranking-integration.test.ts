
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptionItem } from '../schema';
import { z } from 'zod';

type CaptionItemType = z.infer<typeof CaptionItem>;
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

describe.each(scenarios)('Text-only ranking integration ($label)', ({ applyGeminiMock }) => {
  let rankAndSelect: (typeof import('../textOnlyPipeline'))['rankAndSelect'];
  let textModelMock: TextModelMock;

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

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../lib/prompts', () => ({
      load: vi.fn().mockImplementation((filename: string) => {
        if (filename === 'system.txt') return Promise.resolve('System prompt');
        if (filename === 'guard.txt') return Promise.resolve('Guard prompt');
        if (filename === 'rank.txt') return Promise.resolve('Ranking prompt');
        return Promise.resolve('Mock prompt');
      })
    }));

    const { textModelMock: appliedMock } = applyGeminiMock();
    textModelMock = appliedMock;

    ({ rankAndSelect } = await import('../textOnlyPipeline'));
  });

  it('filters sparkle filler selections before reranking', async () => {
    const mockBannedResponse = createMockResponse({
      winner_index: 0,
      final: {
        caption: 'Check out this amazing content! ✨',
        alt: 'Banned alt',
        hashtags: ['#content', '#creative'],
        cta: 'Check it out'
      },
      reason: 'Initial filler'
    });

    const mockHumanResponse = createMockResponse({
      winner_index: 0,
      final: {
        caption: 'Hand-thrown mug fresh from the kiln',
        alt: 'Potter holding a mug in the studio',
        hashtags: ['#makerspace'],
        cta: 'What would you glaze it with?'
      },
      reason: 'Clean alternative'
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
        caption: 'Hand-thrown mug fresh from the kiln',
        alt: 'Potter holding a mug in the studio',
        hashtags: ['#makerspace'],
        cta: 'What would you glaze it with?',
        mood: 'calm',
        style: 'authentic',
        safety_level: 'normal',
        nsfw: false
      }
    ];

    const result = await rankAndSelect(variants, { platform: 'instagram' });

    expect(result.final.caption).toBe('Hand-thrown mug fresh from the kiln');
    expect(result.final.caption).not.toMatch(/Check out this amazing content/i);
    expect(textModelMock).toHaveBeenCalledTimes(2);

    const firstVariants = extractVariantsFromCall(0);
    const secondVariants = extractVariantsFromCall(1);
    expect(firstVariants).toHaveLength(2);
    expect(secondVariants).toHaveLength(1);
    expect(secondVariants[0]?.caption).toBe('Hand-thrown mug fresh from the kiln');
  });
});
