import bcrypt from 'bcrypt';
import { eq, or } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '@shared/schema';

export interface AdminCredentials {
  email: string | null;
  passwordHash: string | null;
}

export interface EnsureAdminAccountResult {
  created: boolean;
  email: string;
}

export const getAdminCredentials = (): AdminCredentials => {
  return {
    email: process.env.ADMIN_EMAIL ?? null,
    passwordHash: process.env.ADMIN_PASSWORD_HASH ?? null,
  };
};

const DEFAULT_ADMIN_EMAIL = 'admin@thottopilot.com';
const DEFAULT_ADMIN_USERNAME = 'admin';

async function resolveAdminPasswordHash(passwordHashFromEnv: string | null): Promise<string> {
  if (passwordHashFromEnv) {
    return passwordHashFromEnv;
  }
  const fallbackPassword = process.env.ADMIN_PASSWORD ?? null;
  if (!fallbackPassword) {
    throw new Error(
      'ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD must be set to bootstrap the admin account',
    );
  }
  return bcrypt.hash(fallbackPassword, 10);
}

export const ensureAdminAccount = async (): Promise<EnsureAdminAccountResult> => {
  const { email, passwordHash } = getAdminCredentials();
  const resolvedEmail = email ?? DEFAULT_ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME;

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.email, resolvedEmail), eq(users.username, username)))
    .limit(1);

  if (existing.length > 0) {
    const admin = existing[0];
    
    // Only update email, username, and admin flags - NEVER update password hash
    // Password updates should only happen through explicit password change flows
    const needsUpdate = 
      admin.email !== resolvedEmail || 
      admin.username !== username ||
      !admin.isAdmin ||
      admin.role !== 'admin' ||
      admin.tier !== 'admin';

    if (needsUpdate) {
      await db
        .update(users)
        .set({
          email: resolvedEmail,
          username,
          isAdmin: true,
          role: 'admin',
          emailVerified: true,
          tier: 'admin',
        })
        .where(eq(users.id, admin.id));
    }

    return { created: false, email: resolvedEmail };
  }

  // Only hash password when creating NEW admin account
  const hashedPassword = await resolveAdminPasswordHash(passwordHash);

  await db.insert(users).values({
    email: resolvedEmail,
    username,
    password: hashedPassword,
    isAdmin: true,
    role: 'admin',
    emailVerified: true,
    tier: 'admin',
  });

  return { created: true, email: resolvedEmail };
};

export const verifyAdminCredentials = async (
  identifier: string | undefined,
  password: string | undefined
): Promise<string | null> => {
  if (typeof identifier !== 'string' || typeof password !== 'string') {
    return null;
  }

  const { email: adminEmail } = getAdminCredentials();
  const adminPassword = process.env.ADMIN_PASSWORD ?? null;

  // Must have admin credentials configured
  if (!adminEmail || !adminPassword) {
    return null;
  }

  // Check if identifier matches admin email or username
  const adminUsername = process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME;
  const isAdminIdentifier = identifier === adminEmail || identifier === adminUsername;

  if (!isAdminIdentifier) {
    return null;
  }

  // Compare password with ADMIN_PASSWORD from env
  const matches = password === adminPassword;
  return matches ? adminEmail : null;
};