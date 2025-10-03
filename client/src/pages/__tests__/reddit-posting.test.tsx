import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();
const mockApiRequest = vi.fn(async () => ({ json: async () => ({}) }));
const mockAuthState = {
  isAuthenticated: true,
  user: { id: 1, emailVerified: true, bannedAt: null as string | null, suspendedUntil: null as string | null },
  isLoading: false,
  hasFullAccess: true,
  isVerified: true,
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
    useMutation: () => mockUseMutation(),
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData,
    }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/components/MediaLibrarySelector', () => ({
  MediaLibrarySelector: () => <div data-testid="media-selector-mock" />,
}));

vi.mock('@/components/auth-modal', () => ({
  AuthModal: () => null,
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: Parameters<typeof mockApiRequest>) => mockApiRequest(...args),
}));

const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;
globalScope.IS_REACT_ACT_ENVIRONMENT = true;

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  class MockResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver);
}

if (!(HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

describe('RedditPosting community picker', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockInvalidateQueries.mockReset();
    mockSetQueryData.mockReset();
    mockApiRequest.mockReset();
    mockAuthState.isAuthenticated = true;
    mockAuthState.hasFullAccess = true;
    mockAuthState.isVerified = true;
    mockAuthState.isLoading = false;
    mockAuthState.user = {
      id: 1,
      emailVerified: true,
      bannedAt: null,
      suspendedUntil: null,
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('defaults to an eligible community, gates ineligible options, and updates the form when selecting', async () => {
    const accounts = [
      {
        id: 1,
        username: 'creator',
        isActive: true,
        connectedAt: '2023-01-01T00:00:00.000Z',
        karma: 2400,
        verified: true,
        accountAgeDays: 400,
      },
    ];

    const communities = [
      {
        id: 'creatorclub',
        name: 'r/CreatorClub',
        displayName: 'Creator Club',
        members: 120000,
        engagementRate: 12,
        category: 'general',
        promotionAllowed: 'yes',
        bestPostingTimes: ['morning'],
        averageUpvotes: 220,
        successProbability: 78,
        description: 'High-signal creator collabs.',
        rules: {
          minKarma: 500,
          minAccountAge: 60,
          sellingAllowed: 'allowed',
          watermarksAllowed: true,
        },
      },
      {
        id: 'prohub',
        name: 'r/ProHub',
        displayName: 'Pro Hub',
        members: 95000,
        engagementRate: 10,
        category: 'general',
        promotionAllowed: 'limited',
        bestPostingTimes: ['afternoon'],
        averageUpvotes: 180,
        successProbability: 70,
        description: 'Advanced strategy discussions.',
        rules: {
          minKarma: 800,
          minAccountAge: 90,
          sellingAllowed: 'allowed',
          watermarksAllowed: false,
        },
      },
      {
        id: 'gatedelite',
        name: 'r/GatedElite',
        displayName: 'Gated Elite',
        members: 510000,
        engagementRate: 15,
        category: 'premium',
        promotionAllowed: 'limited',
        bestPostingTimes: ['evening'],
        averageUpvotes: 410,
        successProbability: 82,
        description: 'Invitation-only audience.',
        rules: {
          minKarma: 5000,
          minAccountAge: 365,
          sellingAllowed: 'not_allowed',
          watermarksAllowed: false,
        },
      },
    ];

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      switch (key) {
        case '/api/reddit/accounts':
          return { data: accounts, isLoading: false, error: null };
        case '/api/reddit/communities':
          return { data: communities, isLoading: false, error: null };
        case '/api/media':
          return { data: [], isLoading: false, error: null };
        default:
          return { data: undefined, isLoading: false, error: null };
      }
    });

    mockUseMutation.mockImplementation(() => ({
      mutate: () => undefined,
      mutateAsync: async () => undefined,
      isPending: false,
      reset: () => undefined,
    }));

    const { default: RedditPostingPage } = await import('../reddit-posting');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<RedditPostingPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="community-picker-trigger"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent ?? '').toContain('Creator Club');

    await act(async () => {
      trigger?.click();
      await flushPromises();
    });

    const eligibleOption = document.querySelector('[data-testid="community-option-creatorclub"]');
    expect(eligibleOption).not.toBeNull();

    const gatedOption = document.querySelector('[data-testid="community-option-gatedelite"]');
    expect(gatedOption).not.toBeNull();
    const gatedDisabled =
      gatedOption?.getAttribute('aria-disabled') === 'true' ||
      gatedOption?.getAttribute('data-disabled') === 'true';
    expect(gatedDisabled).toBe(true);

    const gatedReason = document.querySelector('[data-testid="community-option-gatedelite-reasons"]');
    expect(gatedReason?.textContent ?? '').toContain('Requires 5000 karma');

    const secondEligible = document.querySelector('[data-testid="community-option-prohub"]') as HTMLElement;
    expect(secondEligible).not.toBeNull();

    const selectedName = container.querySelector('[data-testid="selected-community-name"]');
    expect(selectedName?.textContent ?? '').toContain('Creator Club');

    const eligibilityBadges = container.querySelector('[data-testid="selected-community-eligibility"]');
    expect(eligibilityBadges?.textContent ?? '').toContain('Karma OK');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('skips community fetch and prompts for verification when access is restricted', async () => {
    mockAuthState.hasFullAccess = false;
    mockAuthState.isVerified = false;
    mockAuthState.user = {
      id: 1,
      emailVerified: false,
      bannedAt: null,
      suspendedUntil: null,
    };

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      switch (key) {
        case '/api/reddit/accounts':
        case '/api/media':
          return { data: [], isLoading: false, error: null };
        case '/api/reddit/communities':
          return { data: [], isLoading: false, error: null };
        default:
          return { data: undefined, isLoading: false, error: null };
      }
    });

    const { default: RedditPostingPage } = await import('../reddit-posting');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<RedditPostingPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const communitiesCall = mockUseQuery.mock.calls.find(([options]) => {
      const key = Array.isArray(options?.queryKey) ? options.queryKey[0] : options?.queryKey;
      return key === '/api/reddit/communities';
    });

    expect(communitiesCall?.[0]?.enabled).toBe(false);

    const accessMessage = container.querySelector('[data-testid="communities-access-message"]');
    expect(accessMessage).toBeTruthy();
    expect(accessMessage?.textContent ?? '').toMatch(/verify your email/i);
  });

  it('disables legacy-shaped communities when selling or watermarks are restricted', async () => {
    const accounts = [
      {
        id: 1,
        username: 'veteran',
        isActive: true,
        connectedAt: '2023-01-01T00:00:00.000Z',
        karma: 12000,
        verified: true,
        accountAgeDays: 900,
      },
    ];

    const communities = [
      {
        id: 'structuredsafe',
        name: 'r/StructuredSafe',
        displayName: 'Structured Safe',
        members: 82000,
        engagementRate: 9,
        category: 'general',
        promotionAllowed: 'yes',
        bestPostingTimes: ['morning'],
        averageUpvotes: 140,
        successProbability: 64,
        description: 'Structured data sample.',
        rules: {
          eligibility: {
            minKarma: 100,
            minAccountAgeDays: 7,
            verificationRequired: false,
            requiresApproval: false,
          },
          content: {
            sellingPolicy: 'allowed',
            watermarksAllowed: true,
            promotionalLinks: null,
            requiresOriginalContent: false,
            nsfwRequired: false,
            titleGuidelines: [],
            contentGuidelines: [],
            linkRestrictions: [],
            bannedContent: [],
            formattingRequirements: [],
          },
          posting: {
            maxPostsPerDay: null,
            cooldownHours: null,
          },
          notes: null,
        },
      },
      {
        id: 'legacylock',
        name: 'r/LegacyLock',
        displayName: 'Legacy Lock',
        members: 210000,
        engagementRate: 11,
        category: 'premium',
        promotionAllowed: 'limited',
        bestPostingTimes: ['evening'],
        averageUpvotes: 320,
        successProbability: 75,
        description: 'Legacy restrictions enforced.',
        rules: {
          minKarma: 300,
          minAccountAge: 30,
          sellingAllowed: 'not_allowed',
          watermarksAllowed: false,
        },
      },
    ];

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      switch (key) {
        case '/api/reddit/accounts':
          return { data: accounts, isLoading: false, error: null };
        case '/api/reddit/communities':
          return { data: communities, isLoading: false, error: null };
        case '/api/media':
          return { data: [], isLoading: false, error: null };
        default:
          return { data: undefined, isLoading: false, error: null };
      }
    });

    mockUseMutation.mockImplementation(() => ({
      mutate: () => undefined,
      mutateAsync: async () => undefined,
      isPending: false,
      reset: () => undefined,
    }));

    const { default: RedditPostingPage } = await import('../reddit-posting');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<RedditPostingPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="community-picker-trigger"]');
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.click();
      await flushPromises();
    });

    const gatedOption = document.querySelector('[data-testid="community-option-legacylock"]');
    expect(gatedOption).not.toBeNull();
    const gatedDisabled =
      gatedOption?.getAttribute('aria-disabled') === 'true' ||
      gatedOption?.getAttribute('data-disabled') === 'true';
    expect(gatedDisabled).toBe(true);

    const gatedReason = document.querySelector('[data-testid="community-option-legacylock-reasons"]');
    expect(gatedReason?.textContent ?? '').toContain('Selling not allowed');
    expect(gatedReason?.textContent ?? '').toContain('Watermarks not allowed');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});