import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the storage and email service for redirect testing
const mockStorage = {
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
  getVerificationToken: vi.fn(),
  getUser: vi.fn(),
  updateUserEmailVerified: vi.fn(),
  deleteVerificationToken: vi.fn(),
};

const mockEmailService = {
  sendWelcomeEmail: vi.fn(),
};

vi.mock('../../../server/storage', () => ({ storage: mockStorage }));
vi.mock('../../../server/services/email-service', () => ({ emailService: mockEmailService }));

// Import auth setup after mocking
import { setupAuth } from '../../../server/auth';

describe('Email Verification Redirect Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    setupAuth(app);
  });

  test('should redirect to dashboard with success params on valid token', async () => {
    const validToken = 'valid-token-123';
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    mockStorage.getVerificationToken.mockResolvedValue({
      token: validToken,
      userId: 1,
      expiresAt: futureDate
    });

    mockStorage.getUser.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      username: 'testuser'
    });

    mockStorage.updateUserEmailVerified.mockResolvedValue(undefined);
    mockStorage.deleteVerificationToken.mockResolvedValue(undefined);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

    const response = await request(app)
      .get(`/api/auth/verify-email?token=${validToken}`)
      .expect(302); // Expect redirect

    expect(response.headers.location).toBe('/dashboard?verified=true&welcome=true');
    expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(1, true);
    expect(mockStorage.deleteVerificationToken).toHaveBeenCalledWith(validToken);
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'testuser');
  });

  test('should return JSON error for invalid token (no redirect)', async () => {
    mockStorage.getVerificationToken.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/auth/verify-email?token=invalid-token')
      .expect(400);

    expect(response.body.message || "").toBe('Invalid or expired token');
    expect(response.headers.location).toBeUndefined(); // No redirect
  });
});