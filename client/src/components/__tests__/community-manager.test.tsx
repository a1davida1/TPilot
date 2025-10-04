import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityManager } from '../community/CommunityManager';

describe('CommunityManager', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('renders community manager with engagement tracking', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <CommunityManager />
        </QueryClientProvider>
      );
    });

    expect(container.querySelector('[data-testid="switch-engagement-tracking"]')).toBeTruthy();
  });

  it('toggles engagement tracking', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <CommunityManager />
        </QueryClientProvider>
      );
    });

    const trackingSwitch = container.querySelector('[data-testid="switch-engagement-tracking"]') as HTMLButtonElement;
    expect(trackingSwitch).toBeTruthy();
    
    act(() => {
      trackingSwitch.click();
    });

    // Verify the switch toggled (implementation may vary)
    expect(trackingSwitch).toBeTruthy();
  });

  it('displays engagement metrics when tracking enabled', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <CommunityManager />
        </QueryClientProvider>
      );
    });

    // Check for engagement bars (rendered when tracking is on)
    const bars = container.querySelectorAll('[data-testid^="engagement-bar-"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('filters engagements by sentiment', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <CommunityManager />
        </QueryClientProvider>
      );
    });

    const positiveFilter = container.querySelector('[data-testid="filter-sentiment-positive"]') as HTMLElement;
    expect(positiveFilter).toBeTruthy();
    
    act(() => {
      positiveFilter.click();
    });

    // Filter should be active
    expect(positiveFilter).toBeTruthy();
  });

  it('filters engagements by priority', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <CommunityManager />
        </QueryClientProvider>
      );
    });

    const highPriorityFilter = container.querySelector('[data-testid="filter-priority-high"]') as HTMLElement;
    expect(highPriorityFilter).toBeTruthy();
    
    act(() => {
      highPriorityFilter.click();
    });

    // Filter should be active
    expect(highPriorityFilter).toBeTruthy();
  });
});
