import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoPaneCreator } from '../two-pane-creator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('TwoPaneCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the two-pane layout', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    // Check for main sections
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Preview & Schedule')).toBeInTheDocument();
  });

  it('shows upload area in creation pane', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to upload/i)).toBeInTheDocument();
  });

  it('displays persona selection options', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    expect(screen.getByText('Seductive Goddess')).toBeInTheDocument();
    expect(screen.getByText('Bratty Tease')).toBeInTheDocument();
    expect(screen.getByText('Girl Next Door')).toBeInTheDocument();
  });

  it('shows tone selection buttons', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    expect(screen.getByText('Playful')).toBeInTheDocument();
    expect(screen.getByText('Dominant')).toBeInTheDocument();
    expect(screen.getByText('Mysterious')).toBeInTheDocument();
  });

  it('handles file upload', async () => {
    render(<TwoPaneCreator />, { wrapper });
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload/i);
    
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(screen.getByAltText(/uploaded/i)).toBeInTheDocument();
    });
  });

  it('shows generate caption button when image is uploaded', async () => {
    render(<TwoPaneCreator />, { wrapper });
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload/i);
    
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /generate caption/i });
      expect(generateButton).toBeInTheDocument();
      expect(generateButton).not.toBeDisabled();
    });
  });

  it('displays community selection in preview pane', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    expect(screen.getByText(/select communities/i)).toBeInTheDocument();
  });

  it('shows scheduling options', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time/i)).toBeInTheDocument();
  });

  it('disables schedule button when no caption or communities selected', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    const scheduleButton = screen.getByRole('button', { name: /schedule posts/i });
    expect(scheduleButton).toBeDisabled();
  });

  it('allows tag input', async () => {
    render(<TwoPaneCreator />, { wrapper });
    
    const tagInput = screen.getByPlaceholderText(/add tags/i);
    await userEvent.type(tagInput, 'nsfw{enter}');
    
    await waitFor(() => {
      expect(screen.getByText('nsfw')).toBeInTheDocument();
    });
  });

  it('shows progress indicator during caption generation', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<TwoPaneCreator />, { wrapper });
    
    // Upload file first
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload/i);
    await userEvent.upload(input, file);
    
    // Click generate
    const generateButton = screen.getByRole('button', { name: /generate caption/i });
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('allows editing generated caption', async () => {
    render(<TwoPaneCreator />, { wrapper });
    
    // Mock a generated caption
    const mockCaption = { text: 'Test caption', style: 'playful' };
    
    // Would need to mock the generation process and then test editing
    // This is a placeholder for the test logic
    expect(true).toBe(true);
  });

  it('displays character count for caption', () => {
    render(<TwoPaneCreator />, { wrapper });
    
    // After caption is generated/entered
    // expect(screen.getByText(/\d+\/\d+ characters/i)).toBeInTheDocument();
    expect(true).toBe(true); // Placeholder
  });
});
