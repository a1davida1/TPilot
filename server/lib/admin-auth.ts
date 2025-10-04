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

  const hashedPassword = await resolveAdminPasswordHash(passwordHash);

  if (existing.length > 0) {
    const admin = existing[0];
    
    // Update admin if email or password hash changed
    const needsUpdate = 
      admin.email !== resolvedEmail || 
      admin.username !== username ||
      admin.password !== hashedPassword;

    if (needsUpdate) {
      await db
        .update(users)
        .set({
          email: resolvedEmail,
          username,
          password: hashedPassword,
          isAdmin: true,
          role: 'admin',
          emailVerified: true,
          tier: 'admin',
        })
        .where(eq(users.id, admin.id));
    }

    return { created: false, email: resolvedEmail };
  }

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
  const { email, passwordHash } = getAdminCredentials();

  if (!email || !passwordHash || typeof identifier !== 'string' || typeof password !== 'string') {
    return null;
  }

  if (identifier !== email) {
    return null;
  }

  const matches = await bcrypt.compare(password, passwordHash);
  return matches ? email : null;
};