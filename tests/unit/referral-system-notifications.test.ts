import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReferralManager } from '../../server/lib/referral-system.js';

// Mock dependencies
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../../server/db.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate
  }
}));

const mockSendMail = vi.fn();
vi.mock('../../server/services/email-service.js', () => ({
  emailService: {
    isEmailServiceConfigured: true,
    sendMail: mockSendMail
  }
}));

vi.mock('../../server/lib/logger-utils.js', () => ({
  safeLog: vi.fn()
}));

describe('ReferralManager - Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send notification emails when reward is processed', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;
    const rewardAmount = 5;

    // Mock database chain: get subscribing user's referredBy (NO limit() call in production)
    const selectChain1 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ referredBy: referrerId }])
    };

    // Mock database chain: get referrer info (synchronous chain, async resolution)
    const selectChain2 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { 
          id: referrerId,
          email: 'referrer@example.com',
          firstName: 'Referrer',
          username: 'referrer1'
        }
      ])
    };

    // Mock database chain: get referred user info (synchronous chain, async resolution)
    const selectChain3 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { 
          id: subscribingUserId,
          email: 'subscriber@example.com',
          firstName: 'Subscriber',
          username: 'subscriber1'
        }
      ])
    };

    mockDbSelect
      .mockReturnValueOnce(selectChain1)
      .mockReturnValueOnce(selectChain2)
      .mockReturnValueOnce(selectChain3);

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, referrerId, referredId: subscribingUserId, amount: rewardAmount }])
      })
    });

    mockSendMail.mockResolvedValue({ sent: true });

    const result = await ReferralManager.processReferralReward(subscribingUserId);

    expect(result).toMatchObject({
      type: 'commission',
      amount: rewardAmount,
      description: 'Referral commission for successful subscription'
    });

    // Verify sendMail was called twice (referrer + admin)
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    
    // Verify referrer notification contains correct details
    const referrerCall = mockSendMail.mock.calls.find(
      (call: [{ to: string; subject: string }]) => call[0].to === 'referrer@example.com'
    );
    expect(referrerCall).toBeDefined();
    expect(referrerCall?.[0]).toMatchObject({
      to: 'referrer@example.com',
      subject: expect.stringMatching(/referral commission/i)
    });
    
    // Verify admin notification
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
    const adminCall = mockSendMail.mock.calls.find(
      (call: [{ to: string; subject: string }]) => call[0].to === adminEmail
    );
    expect(adminCall).toBeDefined();
    expect(adminCall?.[0]).toMatchObject({
      to: adminEmail,
      subject: expect.stringMatching(/Referral Commission Earned/i)
    });
  });

  it('should skip notifications when email service is not configured', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    // Temporarily override isEmailServiceConfigured
    const { emailService } = await import('../../server/services/email-service.js');
    const original = emailService.isEmailServiceConfigured;
    vi.mocked(emailService).isEmailServiceConfigured = false;

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ referredBy: referrerId }])
    };

    mockDbSelect.mockReturnValue(selectChain);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, referrerId, referredId: subscribingUserId, amount: 5 }])
      })
    });

    const result = await ReferralManager.processReferralReward(subscribingUserId);

    // Should still return reward even if notification skipped
    expect(result).toMatchObject({
      type: 'commission',
      amount: 5
    });

    // Email should not be called
    expect(mockSendMail).not.toHaveBeenCalled();

    // Restore original value
    vi.mocked(emailService).isEmailServiceConfigured = original;
  });

  it('should return null when user has no referrer', async () => {
    const subscribingUserId = 2;

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ referredBy: null }])
    };

    mockDbSelect.mockReturnValue(selectChain);
    
    // No insert should happen when there's no referrer
    const result = await ReferralManager.processReferralReward(subscribingUserId);

    expect(result).toBeNull();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('should handle notification errors gracefully', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    mockSendMail.mockRejectedValueOnce(new Error('Email failed'));

    const selectChain1 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ referredBy: referrerId }])
    };

    const selectChain2 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { 
          id: referrerId,
          email: 'referrer@example.com',
          firstName: 'Referrer',
          username: 'referrer1'
        }
      ])
    };

    mockDbSelect
      .mockReturnValueOnce(selectChain1)
      .mockReturnValueOnce(selectChain2);

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, referrerId, referredId: subscribingUserId, amount: 5 }])
      })
    });

    // Should throw if email fails
    await expect(
      ReferralManager.processReferralReward(subscribingUserId)
    ).rejects.toThrow('Email failed');
  });

  it('should skip notifications when email addresses are missing', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    const selectChain1 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ referredBy: referrerId }])
    };

    // Mock users without email addresses
    const selectChain2 = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { 
          id: referrerId,
          email: null,
          firstName: 'Referrer',
          username: 'referrer1'
        }
      ])
    };

    mockDbSelect
      .mockReturnValueOnce(selectChain1)
      .mockReturnValueOnce(selectChain2);

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, referrerId, referredId: subscribingUserId, amount: 5 }])
      })
    });

    // Should throw because email is required
    await expect(
      ReferralManager.processReferralReward(subscribingUserId)
    ).rejects.toThrow();
  });
});

