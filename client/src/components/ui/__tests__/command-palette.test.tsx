import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../command-palette';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}));

vi.mock('@/config/navigation', () => ({
  getCommandPaletteItems: vi.fn(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Go to dashboard',
      icon: null,
      action: vi.fn(),
      keywords: ['home', 'overview'],
    },
    {
      id: 'create-post',
      label: 'Create Post',
      description: 'Create a new post',
      icon: null,
      action: vi.fn(),
      keywords: ['new', 'add'],
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Open settings',
      icon: null,
      action: vi.fn(),
      shortcut: '⌘,',
    },
  ]),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open prop is true', () => {
    render(<CommandPalette open={true} />);
    
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  });

  it('does not render when open prop is false', () => {
    render(<CommandPalette open={false} />);
    
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('displays all command items', () => {
    render(<CommandPalette open={true} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create Post')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows command descriptions', () => {
    render(<CommandPalette open={true} />);
    
    expect(screen.getByText('Go to dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create a new post')).toBeInTheDocument();
    expect(screen.getByText('Open settings')).toBeInTheDocument();
  });

  it('filters commands based on search input', async () => {
    render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(searchInput, 'dash');
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Create Post')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search has no matches', async () => {
    render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(searchInput, 'xyz123');
    
    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('executes command action on selection', async () => {
    const { getCommandPaletteItems } = await import('@/config/navigation');
    const mockAction = vi.fn();
    vi.mocked(getCommandPaletteItems).mockReturnValue([
      {
        id: 'test-command',
        label: 'Test Command',
        action: mockAction,
      },
    ]);

    const mockOnOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    
    const command = screen.getByText('Test Command');
    fireEvent.click(command);
    
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes palette when backdrop is clicked', () => {
    const mockOnOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    fireEvent.click(backdrop!);
    
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles keyboard navigation', async () => {
    render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    
    // Press down arrow
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // First item should be highlighted
    const firstItem = screen.getByText('Dashboard').closest('[role="option"]');
    expect(firstItem).toHaveClass('bg-accent');
  });

  it('closes on Escape key', () => {
    const mockOnOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('executes command on Enter key', async () => {
    const { getCommandPaletteItems } = await import('@/config/navigation');
    const mockAction = vi.fn();
    vi.mocked(getCommandPaletteItems).mockReturnValue([
      {
        id: 'test-command',
        label: 'Test Command',
        action: mockAction,
      },
    ]);

    render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    
    // Press down to select first item, then Enter
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('displays keyboard shortcut hints', () => {
    render(<CommandPalette open={true} />);
    
    expect(screen.getByText('ESC')).toBeInTheDocument();
    expect(screen.getByText('↑↓')).toBeInTheDocument();
    expect(screen.getByText('↵')).toBeInTheDocument();
  });

  it('shows shortcuts for commands that have them', () => {
    render(<CommandPalette open={true} />);
    
    // Settings command has ⌘, shortcut
    const settingsCommand = screen.getByText('Settings').parentElement;
    expect(settingsCommand?.textContent).toContain('⌘,');
  });

  it('filters by keywords', async () => {
    render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(searchInput, 'home');
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument(); // Has 'home' keyword
      expect(screen.queryByText('Create Post')).not.toBeInTheDocument();
    });
  });

  it('highlights selected item on hover', async () => {
    render(<CommandPalette open={true} />);
    
    const dashboardItem = screen.getByText('Dashboard').closest('[role="option"]');
    
    fireEvent.mouseEnter(dashboardItem!);
    
    expect(dashboardItem).toHaveClass('bg-accent');
  });

  it('shows AI powered indicator', () => {
    render(<CommandPalette open={true} />);
    
    expect(screen.getByText('AI powered')).toBeInTheDocument();
  });

  it('resets search on close', async () => {
    const { rerender } = render(<CommandPalette open={true} />);
    
    const searchInput = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(searchInput, 'test');
    
    expect(searchInput).toHaveValue('test');
    
    rerender(<CommandPalette open={false} />);
    rerender(<CommandPalette open={true} />);
    
    const newSearchInput = screen.getByPlaceholderText(/type a command/i);
    expect(newSearchInput).toHaveValue('');
  });
});
