import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectMock = vi.fn();
const updateMock = vi.fn();
const updateSetCalls: Array<Record<string, unknown>> = [];

vi.mock('../../../server/db', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: vi.fn(),
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
    updateSetCalls.splice(0, updateSetCalls.length);

    updateMock.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        updateSetCalls.push(values);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      },
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
      .mockReturnValueOnce(createSelectChain([{ id: referrerId, subscriptionStatus: 'active' }]));

    const { ReferralManager } = await import('../../../server/lib/referral-system.ts');

    const result = await ReferralManager.applyReferralCode(applicantId, ' shareme ');

    expect(result).toEqual({ success: true, referrerId, pending: false });
    expect(updateSetCalls).toHaveLength(1);
    expect(updateSetCalls[0]).toEqual({ referredBy: referrerId });
    expect(Object.prototype.hasOwnProperty.call(updateSetCalls[0], 'createdAt')).toBe(false);
  });
});
