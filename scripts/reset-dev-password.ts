#!/usr/bin/env tsx
/**
 * Quick script to reset a user's password in development
 * Usage: tsx scripts/reset-dev-password.ts <username> <newPassword>
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function resetPassword(username: string, newPassword: string) {
  try {
    console.log(`🔐 Resetting password for user: ${username}`);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        emailVerified: true, // Also verify email for dev convenience
        mustChangePassword: false
      })
      .where(eq(users.username, username))
      .returning();
    
    if (result.length === 0) {
      console.error(`❌ User '${username}' not found`);
      process.exit(1);
    }
    
    console.log(`✅ Password reset successfully for ${username}`);
    console.log(`✅ Email marked as verified`);
    console.log(`\nYou can now login with:`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error('Usage: tsx scripts/reset-dev-password.ts <username> <newPassword>');
  console.error('Example: tsx scripts/reset-dev-password.ts admin Admin123');
  process.exit(1);
}

resetPassword(username, newPassword);
