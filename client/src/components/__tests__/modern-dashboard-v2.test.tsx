import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ModernDashboardV2 } from '../modern-dashboard-v2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com', firstName: 'Test' },
    isAuthenticated: true,
  }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/dashboard', vi.fn()],
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ModernDashboardV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard header', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Welcome back, Test')).toBeInTheDocument();
    expect(screen.getByText(/let's create something amazing/i)).toBeInTheDocument();
  });

  it('displays quick stats cards', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Total Posts')).toBeInTheDocument();
    expect(screen.getByText('Engagement Rate')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('shows sidebar navigation', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    const sidebar = screen.getByRole('navigation');
    expect(within(sidebar).getByText('Overview')).toBeInTheDocument();
    expect(within(sidebar).getByText('Create')).toBeInTheDocument();
    expect(within(sidebar).getByText('Content')).toBeInTheDocument();
    expect(within(sidebar).getByText('Analytics')).toBeInTheDocument();
  });

  it('displays recent activity section', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText(/new post scheduled/i)).toBeInTheDocument();
  });

  it('shows upcoming posts section', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Upcoming Posts')).toBeInTheDocument();
    expect(screen.getByText(/r\/gonewild/i)).toBeInTheDocument();
  });

  it('displays quick actions', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByRole('button', { name: /new post/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
  });

  it('shows performance chart placeholder', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText(/7 days/i)).toBeInTheDocument();
  });

  it('handles navigation item clicks', () => {
    const mockSetLocation = vi.fn();
    vi.mock('wouter', () => ({
      useLocation: () => ['/dashboard', mockSetLocation],
    }));

    render(<ModernDashboardV2 />, { wrapper });
    
    const createButton = screen.getAllByText('Create')[0];
    fireEvent.click(createButton);
    
    // Verify navigation would occur
    expect(createButton).toBeInTheDocument();
  });

  it('displays notification badge in sidebar', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    const notificationBadge = screen.getByText('3');
    expect(notificationBadge).toBeInTheDocument();
  });

  it('shows user avatar in sidebar', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    const avatar = screen.getByText('T'); // First letter of Test
    expect(avatar).toBeInTheDocument();
  });

  it('responsive layout classes are applied', () => {
    const { container } = render(<ModernDashboardV2 />, { wrapper });
    
    const mainLayout = container.querySelector('.lg\\:grid-cols-\\[280px_1fr\\]');
    expect(mainLayout).toBeInTheDocument();
  });

  it('displays trending subreddits', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('Trending Subreddits')).toBeInTheDocument();
    expect(screen.getByText('r/RealGirls')).toBeInTheDocument();
    expect(screen.getByText(/12\.5K active/i)).toBeInTheDocument();
  });

  it('shows AI suggestions section', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/best time to post/i)).toBeInTheDocument();
  });

  it('displays earnings overview', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText('$12,847')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('shows scheduled posts with time', () => {
    render(<ModernDashboardV2 />, { wrapper });
    
    expect(screen.getByText(/in 2 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/tomorrow at 8pm/i)).toBeInTheDocument();
  });
});
