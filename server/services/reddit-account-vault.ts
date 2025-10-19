/**
 * Reddit Account Vault Service (Stage 1)
 * Handles encrypted storage and retrieval of Reddit OAuth credentials
 */

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db.js';
import {
  redditAccounts,
  redditAccountAuditLog,
  type InsertRedditAccount,
  type RedditAccount,
  type InsertRedditAccountAuditLog,
} from '@shared/schema';
import { encryptToken, decryptToken, hashToken } from '../lib/encryption.js';
import { logger } from '../bootstrap/logger.js';

export interface RedditOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface RedditUserInfo {
  id: string;
  name: string;
}

export interface LinkRedditAccountParams {
  userId: number;
  tokens: RedditOAuthTokens;
  userInfo: RedditUserInfo;
  scopes: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface DecryptedRedditAccount extends Omit<RedditAccount, 'refreshTokenEncrypted'> {
  refreshToken: string; // Decrypted
}

/**
 * Link a Reddit account to a user
 * Encrypts and stores OAuth tokens
 */
export async function linkRedditAccount(params: LinkRedditAccountParams): Promise<RedditAccount> {
  const { userId, tokens, userInfo, scopes, ipAddress, userAgent } = params;
  
  try {
    // Encrypt refresh token
    const { encrypted: refreshTokenEncrypted, hash: _refreshTokenHash } = encryptToken(tokens.refreshToken);
    
    // Hash access token for leak detection
    const accessTokenHash = hashToken(tokens.accessToken);
    
    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    
    // Check if account already exists
    const existing = await db
      .select()
      .from(redditAccounts)
      .where(eq(redditAccounts.userId, userId))
      .limit(1);
    
    let account: RedditAccount;
    
    if (existing.length > 0) {
      // Update existing account
      const [updated] = await db
        .update(redditAccounts)
        .set({
          refreshTokenEncrypted,
          accessTokenHash,
          redditUsername: userInfo.name,
          redditId: userInfo.id,
          scopes,
          expiresAt,
          lastRotatedAt: new Date(),
          revokedAt: null, // Clear revocation if re-linking
        })
        .where(eq(redditAccounts.id, existing[0].id))
        .returning();
      
      account = updated;
      
      logger.info('[RedditVault] Updated existing Reddit account', {
        userId,
        redditUsername: userInfo.name,
      });
    } else {
      // Create new account
      const [created] = await db
        .insert(redditAccounts)
        .values({
          userId,
          refreshTokenEncrypted,
          accessTokenHash,
          redditUsername: userInfo.name,
          redditId: userInfo.id,
          scopes,
          expiresAt,
        })
        .returning();
      
      account = created;
      
      logger.info('[RedditVault] Linked new Reddit account', {
        userId,
        redditUsername: userInfo.name,
      });
    }
    
    // Audit log
    await logRedditAccountAction({
      userId,
      redditAccountId: account.id,
      action: 'linked',
      metadata: {
        redditUsername: userInfo.name,
        scopes,
      },
      ipAddress,
      userAgent,
    });
    
    return account;
  } catch (error) {
    logger.error('[RedditVault] Failed to link Reddit account', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get decrypted Reddit account for a user
 */
export async function getRedditAccount(userId: number): Promise<DecryptedRedditAccount | null> {
  try {
    const [account] = await db
      .select()
      .from(redditAccounts)
      .where(
        and(
          eq(redditAccounts.userId, userId),
          isNull(redditAccounts.revokedAt)
        )
      )
      .limit(1);
    
    if (!account) {
      return null;
    }
    
    // Decrypt refresh token
    const refreshToken = decryptToken(account.refreshTokenEncrypted);
    
    // Update last used timestamp
    await db
      .update(redditAccounts)
      .set({ lastUsedAt: new Date() })
      .where(eq(redditAccounts.id, account.id));
    
    return {
      ...account,
      refreshToken,
    };
  } catch (error) {
    logger.error('[RedditVault] Failed to get Reddit account', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update access token after refresh
 */
export async function updateAccessToken(
  userId: number,
  newAccessToken: string,
  expiresIn: number
): Promise<void> {
  try {
    const accessTokenHash = hashToken(newAccessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    await db
      .update(redditAccounts)
      .set({
        accessTokenHash,
        expiresAt,
        lastRotatedAt: new Date(),
      })
      .where(eq(redditAccounts.userId, userId));
    
    logger.debug('[RedditVault] Updated access token', { userId });
    
    // Audit log
    await logRedditAccountAction({
      userId,
      action: 'refreshed',
      metadata: { expiresAt },
    });
  } catch (error) {
    logger.error('[RedditVault] Failed to update access token', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Revoke/unlink Reddit account
 */
export async function revokeRedditAccount(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const [account] = await db
      .update(redditAccounts)
      .set({ revokedAt: new Date() })
      .where(eq(redditAccounts.userId, userId))
      .returning();
    
    if (account) {
      logger.info('[RedditVault] Revoked Reddit account', {
        userId,
        redditUsername: account.redditUsername,
      });
      
      // Audit log
      await logRedditAccountAction({
        userId,
        redditAccountId: account.id,
        action: 'revoked',
        ipAddress,
        userAgent,
      });
    }
  } catch (error) {
    logger.error('[RedditVault] Failed to revoke Reddit account', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check if user has a linked Reddit account
 */
export async function hasLinkedRedditAccount(userId: number): Promise<boolean> {
  const [account] = await db
    .select({ id: redditAccounts.id })
    .from(redditAccounts)
    .where(
      and(
        eq(redditAccounts.userId, userId),
        isNull(redditAccounts.revokedAt)
      )
    )
    .limit(1);
  
  return !!account;
}

/**
 * Log Reddit account action to audit trail
 */
async function logRedditAccountAction(params: InsertRedditAccountAuditLog): Promise<void> {
  try {
    await db.insert(redditAccountAuditLog).values(params);
  } catch (error) {
    // Log but don't fail - audit logging shouldn't break functionality
    logger.error('[RedditVault] Failed to log audit action', {
      action: params.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get accounts expiring soon (for background refresh job)
 */
export async function getExpiringAccounts(beforeDate: Date): Promise<RedditAccount[]> {
  return db
    .select()
    .from(redditAccounts)
    .where(
      and(
        isNull(redditAccounts.revokedAt),
        eq(redditAccounts.expiresAt, beforeDate)
      )
    );
}
