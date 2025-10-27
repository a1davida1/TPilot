import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HeaderEnhanced } from '../header-enhanced';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/use-toast');
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/', vi.fn()]),
}));

describe('HeaderEnhanced', () => {
  const mockToast = vi.fn();
  const mockUser = { id: 1, email: 'test@example.com', firstName: 'Test' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
  });

  it('renders header with user information when authenticated', () => {
    render(<HeaderEnhanced />);
    
    expect(screen.getByText('T')).toBeInTheDocument(); // Avatar with first letter
    expect(screen.getByText('AI Status')).toBeInTheDocument();
  });

  it('shows command palette when Cmd+K is pressed', async () => {
    render(<HeaderEnhanced />);
    
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });
  });

  it('displays notification badge when there are notifications', () => {
    render(<HeaderEnhanced />);
    
    const bellIcon = screen.getByLabelText(/notifications/i);
    expect(bellIcon).toBeInTheDocument();
    
    // Check for notification badge (3 in the component)
    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
  });

  it('opens user menu when avatar is clicked', async () => {
    render(<HeaderEnhanced />);
    
    const avatar = screen.getByText('T');
    fireEvent.click(avatar);
    
    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });
  });

  it('shows AI status indicator', () => {
    render(<HeaderEnhanced />);
    
    expect(screen.getByText('AI Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('3 models available')).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    render(<HeaderEnhanced />);
    
    expect(screen.getByRole('button', { name: /generate caption/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quick post/i })).toBeInTheDocument();
  });

  it('renders correctly when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    render(<HeaderEnhanced />);
    
    expect(screen.queryByText('T')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
