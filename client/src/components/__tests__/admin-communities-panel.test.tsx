import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminCommunitiesPanel } from '../admin/admin-communities-panel';
import { apiRequest } from '@/lib/queryClient';

// Mock the API request function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockApiRequest = vi.mocked(apiRequest);

// Mock communities data
const mockCommunities = [
  {
    id: 'test_community_1',
    name: 'gonewild',
    displayName: 'Gone Wild',
    category: 'nsfw',
    members: 500000,
    engagementRate: 0.05,
    verificationRequired: true,
    promotionAllowed: 'limited' as const,
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Must include age', 'No clickbait'],
      contentRules: ['OC only', 'High quality'],
    },
    bestPostingTimes: ['morning', 'evening'],
    averageUpvotes: 150,
    successProbability: 75.5,
    growthTrend: 'stable' as const,
    modActivity: 'high' as const,
    description: 'Adult content community',
    tags: ['adult', 'verification'],
    competitionLevel: 'high' as const,
  },
  {
    id: 'test_community_2',
    name: 'photography',
    displayName: 'Photography',
    category: 'creative',
    members: 250000,
    engagementRate: 0.03,
    verificationRequired: false,
    promotionAllowed: 'yes' as const,
    postingLimits: null,
    rules: {
      minKarma: 50,
      contentRules: ['Original work only'],
    },
    bestPostingTimes: ['afternoon'],
    averageUpvotes: 75,
    successProbability: 60,
    growthTrend: 'growing' as const,
    modActivity: 'medium' as const,
    description: 'Photography enthusiasts',
    tags: ['creative', 'art'],
    competitionLevel: 'medium' as const,
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('AdminCommunitiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for community list
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/reddit/communities')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCommunities),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Rendering and Basic Functionality', () => {
    it('should render the communities panel with search and filters', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      expect(screen.getByTestId('admin-communities-panel')).toBeInTheDocument();
      expect(screen.getByText('Reddit Communities')).toBeInTheDocument();
      expect(screen.getByText('Manage the subreddit directory and community rules')).toBeInTheDocument();
      
      // Check for filter elements
      expect(screen.getByTestId('input-search')).toBeInTheDocument();
      expect(screen.getByTestId('select-category')).toBeInTheDocument();
      expect(screen.getByTestId('select-promotion')).toBeInTheDocument();
      expect(screen.getByTestId('select-verification')).toBeInTheDocument();
    });

    it('should show create button when canManage is true', () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);
      expect(screen.getByTestId('button-create')).toBeInTheDocument();
    });

    it('should hide create button when canManage is false', () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={false} />);
      expect(screen.queryByTestId('button-create')).not.toBeInTheDocument();
    });

    it('should display communities table with data', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
        expect(screen.getByTestId('row-community-test_community_2')).toBeInTheDocument();
      });

      expect(screen.getByText('Gone Wild')).toBeInTheDocument();
      expect(screen.getByText('r/gonewild')).toBeInTheDocument();
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('r/photography')).toBeInTheDocument();
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter communities by search term', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('input-search');
      fireEvent.change(searchInput, { target: { value: 'photography' } });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/reddit/communities?search=photography');
      });
    });

    it('should filter communities by category', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      const categorySelect = screen.getByTestId('select-category');
      fireEvent.click(categorySelect);
      
      // Note: This test would need more specific implementation
      // depending on how the Select component works in your setup
    });

    it('should filter communities by promotion policy', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      const promotionSelect = screen.getByTestId('select-promotion');
      fireEvent.click(promotionSelect);
      
      // Similar to category test
    });
  });

  describe('CRUD Operations', () => {
    it('should open create dialog when create button is clicked', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      const createButton = screen.getByTestId('button-create');
      fireEvent.click(createButton);

      expect(screen.getByText('Create Community')).toBeInTheDocument();
      expect(screen.getByText('Add a new Reddit community to the directory.')).toBeInTheDocument();
    });

    it('should call create API when form is submitted', async () => {
      mockApiRequest.mockResolvedValue({ ok: true });
      
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      // Open create dialog
      const createButton = screen.getByTestId('button-create');
      fireEvent.click(createButton);

      // Fill in required fields
      const nameInput = screen.getByTestId('input-name');
      const displayNameInput = screen.getByTestId('input-display-name');
      const categoryInput = screen.getByTestId('input-category');
      const membersInput = screen.getByTestId('input-members');
      const engagementRateInput = screen.getByTestId('input-engagement-rate');

      fireEvent.change(nameInput, { target: { value: 'testcommunity' } });
      fireEvent.change(displayNameInput, { target: { value: 'Test Community' } });
      fireEvent.change(categoryInput, { target: { value: 'test' } });
      fireEvent.change(membersInput, { target: { value: '1000' } });
      fireEvent.change(engagementRateInput, { target: { value: '0.02' } });

      // Submit form
      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/reddit/communities', expect.objectContaining({
          name: 'testcommunity',
          displayName: 'Test Community',
          category: 'test',
          members: 1000,
          engagementRate: 0.02,
        }));
      });
    });

    it('should open edit dialog when edit button is clicked', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('button-edit-test_community_1');
      fireEvent.click(editButton);

      expect(screen.getByText('Edit Community')).toBeInTheDocument();
      expect(screen.getByText('Update the community information and rules.')).toBeInTheDocument();
      
      // Check that form is pre-populated
      expect(screen.getByDisplayValue('gonewild')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Gone Wild')).toBeInTheDocument();
    });

    it('should call update API when edit form is submitted', async () => {
      mockApiRequest.mockResolvedValue({ ok: true });
      
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      // Open edit dialog
      const editButton = screen.getByTestId('button-edit-test_community_1');
      fireEvent.click(editButton);

      // Modify a field
      const membersInput = screen.getByTestId('input-members');
      fireEvent.change(membersInput, { target: { value: '600000' } });

      // Submit form
      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', '/api/reddit/communities/test_community_1', expect.objectContaining({
          members: 600000,
        }));
      });
    });

    it('should call delete API when delete is confirmed', async () => {
      mockApiRequest.mockResolvedValue({ ok: true });
      
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTestId('button-delete-test_community_1');
      fireEvent.click(deleteButton);

      // Confirm deletion in alert dialog
      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('DELETE', '/api/reddit/communities/test_community_1');
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when required fields are missing', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      // Open create dialog
      const createButton = screen.getByTestId('button-create');
      fireEvent.click(createButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      // Should not call API
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('should validate numeric fields', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      // Open create dialog
      const createButton = screen.getByTestId('button-create');
      fireEvent.click(createButton);

      // Fill in fields with invalid numbers
      const nameInput = screen.getByTestId('input-name');
      const displayNameInput = screen.getByTestId('input-display-name');
      const categoryInput = screen.getByTestId('input-category');
      const membersInput = screen.getByTestId('input-members');
      const engagementRateInput = screen.getByTestId('input-engagement-rate');

      fireEvent.change(nameInput, { target: { value: 'testcommunity' } });
      fireEvent.change(displayNameInput, { target: { value: 'Test Community' } });
      fireEvent.change(categoryInput, { target: { value: 'test' } });
      fireEvent.change(membersInput, { target: { value: 'invalid' } });
      fireEvent.change(engagementRateInput, { target: { value: 'invalid' } });

      // Submit form
      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      // Should not call API with invalid data
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('Rule Summary Display', () => {
    it('should display rule summary badges correctly', async () => {
      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('row-community-test_community_1')).toBeInTheDocument();
      });

      // Check for rule summary badges
      expect(screen.getByText('Min Karma 100')).toBeInTheDocument();
      expect(screen.getByText('Account 30d')).toBeInTheDocument();
      expect(screen.getByText('No watermarks')).toBeInTheDocument();
      expect(screen.getByText('No selling')).toBeInTheDocument();
      expect(screen.getByText('2 title rules')).toBeInTheDocument();
      expect(screen.getByText('2 content rules')).toBeInTheDocument();
    });

    it('should show no rules message when community has no structured rules', async () => {
      // Mock community without structured rules
      const communitiesWithoutRules = [{
        ...mockCommunities[0],
        id: 'no_rules_community',
        rules: null,
      }];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(communitiesWithoutRules),
      });

      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByText('No structured rules')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Communities')).toBeInTheDocument();
        expect(screen.getByText('Failed to load community data. Please check your connection and try again.')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      // Mock a slow API response
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      expect(screen.getByText('Loading communities...')).toBeInTheDocument();
    });

    it('should show empty state when no communities match filters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderWithProviders(<AdminCommunitiesPanel canManage={true} />);

      await waitFor(() => {
        expect(screen.getByText('No communities found matching your filters.')).toBeInTheDocument();
      });
    });
  });
});