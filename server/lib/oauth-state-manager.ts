import crypto from 'crypto';
import type { Request } from 'express';
import { stateStore } from '../services/state-store.js';
import type { AuthRequest } from '../middleware/auth.js';

export const OAUTH_STATE_TTL_SECONDS = 600;
const STATE_PREFIX = 'tpilot';

export type OAuthProvider = 'google' | 'facebook' | 'reddit';
export type OAuthIntent = 'login' | 'signup' | 'link' | 'account-link' | 'posting' | 'intelligence';

export interface OAuthStateData {
  provider: OAuthProvider;
  intent: OAuthIntent | string;
  userId?: number;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface OAuthStateRecord {
  state: string;
  data: OAuthStateData;
}

export class InvalidOAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOAuthStateError';
  }
}

const getStateKey = (state: string) => `oauth_state:${state}`;

function generateStateToken(provider: OAuthProvider): string {
  const randomBytes = crypto.randomBytes(32).toString('base64url');
  return `${STATE_PREFIX}.${provider}.${randomBytes}`;
}

function extractProviderFromState(state: string): OAuthProvider | null {
  if (!state || typeof state !== 'string') {
    return null;
  }
  
  const parts = state.split('.');
  if (parts.length !== 3 || parts[0] !== STATE_PREFIX) {
    return null;
  }
  
  const provider = parts[1];
  if (provider === 'google' || provider === 'facebook' || provider === 'reddit') {
    return provider;
  }
  
  return null;
}

function sanitizeMetadata(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object') {
    return undefined;
  }
  
  const sanitized: Record<string, unknown> = {};
  const raw = meta as Record<string, unknown>;
  
  // Only allow specific safe keys and primitive values
  const allowedKeys = ['redirect', 'returnTo', 'campaign', 'source'];
  
  for (const key of allowedKeys) {
    if (key in raw) {
      const value = raw[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function extractSingleQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

interface CreateOAuthStateOptions {
  intent?: OAuthIntent | string;
  meta?: Record<string, unknown>;
  ttlSeconds?: number;
}

export async function createOAuthState(
  provider: OAuthProvider,
  req: Request | AuthRequest,
  options: CreateOAuthStateOptions = {}
): Promise<OAuthStateRecord> {
  const state = generateStateToken(provider);
  const user = 'user' in req ? req.user : undefined;
  
  const data: OAuthStateData = {
    provider,
    intent: options.intent || (user?.id ? 'link' : 'login'),
    userId: user?.id,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: Date.now(),
    meta: sanitizeMetadata(options.meta)
  };
  
  const ttl = options.ttlSeconds || OAUTH_STATE_TTL_SECONDS;
  const key = getStateKey(state);
  
  await stateStore.set(key, JSON.stringify(data), ttl);
  
  return { state, data };
}

export async function consumeOAuthState(
  provider: OAuthProvider,
  state: string | null
): Promise<OAuthStateRecord> {
  if (!state) {
    throw new InvalidOAuthStateError('Missing state parameter');
  }
  
  const extractedProvider = extractProviderFromState(state);
  if (!extractedProvider) {
    throw new InvalidOAuthStateError('Invalid state format');
  }
  
  if (extractedProvider !== provider) {
    throw new InvalidOAuthStateError('Provider mismatch');
  }
  
  const key = getStateKey(state);
  const raw = await stateStore.get(key);
  
  if (!raw) {
    throw new InvalidOAuthStateError('State not found or expired');
  }
  
  // Delete state immediately after retrieval (one-time use)
  await stateStore.delete(key);
  
  try {
    const data = JSON.parse(raw) as OAuthStateData;
    
    // Validate the stored data matches
    if (data.provider !== provider) {
      throw new InvalidOAuthStateError('Stored provider mismatch');
    }
    
    return { state, data };
  } catch (error) {
    if (error instanceof InvalidOAuthStateError) {
      throw error;
    }
    throw new InvalidOAuthStateError('Invalid state data');
  }
}
