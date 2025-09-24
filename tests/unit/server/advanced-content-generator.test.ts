
import { describe, expect, it } from 'vitest';
import {
  buildSection,
  generalConnectors,
  generateAdvancedContent,
  photoTypeFragmentPools,
  selectWeightedUniqueFragments,
  toneFragmentPools
} from '../../../server/advanced-content-generator';

const staticContext = {
  pickDescriptor: () => 'bright',
  pickTheme: () => 'story',
  pickSetting: () => 'studio',
  pickEmoji: () => '✨',
  pickFiller: () => 'honestly',
  mood: 'calm',
  photoType: 'casual' as const
};

describe('advanced content generator helpers', () => {
  it('selectWeightedUniqueFragments favors higher weighted fragments', () => {
    const pool = [
      { id: 'dominant', weight: 6 },
      { id: 'secondary', weight: 1 },
      { id: 'tertiary', weight: 1 }
    ];

    let dominantSelections = 0;
    const iterations = 200;
    for (let index = 0; index < iterations; index += 1) {
      const [selected] = selectWeightedUniqueFragments(pool, 1);
      if (selected?.id === 'dominant') {
        dominantSelections += 1;
      }
    }

    expect(dominantSelections).toBeGreaterThan(110);
  });

  it('buildSection produces varied output compositions', () => {
    const fragmentPool = [
      { builder: () => 'First spark landed.' },
      { builder: () => 'Second wave followed.' },
      { builder: () => 'Third idea stuck.' },
      { builder: () => 'Fourth vibe lingered.' }
    ];

    const results = new Set<string>();
    for (let index = 0; index < 24; index += 1) {
      results.add(buildSection(fragmentPool, staticContext, { min: 2, max: 3, skipChance: 0.4 }));
    }

    expect(results.size).toBeGreaterThan(3);
  });

  it('wraps custom prompts with contextual connectors', () => {
    const params = {
      photoType: 'casual' as const,
      textTone: 'confident' as const,
      style: 'test-style',
      includePromotion: false,
      selectedHashtags: [] as string[],
      customPrompt: 'custom snippet',
      platform: 'instagram'
    };

    const connectorSet = new Set([
      ...toneFragmentPools[params.textTone].connectors,
      ...photoTypeFragmentPools[params.photoType].connectors,
      ...generalConnectors
    ]);

    let hasConnector = false;
    for (let index = 0; index < 12 && !hasConnector; index += 1) {
      const generated = generateAdvancedContent(params).content;
      const matches = Array.from(connectorSet).some(connector =>
        generated.includes(`${connector} ${params.customPrompt}`) ||
        generated.includes(`${params.customPrompt} ${connector}`)
      );
      hasConnector = matches;
    }

    expect(hasConnector).toBe(true);
  });
});
