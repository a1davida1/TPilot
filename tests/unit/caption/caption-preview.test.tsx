import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaptionPreview } from '../../../client/src/components/CaptionPreview';
import type { CaptionPreviewData } from '../../../shared/types/caption';

describe('CaptionPreview component', () => {
  it('renders suggested title chips when titles are provided', () => {
    const data: CaptionPreviewData = {
      final: {
        caption: "Moonlit moments in satin.",
        titles: ['Moonlit Moments', 'Satin Night Vibes'],
        hashtags: ['#moonlit', '#satin', '#nightout'],
        mood: 'romantic',
        style: 'elegant',
        cta: 'Tell me your dream night out',
        safety_level: 'normal',
        alt: 'A detailed description of the scene showing a confident pose near city lights at night.',
      },
      ranked: {
        reason: 'Selected for its engaging tone',
      },
    };

    const markup = renderToStaticMarkup(<CaptionPreview data={data} />);

    expect(markup).toContain('Suggested Titles');
    expect(markup).toContain('Moonlit Moments');
    expect(markup).toContain('Satin Night Vibes');
  });
});