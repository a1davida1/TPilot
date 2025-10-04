import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReferralManager } from '../../server/lib/referral-system.js';
import { db } from '../../server/db.js';
import { users, referralRewards } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock dependencies
vi.mock('../../server/db.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  }
}));

vi.mock('../../server/services/email-service.js', () => ({
  emailService: {
    isEmailServiceConfigured: true,
    sendMail: vi.fn().mockResolvedValue({ sent: true })
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

    // Mock user lookup for subscribing user
    const mockDb = vi.mocked(db);
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            { email: 'referrer@example.com', firstName: 'Referrer', username: 'referrer1' }
          ])
        })
      })
    });

    // First call: get subscribing user's referredBy
    const selectMock1 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ referredBy: referrerId }])
      })
    });

    // Second call: get referrer info
    const selectMock2 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            { email: 'referrer@example.com', firstName: 'Referrer', username: 'referrer1' }
          ])
        })
      })
    });

    // Third call: get referred user info
    const selectMock3 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            { email: 'subscriber@example.com', firstName: 'Subscriber', username: 'subscriber1' }
          ])
        })
      })
    });

    mockDb.select = vi.fn()
      .mockReturnValueOnce(selectMock1())
      .mockReturnValueOnce(selectMock2())
      .mockReturnValueOnce(selectMock3());

    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    const { emailService } = await import('../../server/services/email-service.js');
    
    const result = await ReferralManager.processReferralReward(subscribingUserId);

    expect(result).toMatchObject({
      type: 'commission',
      amount: 5,
      description: 'Referral commission for successful subscription'
    });

    // Should call email service for both referrer and admin
    expect(emailService.sendMail).toHaveBeenCalled();
  });

  it('should skip notifications when email service is not configured', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    // Mock unconfigured email service
    const { emailService } = await import('../../server/services/email-service.js');
    vi.mocked(emailService).isEmailServiceConfigured = false;

    const mockDb = vi.mocked(db);
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ referredBy: referrerId }])
      })
    });

    mockDb.select = vi.fn().mockReturnValue(selectMock());
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    const result = await ReferralManager.processReferralReward(subscribingUserId);

    // Should still return reward even if notification skipped
    expect(result).toMatchObject({
      type: 'commission',
      amount: 5
    });

    // Email should not be called
    expect(emailService.sendMail).not.toHaveBeenCalled();
  });

  it('should return null when user has no referrer', async () => {
    const subscribingUserId = 2;

    const mockDb = vi.mocked(db);
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ referredBy: null }])
      })
    });

    mockDb.select = vi.fn().mockReturnValue(selectMock());

    const result = await ReferralManager.processReferralReward(subscribingUserId);

    expect(result).toBeNull();
  });

  it('should handle notification errors gracefully', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    const { emailService } = await import('../../server/services/email-service.js');
    vi.mocked(emailService).isEmailServiceConfigured = true;
    vi.mocked(emailService.sendMail).mockRejectedValueOnce(new Error('Email failed'));

    const mockDb = vi.mocked(db);
    const selectMock1 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ referredBy: referrerId }])
      })
    });

    const selectMock2 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            { email: 'referrer@example.com', firstName: 'Referrer', username: 'referrer1' }
          ])
        })
      })
    });

    mockDb.select = vi.fn()
      .mockReturnValueOnce(selectMock1())
      .mockReturnValueOnce(selectMock2());

    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    // Should not throw even if email fails
    const result = await ReferralManager.processReferralReward(subscribingUserId);
    
    expect(result).toMatchObject({
      type: 'commission',
      amount: 5
    });
  });

  it('should skip notifications when email addresses are missing', async () => {
    const subscribingUserId = 2;
    const referrerId = 1;

    const mockDb = vi.mocked(db);
    const selectMock1 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ referredBy: referrerId }])
      })
    });

    // Mock users without email addresses
    const selectMock2 = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            { email: null, firstName: 'Referrer', username: 'referrer1' }
          ])
        })
      })
    });

    mockDb.select = vi.fn()
      .mockReturnValueOnce(selectMock1())
      .mockReturnValueOnce(selectMock2());

    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    const { emailService } = await import('../../server/services/email-service.js');
    vi.mocked(emailService).isEmailServiceConfigured = true;

    const result = await ReferralManager.processReferralReward(subscribingUserId);

    // Should still complete successfully
    expect(result).toMatchObject({
      type: 'commission',
      amount: 5
    });

    // Email should be attempted but skipped due to missing addresses
    const { safeLog } = await import('../../server/lib/logger-utils.js');
    expect(safeLog).toHaveBeenCalledWith(
      'warn',
      'Missing email addresses for referral notification',
      expect.any(Object)
    );
  });
});
