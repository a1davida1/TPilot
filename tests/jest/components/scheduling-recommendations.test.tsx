import React from 'react';
import { render, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';

import { SchedulingRecommendations } from '@/components/scheduling/scheduling-recommendations';

type ReactQueryModule = typeof import('@tanstack/react-query');

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual<ReactQueryModule>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

const { useQuery } = jest.requireMock('@tanstack/react-query') as {
  useQuery: jest.MockedFunction<ReactQueryModule['useQuery']>;
};

describe('SchedulingRecommendations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading skeleton when data is loading', () => {
    useQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      refetch: jest.fn(),
    } as unknown as UseQueryResult);

    render(<SchedulingRecommendations subreddit="creatorhq" />);

    expect(screen.getByText('Analyzing best times to post...')).toBeInTheDocument();
  });

  it('shows error alert when query fails', () => {
    useQuery.mockReturnValue({
      data: undefined,
      error: new Error('network down'),
      isLoading: false,
      refetch: jest.fn(),
    } as unknown as UseQueryResult);

    render(<SchedulingRecommendations subreddit="creatorhq" />);

    expect(screen.getByText('Failed to load optimal times. Please try again.')).toBeInTheDocument();
  });

  it('lists optimal times when query succeeds', () => {
    useQuery.mockReturnValue({
      data: {
        optimalTimes: [
          { dayOfWeek: 1, hourOfDay: 18, avgUpvotes: 120, score: 0.92, confidence: 'high', reason: 'Historical peak' },
        ],
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    } as unknown as UseQueryResult);

    render(<SchedulingRecommendations subreddit="creatorhq" showAutoSchedule />);

    expect(screen.getByText('Best Times for r/creatorhq')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto-schedule post/i })).toBeInTheDocument();
  });
});
