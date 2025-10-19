/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM with ENV-based keys
 */

import crypto from 'crypto';
import { logger } from '../bootstrap/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

interface EncryptionResult {
  encrypted: string; // Base64 encoded: salt:iv:authTag:ciphertext
  hash: string; // SHA-256 hash for leak detection
}

/**
 * Get encryption key from environment
 * Falls back to generating one for development
 */
function getEncryptionKey(): Buffer {
  let key = process.env.REDDIT_ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDDIT_ENCRYPTION_KEY must be set in production');
    }
    
    // Generate random key for development
    logger.warn('[Encryption] No REDDIT_ENCRYPTION_KEY found, generating random key for development');
    key = crypto.randomBytes(32).toString('hex');
  }
  
  // Derive 256-bit key using PBKDF2
  const salt = Buffer.from('thottopilot-reddit-vault', 'utf8'); // Static salt for key derivation
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive text (e.g., refresh token)
 */
export function encryptToken(plaintext: string): EncryptionResult {
  try {
    const key = getEncryptionKey();
    
    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: salt:iv:authTag:ciphertext
    const combined = `${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    
    // Generate hash for leak detection
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    
    return {
      encrypted: combined,
      hash
    };
  } catch (error) {
    logger.error('[Encryption] Failed to encrypt token', { error });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive text
 */
export function decryptToken(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    
    // Split components
    const parts = encrypted.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted format');
    }
    
    const [_saltB64, ivB64, authTagB64, ciphertext] = parts;
    
    // Decode from base64
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('[Encryption] Failed to decrypt token', { error });
    throw new Error('Decryption failed');
  }
}

/**
 * Hash text for comparison (e.g., access token leak detection)
 */
export function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Verify if plaintext matches hash
 */
export function verifyTokenHash(plaintext: string, hash: string): boolean {
  const computed = hashToken(plaintext);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

/**
 * Generate secure random state for OAuth
 */
export function generateSecureState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate PKCE verifier and challenge
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  
  return { verifier, challenge };
}
