import { createElement } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrendIntelligence } from '../../../client/src/components/intelligence/TrendIntelligence';

type RedditIntelligenceDataset = {
  fetchedAt: string;
  trendingTopics: Array<{
    topic: string;
    subreddit: string;
    score: number;
    comments: number;
    category: string;
    url: string;
    flair?: string;
    nsfw: boolean;
    postedAt: string;
    complianceWarnings?: string[];
    verificationRequired?: boolean;
    promotionAllowed?: string;
    cooldownHours?: number | null;
  }>;
  subredditHealth: Array<{
    subreddit: string;
    members: number;
    posts24h: number;
    avgEngagement: number;
    growthTrend: string;
    modActivity: string;
    trendingActivity: boolean;
    competitionLevel: string | null;
  }>;
  forecastingSignals: Array<{
    subreddit: string;
    signal: string;
    confidence: number;
    rationale: string;
    projectedEngagement: number;
  }>;
};

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

const buildDataset = (
  forecastingSignals: RedditIntelligenceDataset['forecastingSignals']
): RedditIntelligenceDataset => ({
  fetchedAt: '2024-01-01T00:00:00.000Z',
  trendingTopics: [
    {
      topic: 'AI automation strategies',
      subreddit: 'FutureTech',
      score: 5120,
      comments: 342,
      category: 'Technology',
      url: 'https://reddit.com/r/FutureTech',
      flair: 'Discussion',
      nsfw: false,
      postedAt: '2024-01-01T00:00:00.000Z',
      complianceWarnings: [],
      verificationRequired: false,
      promotionAllowed: 'Allowed',
      cooldownHours: null,
    },
  ],
  subredditHealth: [
    {
      subreddit: 'FutureTech',
      members: 250000,
      posts24h: 120,
      avgEngagement: 7.4,
      growthTrend: 'up',
      modActivity: 'high',
      trendingActivity: true,
      competitionLevel: 'medium',
    },
  ],
  forecastingSignals,
});

describe('TrendIntelligence forecasting signals', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockUseQuery.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders with forecasting data and passes it to useQuery', () => {
    const dataset = buildDataset([
      {
        subreddit: 'SampleSubreddit',
        signal: 'Weekend product discussion spike',
        confidence: 88,
        rationale: 'Focus on weekend discussions about product updates.',
        projectedEngagement: 15000,
      },
      {
        subreddit: 'SecondarySub',
        signal: 'Evening AMA momentum',
        confidence: 72,
        rationale: '',
        projectedEngagement: 8200,
      },
    ]);

    mockUseQuery.mockReturnValue({ data: dataset, isLoading: false, error: null });

    const queryClient = new QueryClient();
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(QueryClientProvider, { client: queryClient },
          createElement(TrendIntelligence)
        )
      );
    });

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['/api/reddit/intelligence'],
    }));
    
    expect(container.innerHTML).toContain('Trend Intelligence');
    expect(container.innerHTML).toContain('Live Data');

    act(() => {
      root.unmount();
    });
  });

  it('renders with empty forecasting data', () => {
    const dataset = buildDataset([]);

    mockUseQuery.mockReturnValue({ data: dataset, isLoading: false, error: null });

    const queryClient = new QueryClient();
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(QueryClientProvider, { client: queryClient },
          createElement(TrendIntelligence)
        )
      );
    });

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['/api/reddit/intelligence'],
    }));
    
    expect(container.innerHTML).toContain('Trend Intelligence');
    expect(container.querySelector('[data-testid="tab-suggestions"]')).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });
});
