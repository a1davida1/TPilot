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

  it('combines contextual hashtags when the include flag is enabled', () => {
    const data: CaptionPreviewData = {
      final: {
        caption: "Street lights and skyline dreams.",
        hashtags: ['#moonlit', '#cityvibes'],
      },
      ranked: { reason: 'High relevance' },
      facts: {
        creator: 'Jane Doe',
        location: {
          city: 'New York',
        },
        subreddit: 'Cityscapes',
      },
    };

    const markup = renderToStaticMarkup(
      <CaptionPreview data={data} includeHashtags platform="instagram" />
    );

    expect(markup).toContain('#Moonlit');
    expect(markup).toContain('#Cityvibes');
    expect(markup).toContain('#NewYork');
    expect(markup).toContain('#JaneDoe');
    expect(markup).toContain('Recommended Hashtags');
  });

  it('omits hashtags and shows reassurance when the flag is disabled', () => {
    const data: CaptionPreviewData = {
      final: {
        caption: "Golden hour glow.",
        hashtags: ['#goldenhour', '#sunsetlove'],
      },
      ranked: { reason: 'Requested without hashtags' },
    };

    const markup = renderToStaticMarkup(
      <CaptionPreview data={data} includeHashtags={false} platform="instagram" />
    );

    expect(markup).not.toContain('#Goldenhour');
    expect(markup).toContain('Hashtags intentionally omitted per your settings.');
  });
});