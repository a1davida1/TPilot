import React from 'react';
import { render, screen } from '@testing-library/react';

import LandingPage from '@/components/LandingPage';

type MetricsHookModule = typeof import('@/hooks/use-metrics');

jest.mock('@/hooks/use-metrics', () => {
  const actual = jest.requireActual<MetricsHookModule>('@/hooks/use-metrics');
  return {
    ...actual,
    useMetrics: jest.fn(),
    useMetricsSuspense: jest.fn(),
  };
});

const metricsModule = jest.requireMock('@/hooks/use-metrics') as {
  useMetrics: jest.MockedFunction<MetricsHookModule['useMetrics']>;
  useMetricsSuspense: jest.MockedFunction<MetricsHookModule['useMetricsSuspense']>;
};

describe('LandingPage hero metrics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders friendly error state when metrics query fails', () => {
    metricsModule.useMetrics.mockReturnValue({
      data: undefined,
      error: { message: 'fail', userMessage: 'Service offline' } as never,
      isError: true,
      isLoading: false,
    } as never);

    render(<LandingPage />);

    expect(screen.getByText('Service offline')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-metric-active')).not.toBeInTheDocument();
  });

  it('shows live metrics when query succeeds', () => {
    const metrics = {
      creators: 4200,
      posts: 18000,
      engagement: 72,
      activeSubscriptions: 950,
      generatedAt: new Date().toISOString(),
    };

    metricsModule.useMetrics.mockReturnValue({
      data: metrics,
      error: null,
      isError: false,
      isLoading: false,
    } as never);
    metricsModule.useMetricsSuspense.mockReturnValue(metrics);

    render(<LandingPage />);

    expect(screen.getByTestId('hero-metric-active')).toHaveTextContent('950');
  });
});
