import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockUseQuery = vi.fn();
const mockToast = vi.fn();
const mockSetLocation = vi.fn();

interface MockAuthState {
  user: null | { id: number; username: string; tier?: string; email?: string; isAdmin?: boolean };
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  hasFullAccess: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  refetch: ReturnType<typeof vi.fn>;
}

const mockAuthState: MockAuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isVerified: true,
  hasFullAccess: true,
  login: vi.fn(),
  logout: vi.fn(),
  refetch: vi.fn(),
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => mockUseQuery(options),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/dashboard', mockSetLocation],
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/components/dashboard-quick-start', () => ({
  QuickStartModal: () => <div data-testid="quick-start-modal" />,
}));

vi.mock('@/components/ReferralWidget', () => ({
  ReferralWidget: () => <div data-testid="referral-widget" />,
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button" data-testid="theme-toggle-toggle" />,
}));

const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;
globalScope.IS_REACT_ACT_ENVIRONMENT = true;

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    const entry = {
      isIntersecting: true,
      intersectionRatio: 1,
      target,
      time: Date.now(),
      boundingClientRect: rect,
      intersectionRect: rect,
      rootBounds: null,
      isVisible: true,
    } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);

type ModernDashboardComponent = (props: any) => JSX.Element;

const renderDashboard = async (
  Component: ModernDashboardComponent,
  props: Record<string, unknown> = {}
) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <Component
        userTier="pro"
        user={{ id: 42, username: 'Pro Creator', email: 'creator@example.com' }}
        isRedditConnected
        {...props}
      />
    );
  });

  return { container, root };
};

const cleanupRender = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe('ModernDashboard grouped navigation', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockUseQuery.mockReset();
    mockToast.mockReset();
    mockSetLocation.mockReset();
    mockAuthState.user = null;
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;
    mockAuthState.hasFullAccess = true;
    mockAuthState.login = vi.fn();
    mockAuthState.logout = vi.fn();
    mockAuthState.refetch = vi.fn();

    const statsResponse = {
      postsToday: 3,
      engagementRate: 12.5,
      takedownsFound: 1,
      estimatedTaxSavings: 2450,
    };

    const activityResponse = {
      recentMedia: [
        { id: 1, url: '/test.jpg', signedUrl: null, alt: 'Test image', createdAt: new Date().toISOString() },
      ],
    };

    const catboxResponse = {
      totalUploads: 6,
      successfulUploads: 5,
      failedUploads: 1,
      totalSize: 1024 * 1024,
      successRate: 83,
      averageDuration: 1200,
      uploadsByDay: [
        { date: '2024-01-01', uploads: 2, totalSize: 1024, successRate: 90 },
        { date: '2024-01-02', uploads: 4, totalSize: 2048, successRate: 75 },
      ],
      recentUploads: [],
      lastUploadAt: new Date().toISOString(),
      streakDays: 3,
    };

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;

      switch (key) {
        case '/api/dashboard/stats':
          return { data: statsResponse, isLoading: false, error: null };
        case '/api/dashboard/activity':
          return { data: activityResponse, isLoading: false, error: null };
        case '/api/catbox/stats':
          return { data: catboxResponse, isLoading: false, error: null };
        default:
          return { data: undefined, isLoading: false, error: null };
      }
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders workflow navigation buckets when requirements are met', async () => {
    const { ModernDashboard, MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY } = await import(
      '@/components/modern-dashboard'
    );

    const onboardingProgress = {
      connectedReddit: true,
      selectedCommunities: true,
      createdFirstPost: true,
    };

    localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify(onboardingProgress)
    );

    const { container, root } = await renderDashboard(ModernDashboard);

    const coreNav = container.querySelector('[data-testid="workflow-nav-core"]');
    expect(coreNav).not.toBeNull();
    expect(coreNav?.getAttribute('aria-labelledby')).toBe('workflow-core-heading');
    expect(coreNav?.querySelectorAll('[data-testid^="card-"]').length ?? 0).toBeGreaterThan(0);

    const growthNav = container.querySelector('[data-testid="workflow-nav-growth"]');
    expect(growthNav).not.toBeNull();
    expect(growthNav?.getAttribute('aria-labelledby')).toBe('workflow-growth-heading');

    const advancedToggle = container.querySelector(
      '[data-testid="button-show-more-tools"]'
    ) as HTMLButtonElement | null;
    expect(advancedToggle).not.toBeNull();

    if (advancedToggle) {
      await act(async () => {
        advancedToggle.click();
      });
    }

    const secondaryNav = container.querySelector('[data-testid="workflow-nav-secondary"]');
    expect(secondaryNav).not.toBeNull();
    expect(secondaryNav?.getAttribute('aria-labelledby')).toBe('workflow-secondary-heading');

    await cleanupRender(root, container);
  });

  it('exposes workflow buckets in the mobile command sheet', async () => {
    const { ModernDashboard, MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY } = await import(
      '@/components/modern-dashboard'
    );

    const onboardingProgress = {
      connectedReddit: true,
      selectedCommunities: true,
      createdFirstPost: true,
    };

    localStorage.setItem(
      MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY,
      JSON.stringify(onboardingProgress)
    );

    const { container, root } = await renderDashboard(ModernDashboard);

    const commandCenterButton = container.querySelector(
      '[data-testid="button-command-center"]'
    ) as HTMLButtonElement | null;
    expect(commandCenterButton).not.toBeNull();

    if (commandCenterButton) {
      await act(async () => {
        commandCenterButton.click();
      });
    }

    const sidebar = container.querySelector('#dashboard-primary-navigation');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.getAttribute('aria-hidden')).toBe('false');

    const workflowNav = container.querySelector('[data-testid="workflow-buckets-nav"]');
    expect(workflowNav).not.toBeNull();

    const bucketIds = Array.from(
      container.querySelectorAll('[data-testid^="workflow-bucket-"]')
    ).map((element) => element.getAttribute('data-testid'));

    expect(bucketIds).toEqual(
      expect.arrayContaining([
        'workflow-bucket-core',
        'workflow-bucket-growth',
        'workflow-bucket-secondary',
      ])
    );

    const quickPostLink = container.querySelector('[data-testid="workflow-link-quick-post"]');
    expect(quickPostLink).not.toBeNull();

    await cleanupRender(root, container);
  });
});
