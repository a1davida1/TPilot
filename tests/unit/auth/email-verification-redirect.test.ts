import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the storage and email service for redirect testing
const mockStorage = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  updateUser: vi.fn().mockResolvedValue(undefined),
  createUser: vi.fn(),
  getVerificationToken: vi.fn(),
  getUser: vi.fn(),
  updateUserEmailVerified: vi.fn(),
  deleteVerificationToken: vi.fn(),
  consumeVerificationToken: vi.fn().mockImplementation(async (token: string) => {
    const tokenData = await mockStorage.getVerificationToken(token);
    if (tokenData) {
      await mockStorage.deleteVerificationToken(token);
      return tokenData;
    }
    return null;
  }),
}));

const mockEmailService = vi.hoisted(() => ({
  sendWelcomeEmail: vi.fn(),
}));

vi.mock('../../../server/storage.ts', () => ({ storage: mockStorage }));
vi.mock('../../../server/services/email-service.ts', () => ({ emailService: mockEmailService }));

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

  test('should return JSON success response on valid token with explicit Accept header', async () => {
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
      .set('Accept', 'application/json') // Explicit JSON Accept header
      .expect(200);

    expect(response.body.message).toBe('Email verified successfully');
    expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(1, true);
    expect(mockStorage.deleteVerificationToken).toHaveBeenCalledWith(validToken);
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'testuser');
  });

  test('should redirect to frontend on valid token with browser Accept header', async () => {
    const validToken = 'valid-token-456';
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    mockStorage.getVerificationToken.mockResolvedValue({
      token: validToken,
      userId: 2,
      expiresAt: futureDate
    });

    mockStorage.getUser.mockResolvedValue({
      id: 2,
      email: 'browser@example.com',
      username: 'browseruser'
    });

    mockStorage.updateUserEmailVerified.mockResolvedValue(undefined);
    mockStorage.deleteVerificationToken.mockResolvedValue(undefined);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

    const response = await request(app)
      .get(`/api/auth/verify-email?token=${validToken}`)
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') // Browser Accept header
      .set('User-Agent', 'Mozilla/5.0 (compatible browser)') // Browser User-Agent
      .expect(302); // Expect redirect

    expect(response.headers.location).toMatch(/\/email-verification\?verified=true&email=/);
    expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(2, true);
    expect(mockStorage.deleteVerificationToken).toHaveBeenCalledWith(validToken);
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('browser@example.com', 'browseruser');
  });

  test('should return JSON error for invalid token with explicit Accept header', async () => {
    mockStorage.getVerificationToken.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/auth/verify-email?token=invalid-token')
      .set('Accept', 'application/json') // Explicit JSON Accept header
      .expect(400);

    expect(response.body.message ?? response.body.error ?? '').toBe('Invalid or expired token');
    expect(response.headers.location).toBeUndefined(); // No redirect
  });

  test('should redirect to error page for invalid token with browser Accept header', async () => {
    mockStorage.getVerificationToken.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/auth/verify-email?token=invalid-token')
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') // Browser Accept header
      .set('User-Agent', 'Mozilla/5.0 (compatible browser)') // Browser User-Agent
      .expect(302); // Expect redirect to error page

    expect(response.headers.location).toMatch(/\/email-verification\?error=invalid_token/);
  });
});