/**
 * Phase 5: Simplified Referral System
 * Clean, straightforward referral tracking with user-friendly codes
 */

import { db } from '../db';
import { users, referralRewards, referralCodes, eventLogs } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
// TODO: implement real notification service
const notificationService = {
  sendReferralNotification: async () => ({ skipped: true })
};

// Generate user-friendly referral codes (no confusing characters)
const generateReferralCode = customAlphabet('ABCDEFGHIJKLMNPQRSTUVWXYZ123456789', 8);

export interface ReferralInfo {
  code: string;
  totalReferrals: number;
  activeReferrals: number;
  totalCommission: number;
  conversionRate: number;
}

export interface ReferralReward {
  type: 'commission' | 'bonus_storage' | 'free_month';
  amount: number;
  description: string;
}

export interface ReferralApplicant {
  userId?: number;
  email?: string;
  temporaryUserId?: string;
}

interface ReferralApplicationResult {
  success: boolean;
  referrerId?: number;
  pending?: boolean;
  error?: string;
}

export class ReferralManager {
  /**
   * Generate a unique referral code for a user
   */
  static async generateReferralCode(userId: number): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    const [existingUserCode] = await db
      .select({
        id: referralCodes.id,
        code: referralCodes.code,
      })
      .from(referralCodes)
      .where(eq(referralCodes.ownerId, userId))
      .limit(1);

    if (existingUserCode) {
      await db
        .update(users)
        .set({ referralCodeId: existingUserCode.id })
        .where(eq(users.id, userId));

      return existingUserCode.code;
    }

    while (attempts < maxAttempts) {
      const code = generateReferralCode();

      const [existingCode] = await db
        .select({ id: referralCodes.id })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      if (!existingCode) {
        const [newCode] = await db
          .insert(referralCodes)
          .values({ code, ownerId: userId })
          .returning({ id: referralCodes.id });

        await db
          .update(users)
          .set({ referralCodeId: newCode.id })
          .where(eq(users.id, userId));

        return code;
      }

      attempts++;
    }

    throw new Error('Unable to generate unique referral code');
  }

  /**
   * Get or create referral code for a user
   */
  static async getUserReferralCode(userId: number): Promise<string> {
    const [user] = await db
      .select({
        referralCodeId: users.referralCodeId,
        code: referralCodes.code,
      })
      .from(users)
      .leftJoin(referralCodes, eq(users.referralCodeId, referralCodes.id))
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error('User not found');
    }

    if (user.code) {
      return user.code;
    }

    // Generate new code if user doesn't have one
    return await this.generateReferralCode(userId);
  }

  /**
   * Apply referral code when user signs up
   */
  static async applyReferralCode(applicant: number | ReferralApplicant, referralCode: string): Promise<ReferralApplicationResult> {
    try {
      const normalizedApplicant: ReferralApplicant = typeof applicant === 'number' ? { userId: applicant } : applicant;

      if (!normalizedApplicant || Object.keys(normalizedApplicant).length === 0) {
        return {
          success: false,
          error: 'Applicant information is required',
        };
      }

      const sanitizedCode = referralCode.trim().toUpperCase();

      // Find the referrer
      const [codeRecord] = await db
        .select({
          id: referralCodes.id,
          ownerId: referralCodes.ownerId,
        })
        .from(referralCodes)
        .where(eq(referralCodes.code, sanitizedCode))
        .limit(1);

      if (!codeRecord?.ownerId) {
        return {
          success: false,
          error: 'Invalid referral code',
        };
      }

      const referrerId = codeRecord.ownerId;

      const [referrer] = await db
        .select({ id: users.id, subscriptionStatus: users.subscriptionStatus })
        .from(users)
        .where(eq(users.id, referrerId))
        .limit(1);

      if (!referrer) {
        return {
          success: false,
          error: 'Referrer not found',
        };
      }

      if (normalizedApplicant.userId !== undefined) {
        const { userId } = normalizedApplicant;

        if (!Number.isInteger(userId) || userId <= 0) {
          return {
            success: false,
            error: 'Invalid user identifier',
          };
        }

        // Check if new user is trying to refer themselves
        if (referrer.id === userId) {
          return {
            success: false,
            error: 'Cannot use your own referral code',
          };
        }

        // Update new user with referrer information
        await db
          .update(users)
          .set({
            referredBy: referrer.id,
          })
          .where(eq(users.id, userId));

        return {
          success: true,
          referrerId: referrer.id,
          pending: false,
        };
      }

      const email = normalizedApplicant.email?.trim().toLowerCase();
      const temporaryUserId = normalizedApplicant.temporaryUserId?.trim();

      if (!email && !temporaryUserId) {
        return {
          success: false,
          error: 'Applicant identifier is required',
        };
      }

      if (email) {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          return await this.applyReferralCode(existingUser.id, sanitizedCode);
        }
      }

      await db.insert(eventLogs).values({
        userId: null,
        type: 'referral.pending',
        meta: {
          referralCode: sanitizedCode,
          referrerId: referrer.id,
          applicant: {
            email: email ?? null,
            temporaryUserId: temporaryUserId ?? null,
          },
          recordedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        referrerId: referrer.id,
        pending: true,
      };

    } catch (_error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply referral code',
      };
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralInfo(userId: number): Promise<ReferralInfo> {
    // Get user's referral code
    const code = await this.getUserReferralCode(userId);

    // Count total referrals
    const [stats] = await db
      .select({
        totalReferrals: sql<number>`COUNT(*)`.as('totalReferrals'),
        activeReferrals: sql<number>`COUNT(*) FILTER (WHERE subscription_status IS NOT NULL AND subscription_status != 'inactive')`.as('activeReferrals'),
      })
      .from(users)
      .where(eq(users.referredBy, userId));

    const totalReferrals = Number(stats?.totalReferrals || 0);
    const activeReferrals = Number(stats?.activeReferrals || 0);

    // Calculate conversion rate
    const conversionRate = totalReferrals > 0 ? activeReferrals / totalReferrals : 0;

    // Calculate total commission (simplified: $5 per active referral)
    const totalCommission = activeReferrals * 5;

    return {
      code,
      totalReferrals,
      activeReferrals,
      totalCommission,
      conversionRate,
    };
  }

  /**
   * Get all users referred by a specific user
   */
  static async getReferredUsers(userId: number): Promise<Array<{
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    subscriptionStatus: string | null;
    createdAt: Date | null;
  }>> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.referredBy, userId));
  }

  /**
   * Process referral rewards when a referred user subscribes
   */
  static async processReferralReward(subscribingUserId: number): Promise<ReferralReward | null> {
    // Find who referred this user
    const [user] = await db
      .select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, subscribingUserId));

    if (!user?.referredBy) {
      return null; // No referrer
    }

    await db.insert(referralRewards).values({
      referrerId: user.referredBy,
      referredId: subscribingUserId,
      amount: 5,
    });
    await notificationService.sendReferralNotification();
    return {
      type: 'commission',
      amount: 5,
      description: 'Referral commission for successful subscription',
    };
  }

  /**
   * Generate referral link for sharing
   */
  static async generateReferralLink(userId: number, baseUrl: string): Promise<string> {
    const code = await this.getUserReferralCode(userId);
    return `${baseUrl}/register?ref=${code}`;
  }

  /**
   * Validate referral code format
   */
  static isValidReferralCode(code: string): boolean {
    // 8 characters, alphanumeric (excluding confusing characters)
    return /^[A-Z0-9]{8}$/.test(code);
  }

  /**
   * Get referral leaderboard (top referrers)
   */
  static async getReferralLeaderboard(limit: number = 10): Promise<Array<{
    userId: number;
    firstName: string | null;
    totalReferrals: number;
    activeReferrals: number;
    rank: number;
  }>> {
    const results = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        totalReferrals: sql<number>`COUNT(referrals.id)`.as('totalReferrals'),
        activeReferrals: sql<number>`COUNT(referrals.id) FILTER (WHERE referrals.subscription_status IS NOT NULL AND referrals.subscription_status != 'inactive')`.as('activeReferrals'),
      })
      .from(users)
      .leftJoin(sql`users AS referrals`, sql`referrals.referred_by = users.id`)
      .groupBy(users.id, users.firstName)
      .having(sql`COUNT(referrals.id) > 0`)
      .orderBy(sql`COUNT(referrals.id) DESC`)
      .limit(limit);

    return results.map((result, index) => ({
      ...result,
      totalReferrals: Number(result.totalReferrals),
      activeReferrals: Number(result.activeReferrals),
      rank: index + 1,
    }));
  }
}