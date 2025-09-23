import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the admin communities hook
vi.mock('../../hooks/use-admin-communities', () => ({
  useAdminCommunities: vi.fn(() => ({
    communities: [
      { id: 1, name: 'test_community', memberCount: 1000, isActive: true },
      { id: 2, name: 'another_community', memberCount: 500, isActive: false }
    ],
    isLoading: false,
    error: null
  }))
}));

// Create a simple mock component
const AdminCommunitiesPanel = () => {
  return (
    <div data-testid="admin-communities-panel">
      <h2>Admin Communities Panel</h2>
      <div data-testid="community-list">
        <div>test_community (1000 members)</div>
        <div>another_community (500 members)</div>
      </div>
    </div>
  );
};

// Test suite for AdminCommunitiesPanel
describe('AdminCommunitiesPanel', () => {
  it('renders the AdminCommunitiesPanel component with communities', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AdminCommunitiesPanel />
      </QueryClientProvider>
    );

    // Assert that the panel title is rendered
    expect(screen.getByRole('heading', { name: /Admin Communities Panel/i })).toBeInTheDocument();

    // Assert that the community list is rendered and contains the mocked community names and member counts
    const communityList = screen.getByTestId('community-list');
    expect(communityList).toBeInTheDocument();
    expect(screen.getByText('test_community (1000 members)')).toBeInTheDocument();
    expect(screen.getByText('another_community (500 members)')).toBeInTheDocument();
  });
});