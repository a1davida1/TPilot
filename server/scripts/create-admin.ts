import bcrypt from 'bcrypt';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const passwordHashFromEnv = process.env.ADMIN_PASSWORD_HASH ?? null;
  const passwordForLocalBootstrap = process.env.ADMIN_PASSWORD ?? null;

  if (!passwordHashFromEnv && !passwordForLocalBootstrap) {
    throw new Error(
      'ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD must be set before running create-admin.ts'
    );
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log('✅ Admin user already exists');
    return;
  }

  let hashedPassword: string;
  if (passwordHashFromEnv) {
    hashedPassword = passwordHashFromEnv;
  } else if (passwordForLocalBootstrap) {
    hashedPassword = await bcrypt.hash(passwordForLocalBootstrap, 10);
  } else {
    // Type guard for TypeScript; runtime never reaches here because of the check above.
    throw new Error('Unable to resolve admin password hash');
  }

  await db.insert(users).values({
    email,
    username,
    password: hashedPassword,
    isAdmin: true,
    role: 'admin',
    emailVerified: true,
    tier: 'admin'
  });

  console.log(`✅ Admin user created with email ${email}`);
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create admin user:', err);
    process.exit(1);
  });