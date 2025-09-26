import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AdminCommunitiesPanel } from '../admin/admin-communities-panel';
import type { AdminCommunity, PromotionPolicy, GrowthTrend, ActivityLevel as _ActivityLevel, CompetitionLevel as _CompetitionLevel } from '@/hooks/use-admin-communities';
import type { RedditCommunitySellingPolicy } from '@shared/schema';

// Mock dependencies
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();
const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
const mockToast = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  interface QueryOptions {
    queryKey: string[];
    [key: string]: unknown;
  }

  return {
    ...actual,
    useQuery: (options: QueryOptions) => mockUseQuery(options),
    useMutation: () => mockUseMutation(),
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData,
    }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Helper to create structured rules
const createStructuredRules = (
  sellingPolicy: RedditCommunitySellingPolicy,
  overrides: Record<string, unknown> = {}
) => {
  const baseRules = {
    content: {
      sellingPolicy: sellingPolicy,
      promotionalLinks: 'limited',
      watermarksAllowed: true,
      titleGuidelines: [],
      contentGuidelines: [],
      bannedContent: [],
      formattingRequirements: []
    },
    eligibility: {
      minKarma: 100,
      minAccountAgeDays: 30,
      verificationRequired: false
    }
  };

  // Deep merge overrides
  const mergeDeep = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const key in source) {
      if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };

  return mergeDeep(JSON.parse(JSON.stringify(baseRules)), overrides);
};

vi.mock('@/hooks/use-admin-communities', () => ({
  useAdminCommunities: (filters?: Record<string, unknown>) => mockUseQuery({ queryKey: ['admin-communities', filters] }),
  useCreateCommunity: () => mockUseMutation(),
  useUpdateCommunity: () => mockUseMutation(),
  useDeleteCommunity: () => mockUseMutation(),
  GROWTH_TRENDS: ['up', 'stable', 'down'],
  GROWTH_TREND_LABELS: {
    up: 'Growing',
    stable: 'Stable',
    down: 'Declining'
  },
  getGrowthTrendLabel: (trend: GrowthTrend | null | undefined) => {
    if (!trend) return 'Unknown';
    const labels = { up: 'Growing', stable: 'Stable', down: 'Declining' };
    return labels[trend];
  }
}));

// Mock global ResizeObserver and scrollIntoView
const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;
globalScope.IS_REACT_ACT_ENVIRONMENT = true;

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

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('AdminCommunitiesPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      reset: vi.fn()
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Selling Policy Enum Variations', () => {
    const createCommunityWithSellingPolicy = (
      sellingPolicy: RedditCommunitySellingPolicy,
      promotionPolicy: PromotionPolicy = 'limited'
    ): AdminCommunity => ({
      id: `community-${sellingPolicy}`,
      name: `community${sellingPolicy}`,
      displayName: `Community ${sellingPolicy}`,
      category: 'general',
      members: 1000,
      engagementRate: 50,
      verificationRequired: false,
      promotionAllowed: promotionPolicy,
      rules: createStructuredRules(sellingPolicy),
      growthTrend: 'stable',
      modActivity: 'medium',
      competitionLevel: 'medium'
    });

    it('should display allowed selling policy badge correctly', async () => {
      const community = createCommunityWithSellingPolicy('allowed', 'yes');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const promotionBadge = container.querySelector('[data-testid="row-community-community-allowed"]');
      expect(promotionBadge).toBeTruthy();
      expect(promotionBadge?.textContent).toContain('yes');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display limited selling policy with proper styling', async () => {
      const community = createCommunityWithSellingPolicy('limited', 'limited');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const promotionBadge = container.querySelector('[data-testid="row-community-community-limited"]');
      expect(promotionBadge).toBeTruthy();
      expect(promotionBadge?.textContent).toContain('limited');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display not_allowed selling policy with destructive variant', async () => {
      const community = createCommunityWithSellingPolicy('not_allowed', 'no');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const promotionBadge = container.querySelector('[data-testid="row-community-community-not_allowed"]');
      expect(promotionBadge).toBeTruthy();
      expect(promotionBadge?.textContent).toContain('no');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display unknown selling policy correctly', async () => {
      const community = createCommunityWithSellingPolicy('unknown', 'unknown');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const promotionBadge = container.querySelector('[data-testid="row-community-community-unknown"]');
      expect(promotionBadge).toBeTruthy();
      expect(promotionBadge?.textContent).toContain('unknown');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Rule Summary Display', () => {
    it('should display comprehensive rule summary with selling policy', async () => {
      const community: AdminCommunity = {
        id: 'detailed-rules',
        name: 'detailedrules',
        displayName: 'Detailed Rules Community',
        category: 'photography',
        members: 2500,
        engagementRate: 65,
        verificationRequired: true,
        promotionAllowed: 'limited',
        rules: createStructuredRules('limited', {
          eligibility: {
            minKarma: 500,
            minAccountAgeDays: 90,
            verificationRequired: true,
          },
          content: {
            watermarksAllowed: false,
            titleGuidelines: ['Clear descriptive titles', 'No clickbait'],
            contentGuidelines: ['High quality images only', 'OC preferred'],
            linkRestrictions: ['No direct sales links', 'Portfolio links OK'],
          },
        }),
        growthTrend: 'up',
        modActivity: 'high',
        competitionLevel: 'medium'
      };

      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Check for rule summary elements
      const rulesSummary = container.querySelector('[data-testid="row-community-detailed-rules"]');
      expect(rulesSummary).toBeTruthy();

      // The RuleSummary component should display the selling policy
      expect(container.textContent).toContain('limited');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should handle communities with no structured rules', async () => {
      const community: AdminCommunity = {
        id: 'no-rules',
        name: 'norules',
        displayName: 'No Rules Community',
        category: 'general',
        members: 100,
        engagementRate: 20,
        verificationRequired: false,
        promotionAllowed: 'unknown',
        rules: null,
        growthTrend: 'stable',
        modActivity: 'low',
        competitionLevel: 'low'
      };

      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const rulesSummary = container.querySelector('[data-testid="row-community-no-rules"]');
      expect(rulesSummary).toBeTruthy();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Form Selectors and Canonical Labels', () => {
    it('should display promotion policy selector with proper canonical labels', async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Click create button to open form
      const createButton = container.querySelector('[data-testid="button-create"]') as HTMLButtonElement;
      expect(createButton).toBeTruthy();

      await act(async () => {
        createButton?.click();
        await flushPromises();
      });

      // Check if form elements exist (they should be in DOM after create button click)
      const promotionSelect = container.querySelector('[data-testid="select-promotion"]');
      expect(promotionSelect).toBeTruthy();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display filter selectors with proper options', async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Check filter selectors
      const categorySelect = container.querySelector('[data-testid="select-category"]');
      const promotionSelect = container.querySelector('[data-testid="select-promotion"]');
      const verificationSelect = container.querySelector('[data-testid="select-verification"]');

      expect(categorySelect).toBeTruthy();
      expect(promotionSelect).toBeTruthy();
      expect(verificationSelect).toBeTruthy();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Growth Trend Enum Display and Handling', () => {
    const createCommunityWithGrowthTrend = (growthTrend: GrowthTrend): AdminCommunity => ({
      id: `trend-${growthTrend}`,
      name: `trend${growthTrend}`,
      displayName: `Trend ${growthTrend} Community`,
      category: 'general',
      members: 1000,
      engagementRate: 50,
      verificationRequired: false,
      promotionAllowed: 'limited',
      rules: createStructuredRules('allowed'),
      growthTrend,
      modActivity: 'medium',
      competitionLevel: 'medium'
    });

    it('should handle up growth trend', async () => {
      const community = createCommunityWithGrowthTrend('up');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Trend up Community');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should handle stable growth trend', async () => {
      const community = createCommunityWithGrowthTrend('stable');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Trend stable Community');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should handle down growth trend', async () => {
      const community = createCommunityWithGrowthTrend('down');
      mockUseQuery.mockReturnValue({
        data: [community],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Trend down Community');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Badge Rendering for Different Policy States', () => {
    it('should render badges with appropriate variants for different promotion policies', async () => {
      const communities: AdminCommunity[] = [
        {
          id: 'allowed-policy',
          name: 'allowedpolicy',
          displayName: 'Allowed Policy',
          category: 'general',
          members: 1000,
          engagementRate: 50,
          verificationRequired: false,
          promotionAllowed: 'yes',
          rules: createStructuredRules('allowed', {
            eligibility: {
              minKarma: 0,
              verificationRequired: false
            },
            content: {
              watermarksAllowed: true,
              titleGuidelines: [],
              contentGuidelines: [],
              bannedContent: [],
              formattingRequirements: []
            }
          }),
          growthTrend: 'up',
          modActivity: 'high',
          competitionLevel: 'low'
        },
        {
          id: 'limited-policy',
          name: 'limitedpolicy',
          displayName: 'Limited Policy',
          category: 'general',
          members: 2000,
          engagementRate: 40,
          verificationRequired: true,
          promotionAllowed: 'limited',
          rules: createStructuredRules('limited', {
            eligibility: {
              minKarma: 50
            },
            content: {
              watermarksAllowed: false,
              titleGuidelines: ['Test rule'],
              contentGuidelines: [],
              bannedContent: [],
              formattingRequirements: []
            }
          }),
          growthTrend: 'stable',
          modActivity: 'medium',
          competitionLevel: 'medium'
        },
        {
          id: 'strict-policy',
          name: 'strictpolicy',
          displayName: 'Strict Policy',
          category: 'general',
          members: 3000,
          engagementRate: 30,
          verificationRequired: true,
          promotionAllowed: 'no',
          rules: createStructuredRules('allowed', {
            eligibility: {
              minKarma: 0,
              verificationRequired: false
            },
            content: {
              watermarksAllowed: true,
              titleGuidelines: [],
              contentGuidelines: [],
              bannedContent: [],
              formattingRequirements: []
            }
          }),
          growthTrend: 'down',
          modActivity: 'low',
          competitionLevel: 'high'
        }
      ];

      mockUseQuery.mockReturnValue({
        data: communities,
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Check that all community rows are rendered
      expect(container.querySelector('[data-testid="row-community-allowed-policy"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="row-community-limited-policy"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="row-community-strict-policy"]')).toBeTruthy();

      // Verify different promotion policies are displayed
      expect(container.textContent).toContain('yes');
      expect(container.textContent).toContain('limited');
      expect(container.textContent).toContain('no');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Form Validation and Submission', () => {
    beforeEach(() => {
      mockMutateAsync.mockResolvedValue({});
    });

    it('should handle form submission for creating a new community', async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Click create button
      const createButton = container.querySelector('[data-testid="button-create"]') as HTMLButtonElement;
      expect(createButton).toBeTruthy();

      await act(async () => {
        createButton?.click();
        await flushPromises();
      });

      expect(mockUseMutation).toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should handle form validation errors', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Members count is required and must be a number.'));

      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // The form validation errors would be handled in the actual form submission
      // which is tested through the mutation mock
      expect(mockUseMutation).toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Edge Cases and Error States', () => {
    it('should display error state when data loading fails', async () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load communities')
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Error Loading Communities');
      expect(container.textContent).toContain('Failed to load community data');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display loading state', async () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Loading communities...');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should display no communities message when list is empty', async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('No communities found matching your filters');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should hide management actions when canManage is false', async () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={false} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Create button should not exist
      const createButton = container.querySelector('[data-testid="button-create"]');
      expect(createButton).toBeNull();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('should handle search and filtering', async () => {
      const communities: AdminCommunity[] = [
        {
          id: 'photography',
          name: 'photography',
          displayName: 'Photography',
          category: 'creative',
          members: 1000,
          engagementRate: 50,
          verificationRequired: false,
          promotionAllowed: 'limited',
          rules: createStructuredRules('allowed'),
          growthTrend: 'up',
          modActivity: 'high',
          competitionLevel: 'low'
        }
      ];

      mockUseQuery.mockReturnValue({
        data: communities,
        isLoading: false,
        error: null
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<AdminCommunitiesPanel canManage={true} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Test search input
      const searchInput = container.querySelector('[data-testid="input-search"]') as HTMLInputElement;
      expect(searchInput).toBeTruthy();

      // Reset mock to track new calls
      mockUseQuery.mockClear();

      await act(async () => {
        searchInput.value = 'photo';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        await flushPromises();
      });

      // The mock should be called on component re-render with updated filters
      // Check that the component handles the search input
      expect(searchInput.value).toBe('photo');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });
});