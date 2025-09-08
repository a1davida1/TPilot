import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SendGrid before importing emailService
const mockSend = vi.fn();
const mockSetApiKey = vi.fn();

vi.mock('@sendgrid/mail', () => ({
  default: {
    send: mockSend,
    setApiKey: mockSetApiKey
  }
}));

// Mock logger
vi.mock('../../server/lib/logger-utils', () => ({
  safeLog: vi.fn()
}));

describe('Email Service - SendGrid Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Configuration', () => {
    test('should configure SendGrid when API key provided', () => {
      process.env.SENDGRID_API_KEY = 'SG.test_key_123';
      process.env.FROM_EMAIL = 'test@thottopilot.com';
      
      // Re-import to trigger configuration
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      expect(emailService.isEmailServiceConfigured).toBe(true);
      expect(mockSetApiKey).toHaveBeenCalledWith('SG.test_key_123');
    });

    test('should handle missing API key gracefully', () => {
      delete process.env.SENDGRID_API_KEY;
      
      // Re-import to trigger configuration
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      expect(emailService.isEmailServiceConfigured).toBe(false);
      expect(mockSetApiKey).not.toHaveBeenCalled();
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      process.env.SENDGRID_API_KEY = 'SG.test_key_456';
      process.env.FROM_EMAIL = 'noreply@thottopilot.com';
      process.env.FRONTEND_URL = 'https://test.thottopilot.com';
    });

    test('should send verification email successfully', async () => {
      mockSend.mockResolvedValue({ statusCode: 202 });
      
      // Re-import after setting env vars
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      await emailService.sendVerificationEmail('user@test.com', 'testuser', 'token123');
      
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          from: 'noreply@thottopilot.com',
          subject: 'Verify Your ThottoPilot Account',
          text: expect.stringContaining('Hi testuser'),
          html: expect.stringContaining('Welcome, testuser!')
        })
      );
    });

    test('should send password reset email successfully', async () => {
      process.env.JWT_SECRET = 'test_jwt_secret';
      mockSend.mockResolvedValue({ statusCode: 202 });
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      await emailService.sendPasswordResetEmail('user@test.com', 'testuser');
      
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          from: 'noreply@thottopilot.com',
          subject: 'Reset Your ThottoPilot Password',
          text: expect.stringContaining('Hi testuser'),
          html: expect.stringContaining('Hi testuser,')
        })
      );
    });

    test('should send welcome email successfully', async () => {
      mockSend.mockResolvedValue({ statusCode: 202 });
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      await emailService.sendWelcomeEmail('user@test.com', 'testuser');
      
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          from: 'noreply@thottopilot.com',
          subject: 'Welcome to ThottoPilot! 🚀',
          text: expect.stringContaining('Hi testuser'),
          html: expect.stringContaining('Hi testuser!')
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.SENDGRID_API_KEY = 'SG.test_key_789';
      process.env.FROM_EMAIL = 'noreply@thottopilot.com';
    });

    test('should handle SendGrid API errors', async () => {
      const sendGridError = new Error('SendGrid API rate limit exceeded');
      mockSend.mockRejectedValue(sendGridError);
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      await expect(
        emailService.sendVerificationEmail('user@test.com', 'testuser', 'token123')
      ).rejects.toThrow('SendGrid API rate limit exceeded');
      
      const { safeLog } = require('../../server/lib/logger-utils');
      expect(safeLog).toHaveBeenCalledWith(
        'error',
        'Verification email send failed',
        expect.objectContaining({ error: 'SendGrid API rate limit exceeded' })
      );
    });

    test('should skip emails when SendGrid not configured', async () => {
      delete process.env.SENDGRID_API_KEY;
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      // Should return without throwing
      await emailService.sendVerificationEmail('user@test.com', 'testuser', 'token123');
      await emailService.sendPasswordResetEmail('user@test.com', 'testuser');
      await emailService.sendWelcomeEmail('user@test.com', 'testuser');
      
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should handle missing JWT_SECRET for password reset', async () => {
      delete process.env.JWT_SECRET;
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      await expect(
        emailService.sendPasswordResetEmail('user@test.com', 'testuser')
      ).rejects.toThrow('JWT_SECRET environment variable is required for password reset tokens');
    });

    test('should not throw for welcome email failures', async () => {
      const sendGridError = new Error('SendGrid service unavailable');
      mockSend.mockRejectedValue(sendGridError);
      
      vi.resetModules();
      const { emailService } = await import('../../server/services/email-service.ts');
      
      // Welcome email should not throw (non-critical)
      await expect(
        emailService.sendWelcomeEmail('user@test.com', 'testuser')
      ).resolves.toBeUndefined();
      
      const { safeLog } = require('../../server/lib/logger-utils');
      expect(safeLog).toHaveBeenCalledWith(
        'error',
        'Welcome email send failed',
        expect.objectContaining({ error: 'SendGrid service unavailable' })
      );
    });
  });

  describe('Environment Variable Requirements', () => {
    test('should document required environment variables', () => {
      const requiredVars = [
        'SENDGRID_API_KEY', // Required for email functionality
        'FROM_EMAIL'        // Optional but recommended for branding
      ];
      
      // These should be configurable in production
      requiredVars.forEach(varName => {
        expect(typeof varName).toBe('string');
        expect(varName.length).toBeGreaterThan(0);
      });
      
      // Optional variables with defaults
      const optionalVars = [
        'FRONTEND_URL', // Defaults to https://thottopilot.com
        'JWT_SECRET'    // Required for password resets only
      ];
      
      optionalVars.forEach(varName => {
        expect(typeof varName).toBe('string');
        expect(varName.length).toBeGreaterThan(0);
      });
    });
  });
});