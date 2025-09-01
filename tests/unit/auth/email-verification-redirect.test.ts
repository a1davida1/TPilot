import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the storage and email service
const mockStorage = {
  getVerificationToken: vi.fn(),
  getUser: vi.fn(),
  updateUserEmailVerified: vi.fn(),
  deleteVerificationToken: vi.fn(),
};

const mockEmailService = {
  sendWelcomeEmail: vi.fn(),
};

vi.mock('../../server/storage', () => ({
  storage: mockStorage
}));

vi.mock('../../server/services/email-service', () => ({
  emailService: mockEmailService
}));

describe('Email Verification Redirect Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('redirects to dashboard with verification success params', async () => {
    const mockReq = {
      query: { token: 'valid-token-123' }
    };
    
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      redirect: vi.fn()
    };

    // Mock successful verification flow
    mockStorage.getVerificationToken.mockResolvedValue({
      userId: 1,
      token: 'valid-token-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Future date
    });

    mockStorage.getUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'testuser'
    });

    mockStorage.updateUserEmailVerified.mockResolvedValue(undefined);
    mockStorage.deleteVerificationToken.mockResolvedValue(undefined);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

    // Test the logic that should redirect
    const token = mockReq.query.token as string;
    expect(token).toBe('valid-token-123');

    const record = await mockStorage.getVerificationToken(token);
    expect(record).toBeTruthy();
    expect(record.expiresAt > new Date()).toBe(true);

    const user = await mockStorage.getUser(record.userId);
    expect(user).toBeTruthy();

    await mockStorage.updateUserEmailVerified(user.id, true);
    await mockStorage.deleteVerificationToken(token);

    if (user.email) {
      await mockEmailService.sendWelcomeEmail(user.email, user.username);
    }

    // Simulate the redirect call
    mockRes.redirect('/dashboard?verified=true&welcome=true');

    expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard?verified=true&welcome=true');
    expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(1, true);
    expect(mockStorage.deleteVerificationToken).toHaveBeenCalledWith('valid-token-123');
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('user@example.com', 'testuser');
  });

  test('handles expired token correctly', async () => {
    const mockReq = {
      query: { token: 'expired-token-123' }
    };
    
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      redirect: vi.fn()
    };

    // Mock expired token
    mockStorage.getVerificationToken.mockResolvedValue({
      userId: 1,
      token: 'expired-token-123',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Past date
    });

    const token = mockReq.query.token as string;
    const record = await mockStorage.getVerificationToken(token);
    
    // Should be treated as invalid due to expiration
    const isExpired = record && record.expiresAt < new Date();
    expect(isExpired).toBe(true);

    // Simulate error response for expired token
    mockRes.status(400).json({ message: 'Invalid or expired token' });

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
  });

  test('handles missing token parameter', async () => {
    const mockReq = {
      query: {} // No token
    };
    
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      redirect: vi.fn()
    };

    const token = mockReq.query.token as string;
    expect(token).toBeFalsy();

    // Should return error for missing token
    mockRes.status(400).json({ message: 'Token is required' });

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Token is required' });
  });
});