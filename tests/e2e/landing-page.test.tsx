import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LandingPage from '@/components/LandingPage';
import type { Metrics } from '@/hooks/use-metrics';

const numberFormatter = new Intl.NumberFormat('en-US');

function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('LandingPage', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = null;
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }

    container.remove();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('renders live metrics instead of placeholders', async () => {
    const metrics: Metrics = {
      creators: 4321,
      posts: 98765,
      engagement: 48,
      activeSubscriptions: 1200,
      generatedAt: new Date('2024-10-10T10:10:10.000Z').toISOString(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => metrics,
    } as Response);

    global.fetch = fetchMock as unknown as typeof fetch;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <LandingPage />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    const creatorsNode = container.querySelector('[data-testid="hero-metric-creators"]');
    const postsNode = container.querySelector('[data-testid="hero-metric-posts"]');
    const activeNode = container.querySelector('[data-testid="hero-metric-active"]');
    const fallbackNode = container.querySelector('[data-testid="hero-metric-fallback"]');

    expect(creatorsNode?.textContent).toBe(numberFormatter.format(metrics.creators));
    expect(postsNode?.textContent).toBe(numberFormatter.format(metrics.posts));
    expect(activeNode?.textContent).toContain(numberFormatter.format(metrics.activeSubscriptions));
    expect(fallbackNode).toBeNull();
    expect(container.textContent ?? '').not.toContain('—');
    expect(container.textContent ?? '').not.toContain('Loading metrics');

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/analytics/summary');

    queryClient.clear();
  });
});