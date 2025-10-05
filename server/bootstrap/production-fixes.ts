import { eq, or } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { logger } from './logger.js';

/**
 * Production database fixes that run on startup
 * This ensures production environment has correct user tiers and admin access
 */
export async function applyProductionFixes(): Promise<void> {
  try {
    logger.info('🔧 Applying production database fixes...');

    // Fix 1: Ensure a1davida1 is Pro tier with verified email
    await ensureUserTier('a1davida1', 'pro');
    
    // Fix 2: Ensure a1davida1 email is verified
    await ensureEmailVerified('a1davida1');

    logger.info('✅ Production database fixes completed');
  } catch (error) {
    logger.error('❌ Failed to apply production fixes', { error });
    // Don't throw - we don't want to crash the server on startup
  }
}

async function ensureUserTier(
  usernameOrEmail: string,
  targetTier: 'free' | 'starter' | 'pro' | 'admin'
): Promise<void> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, usernameOrEmail),
          eq(users.email, usernameOrEmail)
        )
      )
      .limit(1);

    if (user.length === 0) {
      logger.warn(`User ${usernameOrEmail} not found, skipping tier upgrade`);
      return;
    }

    const currentTier = user[0].tier;
    if (currentTier === targetTier) {
      logger.info(`User ${usernameOrEmail} already has tier: ${targetTier}`);
      return;
    }

    await db
      .update(users)
      .set({ tier: targetTier })
      .where(eq(users.id, user[0].id));

    logger.info(`✅ Upgraded ${usernameOrEmail} from ${currentTier} to ${targetTier}`);
  } catch (error) {
    logger.error(`Failed to ensure tier for ${usernameOrEmail}`, { error });
  }
}

async function ensureEmailVerified(usernameOrEmail: string): Promise<void> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, usernameOrEmail),
          eq(users.email, usernameOrEmail)
        )
      )
      .limit(1);

    if (user.length === 0) {
      logger.warn(`User ${usernameOrEmail} not found, skipping email verification`);
      return;
    }

    if (user[0].emailVerified) {
      logger.info(`User ${usernameOrEmail} email already verified`);
      return;
    }

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user[0].id));

    logger.info(`✅ Verified email for ${usernameOrEmail}`);
  } catch (error) {
    logger.error(`Failed to verify email for ${usernameOrEmail}`, { error });
  }
}
