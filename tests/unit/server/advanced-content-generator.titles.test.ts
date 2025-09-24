
import { describe, expect, it } from 'vitest';

import { generateAdvancedContent, type ContentParameters } from '../../../server/advanced-content-generator';

describe('generateAdvancedContent - titles', () => {
  const baseParams: ContentParameters = {
    photoType: 'casual',
    textTone: 'playful',
    style: 'custom-style',
    includePromotion: false,
    selectedHashtags: [],
    platform: 'instagram'
  };

  it('produces varied title sets across repeated runs', () => {
    const uniqueTitleGroups = new Set<string>();

    for (let index = 0; index < 12; index += 1) {
      const { titles } = generateAdvancedContent(baseParams);
      uniqueTitleGroups.add(titles.join(' | '));
    }

    expect(uniqueTitleGroups.size).toBeGreaterThan(1);
  });

  it('surfaces a broad mix of individual titles over multiple runs', () => {
    const uniqueTitles = new Set<string>();

    for (let index = 0; index < 20; index += 1) {
      const { titles } = generateAdvancedContent(baseParams);
      titles.forEach(title => uniqueTitles.add(title));
    }

    expect(uniqueTitles.size).toBeGreaterThan(5);
  });
});
