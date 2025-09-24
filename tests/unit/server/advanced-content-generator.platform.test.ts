
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAdvancedContent, type ContentParameters } from '../../../server/advanced-content-generator';

describe('generateAdvancedContent platform profiles', () => {
  const baseParams: ContentParameters = {
    photoType: 'casual',
    textTone: 'confident',
    style: 'nude-photos',
    includePromotion: true,
    selectedHashtags: ['#cozy', '#sunrise'],
    customPrompt: 'Crew notes: make sure the candles stay lit.',
    platform: 'instagram'
  };

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats instagram captions with double newlines and IG call-to-action', () => {
    const result = generateAdvancedContent({ ...baseParams, platform: 'instagram' });

    expect(result.content).toContain('\n\n');
    expect(result.content).toContain('Tap the bio link for the full drop 🔗');
    expect(result.titles[0]).toContain('Tap the bio link for the full drop 🔗');
  });

  it('adds emoji clusters for Fansly exports', () => {
    const result = generateAdvancedContent({ ...baseParams, platform: 'fansly' });
    const lines = result.content.split('\n');

    expect(result.content).toContain('Unlock the rest on my Fansly 💖');
    expect(lines[lines.length - 1]).toMatch(/^[^A-Za-z0-9]*$/u);
    expect(result.titles[0]).toMatch(/Unlock the rest on my Fansly 💖/);
  });

  it('keeps twitter threads compact with single newlines', () => {
    const result = generateAdvancedContent({ ...baseParams, platform: 'twitter' });

    expect(result.content).not.toContain('\n\n');
    expect(result.content.split('\n').length).toBeLessThanOrEqual(3);
    expect(result.titles[0]).toContain("RT if you're ready for more 🔁");
  });

  it('produces different bodies for each platform profile', () => {
    const instagram = generateAdvancedContent({ ...baseParams, platform: 'instagram' });
    const fansly = generateAdvancedContent({ ...baseParams, platform: 'fansly' });
    const twitter = generateAdvancedContent({ ...baseParams, platform: 'twitter' });

    expect(instagram.content).not.toEqual(fansly.content);
    expect(instagram.content).not.toEqual(twitter.content);
    expect(fansly.content).not.toEqual(twitter.content);
  });
});
