/**
 * Phase 5: Simplified Referral System
 * Clean, straightforward referral tracking with user-friendly codes
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

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

export class ReferralManager {
  /**
   * Generate a unique referral code for a user
   */
  static async generateReferralCode(userId: string): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = generateReferralCode();
      
      // Check if code already exists
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCodeId, code))
        .limit(1);

      if (existing.length === 0) {
        // Update user with the new referral code
        await db
          .update(users)
          .set({ referralCodeId: code })
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
  static async getUserReferralCode(userId: string): Promise<string> {
    const [user] = await db
      .select({ referralCodeId: users.referralCodeId })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error('User not found');
    }

    if (user.referralCodeId) {
      return user.referralCodeId;
    }

    // Generate new code if user doesn't have one
    return await this.generateReferralCode(userId);
  }

  /**
   * Apply referral code when user signs up
   */
  static async applyReferralCode(newUserId: string, referralCode: string): Promise<{
    success: boolean;
    referrerId?: string;
    error?: string;
  }> {
    try {
      // Find the referrer
      const [referrer] = await db
        .select({ id: users.id, subscriptionStatus: users.subscriptionStatus })
        .from(users)
        .where(eq(users.referralCodeId, referralCode));

      if (!referrer) {
        return {
          success: false,
          error: 'Invalid referral code',
        };
      }

      // Check if new user is trying to refer themselves
      if (referrer.id === newUserId) {
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
          updatedAt: new Date(),
        })
        .where(eq(users.id, newUserId));

      return {
        success: true,
        referrerId: referrer.id,
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
  static async getReferralInfo(userId: string): Promise<ReferralInfo> {
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
  static async getReferredUsers(userId: string): Promise<Array<{
    id: string;
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
  static async processReferralReward(subscribingUserId: string): Promise<ReferralReward | null> {
    // Find who referred this user
    const [user] = await db
      .select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, subscribingUserId));

    if (!user?.referredBy) {
      return null; // No referrer
    }

    // In a real implementation, you would:
    // 1. Credit the referrer's account
    // 2. Send notification
    // 3. Update referral tracking metrics

    // For now, return the reward that would be given
    return {
      type: 'commission',
      amount: 5, // $5 commission
      description: 'Referral commission for successful subscription',
    };
  }

  /**
   * Generate referral link for sharing
   */
  static async generateReferralLink(userId: string, baseUrl: string): Promise<string> {
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
    userId: string;
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