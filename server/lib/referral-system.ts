/**
 * Phase 5: Simplified Referral System
 * Clean, straightforward referral tracking with user-friendly codes
 */

import { db } from '../db';
import { users, referralRewards, referralCodes, eventLogs } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { emailService } from '../services/email-service.js';
import { safeLog } from './logger-utils.js';

const notificationService = {
  sendReferralNotification: async (referrerId: number, referredId: number, rewardAmount: number) => {
    if (!emailService.isEmailServiceConfigured) {
      safeLog('info', 'Email not configured, skipping referral notification', {});
      return { skipped: true };
    }

    try {
      // Get referrer info
      const [referrer] = await db
        .select({ email: users.email, firstName: users.firstName, username: users.username })
        .from(users)
        .where(eq(users.id, referrerId))
        .limit(1);

      // Get referred user info
      const [referred] = await db
        .select({ email: users.email, firstName: users.firstName, username: users.username })
        .from(users)
        .where(eq(users.id, referredId))
        .limit(1);

      if (!referrer?.email || !referred?.email) {
        safeLog('warn', 'Missing email addresses for referral notification', { referrerId, referredId });
        return { skipped: true };
      }

      const referrerName = referrer.firstName || referrer.username || 'User';
      const referredName = referred.firstName || referred.username || 'User';

      // Notify referrer about their reward
      await emailService.sendMail({
        to: referrer.email,
        from: process.env.FROM_EMAIL || '',
        subject: 'You Earned a Referral Reward! 🎉',
        text: `Hi ${referrerName}, great news! ${referredName} just subscribed using your referral link. You've earned $${rewardAmount} in commission!`,
        html: `
          <p>Hi ${referrerName},</p>
          <p>Great news! <strong>${referredName}</strong> just subscribed using your referral link.</p>
          <p>You've earned <strong>$${rewardAmount}</strong> in commission!</p>
          <p>Keep sharing your referral link to earn more rewards.</p>
        `
      });

      // Notify admins about the conversion
      const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL;
      if (adminEmail) {
        await emailService.sendMail({
          to: adminEmail,
          from: process.env.FROM_EMAIL || '',
          subject: 'Referral Conversion',
          text: `Referral conversion: ${referrerName} (ID: ${referrerId}) referred ${referredName} (ID: ${referredId}). Reward: $${rewardAmount}`,
          html: `
            <p><strong>Referral Conversion</strong></p>
            <ul>
              <li>Referrer: ${referrerName} (ID: ${referrerId})</li>
              <li>Referred: ${referredName} (ID: ${referredId})</li>
              <li>Reward: $${rewardAmount}</li>
            </ul>
          `
        });
      }

      safeLog('info', 'Referral notifications sent', { referrerId, referredId, rewardAmount });
      return { sent: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      safeLog('error', 'Failed to send referral notification', { error: errorMessage });
      // Don't throw - notifications are non-critical
      return { skipped: true, error: errorMessage };
    }
  }
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

        const [applicantRecord] = await db
          .select({ id: users.id, referredBy: users.referredBy })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!applicantRecord) {
          return {
            success: false,
            error: 'Applicant not found',
          };
        }

        if (referrer.id === applicantRecord.id) {
          return {
            success: false,
            error: 'Cannot use your own referral code',
          };
        }

        if (applicantRecord.referredBy !== null && applicantRecord.referredBy !== undefined) {
          return {
            success: false,
            error: 'Referral code already applied',
          };
        }

        await db
          .update(users)
          .set({
            referredBy: referrer.id,
          })
          .where(eq(users.id, applicantRecord.id));

        return {
          success: true,
          referrerId: referrer.id,
          pending: false,
        };
      }

      const email = normalizedApplicant.email?.trim().toLowerCase();
      const temporaryUserId = normalizedApplicant.temporaryUserId?.trim();

      if (!temporaryUserId) {
        return {
          success: false,
          error: 'Temporary user identifier is required for anonymous referral applications',
        };
      }

      if (email) {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          return {
            success: false,
            error: 'Please log in to apply a referral code for this account',
          };
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

    } catch (error) {
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
  static async processReferralReward(subscribingUserId: number, subscriptionId?: string): Promise<ReferralReward | null> {
    // Find who referred this user
    const [user] = await db
      .select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, subscribingUserId));

    if (!user?.referredBy) {
      return null; // No referrer
    }

    const rewardAmount = 500; // $5 in cents
    const now = new Date();
    const billingPeriodEnd = new Date(now);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
    
    await db.insert(referralRewards).values({
      referrerId: user.referredBy,
      referredId: subscribingUserId,
      type: 'first_month_bonus',
      amount: rewardAmount,
      month: 1, // First month
      billingPeriodStart: now,
      billingPeriodEnd: billingPeriodEnd,
      status: 'pending',
      subscriptionId: subscriptionId || undefined
    });
    
    // Send notification emails
    await notificationService.sendReferralNotification(user.referredBy, subscribingUserId, rewardAmount);
    
    return {
      type: 'commission',
      amount: rewardAmount,
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