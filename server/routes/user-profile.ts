/**
 * User Profile Management Routes
 * Handles profile updates, preferences, and account management
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db.js';
import { users, userPreferences, deletedAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  notificationEmail: z.string().email().optional()
});

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  showNSFWContent: z.boolean().optional(),
  autoSchedulePosts: z.boolean().optional(),
  defaultSubreddit: z.string().optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  compactMode: z.boolean().optional(),
  showOnboarding: z.boolean().optional(),
  captionStyle: z.enum(['casual', 'flirty', 'professional', 'funny']).optional(),
  watermarkPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const avatarUploadSchema = z.object({
  avatarUrl: z.string().url()
});

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user data and preferences in one query
    const [userData] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        tier: users.tier,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        website: users.website,
        timezone: users.timezone,
        language: users.language,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        postsCount: users.postsCount,
        captionsGenerated: users.captionsGenerated
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user preferences
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const profile = {
      ...userData,
      preferences: prefs || {
        emailNotifications: true,
        pushNotifications: false,
        marketingEmails: false,
        showNSFWContent: true,
        autoSchedulePosts: false,
        theme: 'auto',
        compactMode: false
      }
    };

    logger.info('Profile fetched', { userId });
    return res.json(profile);

  } catch (error) {
    logger.error('Failed to fetch profile', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = updateProfileSchema.parse(req.body);

    // Check if username is taken (if changing)
    if (data.username) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.username, data.username),
          // Not the current user
          eq(users.id, userId) ? undefined : eq(users.username, data.username)
        ))
        .limit(1);

      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    // Check if email is taken (if changing)
    if (data.email) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.email, data.email),
          eq(users.id, userId) ? undefined : eq(users.email, data.email)
        ))
        .limit(1);

      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Update user profile
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        // If email changed, mark as unverified
        emailVerified: data.email ? false : undefined,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        bio: users.bio,
        website: users.website,
        timezone: users.timezone,
        language: users.language
      });

    logger.info('Profile updated', { userId, changes: Object.keys(data) });

    return res.json({ 
      message: 'Profile updated successfully',
      profile: updated
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: error.errors 
      });
    }
    logger.error('Failed to update profile', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/users/avatar
 * Update user avatar (expects Imgur URL)
 */
router.post('/avatar', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = avatarUploadSchema.parse(req.body);

    // Validate it's an Imgur URL
    if (!data.avatarUrl.includes('imgur.com')) {
      return res.status(400).json({ 
        error: 'Avatar must be uploaded to Imgur first' 
      });
    }

    // Update avatar
    const [updated] = await db
      .update(users)
      .set({
        avatarUrl: data.avatarUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        avatarUrl: users.avatarUrl
      });

    logger.info('Avatar updated', { userId, avatarUrl: data.avatarUrl });

    return res.json({ 
      message: 'Avatar updated successfully',
      avatarUrl: updated.avatarUrl
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: error.errors 
      });
    }
    logger.error('Failed to update avatar', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to update avatar' });
  }
});

/**
 * PUT /api/users/preferences
 * Update user preferences
 */
router.put('/preferences', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = updatePreferencesSchema.parse(req.body);

    // Check if preferences exist
    const [existing] = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    let preferences;
    
    if (existing) {
      // Update existing preferences
      [preferences] = await db
        .update(userPreferences)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
    } else {
      // Create new preferences
      [preferences] = await db
        .insert(userPreferences)
        .values({
          userId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }

    logger.info('Preferences updated', { userId, changes: Object.keys(data) });

    return res.json({ 
      message: 'Preferences updated successfully',
      preferences
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: error.errors 
      });
    }
    logger.error('Failed to update preferences', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/users/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = changePasswordSchema.parse(req.body);

    // Get current user
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(data.currentPassword, user.passwordHash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
        // Invalidate all sessions by updating lastPasswordChange
        lastPasswordChange: new Date()
      })
      .where(eq(users.id, userId));

    logger.info('Password changed', { userId });

    return res.json({ 
      message: 'Password changed successfully. Please log in again.',
      requiresReauth: true
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: error.errors 
      });
    }
    logger.error('Failed to change password', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/users/account
 * Delete user account (GDPR compliance)
 */
router.delete('/account', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { password, reason } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!password) {
      return res.status(400).json({ 
        error: 'Password required for account deletion' 
      });
    }

    // Get user
    const [user] = await db
      .select({ 
        passwordHash: users.passwordHash,
        email: users.email,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Start transaction for safe deletion
    await db.transaction(async (tx) => {
      // 1. Archive user data for legal compliance
      await tx.insert(deletedAccounts).values({
        originalUserId: userId,
        email: user.email,
        username: user.username,
        deletionReason: reason || 'User requested',
        deletedAt: new Date()
      });

      // 2. Anonymize user data instead of hard delete
      // This preserves referential integrity
      await tx
        .update(users)
        .set({
          email: `deleted_${userId}@deleted.local`,
          username: `deleted_user_${userId}`,
          passwordHash: 'DELETED',
          bio: null,
          avatarUrl: null,
          website: null,
          stripeCustomerId: null,
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // 3. Delete preferences
      await tx
        .delete(userPreferences)
        .where(eq(userPreferences.userId, userId));
    });

    logger.info('Account deleted', { 
      userId, 
      email: user.email,
      reason 
    });

    return res.json({ 
      message: 'Account successfully deleted. We\'re sorry to see you go.',
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to delete account', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * POST /api/users/export-data
 * Export all user data (GDPR compliance)
 */
router.post('/export-data', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Collect all user data
    const userData = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const preferences = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    // TODO: Add other related data (posts, captions, etc.)

    const exportData = {
      exportDate: new Date().toISOString(),
      user: userData[0],
      preferences: preferences[0],
      // posts: [],
      // captions: [],
      // scheduledPosts: []
    };

    logger.info('Data exported', { userId });

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    return res.json(exportData);

  } catch (error) {
    logger.error('Failed to export data', { error, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to export user data' });
  }
});

export { router as userProfileRouter };
