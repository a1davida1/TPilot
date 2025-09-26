import bcrypt from 'bcrypt';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log('✅ Admin user already exists');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

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