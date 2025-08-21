
import { db } from './db.js';
import { users } from '@shared/schema.js';
import { eq } from 'drizzle-orm';

export async function seedDemoUser() {
  try {
    // Check if demo user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, 1))
      .limit(1);

    if (existingUser) {
      console.log('✅ Demo user already exists');
      return existingUser;
    }

    // Create demo user
    const [demoUser] = await db
      .insert(users)
      .values({
        email: 'demo@thottopilot.com',
        username: 'demo',
        password: '$2b$10$dummy.hash.for.demo.user.only',
      })
      .returning();

    console.log('✅ Demo user created successfully');
    return demoUser;

  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      console.log('✅ Demo user already exists (constraint)');
      return null;
    }
    console.error('Failed to seed demo user:', error);
    throw error;
  }
}
