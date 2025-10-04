import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const updateSetCalls: Array<Record<string, unknown>> = [];

vi.mock('../../../server/db', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
  },
}));

const createSelectChain = <T>(rows: T[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

describe('ReferralManager.applyReferralCode', () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    insertMock.mockReset();
    updateSetCalls.splice(0, updateSetCalls.length);

    updateMock.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        updateSetCalls.push(values);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    insertMock.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets referredBy without mutating createdAt when a referral is applied', async () => {
    const referrerId = 42;
    const applicantId = 77;

    selectMock
      .mockReturnValueOnce(createSelectChain([{ id: 1, ownerId: referrerId }]))
      .mockReturnValueOnce(createSelectChain([{ id: referrerId, subscriptionStatus: 'active' }]))
      .mockReturnValueOnce(createSelectChain([{ id: applicantId, referredBy: null }]));

    const { ReferralManager } = await import('../../../server/lib/referral-system.ts');

    const result = await ReferralManager.applyReferralCode(applicantId, ' shareme ');

    expect(result).toEqual({ success: true, referrerId, pending: false });
    expect(updateSetCalls).toHaveLength(1);
    expect(updateSetCalls[0]).toEqual({ referredBy: referrerId });
    expect(Object.prototype.hasOwnProperty.call(updateSetCalls[0], 'createdAt')).toBe(false);
  });

  it('prevents referral override when applicant already has a referrer', async () => {
    const referrerId = 7;
    const applicantId = 33;

    selectMock
      .mockReturnValueOnce(createSelectChain([{ id: 2, ownerId: referrerId }]))
      .mockReturnValueOnce(createSelectChain([{ id: referrerId, subscriptionStatus: 'active' }]))
      .mockReturnValueOnce(createSelectChain([{ id: applicantId, referredBy: 99 }]));

    const { ReferralManager } = await import('../../../server/lib/referral-system.ts');

    const result = await ReferralManager.applyReferralCode(applicantId, 'referone');

    expect(result).toEqual({ success: false, error: 'Referral code already applied' });
    expect(updateSetCalls).toHaveLength(0);
  });

  it('rejects anonymous referral applications when the email belongs to an existing account', async () => {
    const referrerId = 13;

    selectMock
      .mockReturnValueOnce(createSelectChain([{ id: 3, ownerId: referrerId }]))
      .mockReturnValueOnce(createSelectChain([{ id: referrerId, subscriptionStatus: 'active' }]))
      .mockReturnValueOnce(createSelectChain([{ id: 88 }]));

    const { ReferralManager } = await import('../../../server/lib/referral-system.ts');

    const result = await ReferralManager.applyReferralCode({
      email: 'taken@example.com',
      temporaryUserId: 'temp-01',
    }, ' refme ');

    expect(result).toEqual({
      success: false,
      error: 'Please log in to apply a referral code for this account',
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
