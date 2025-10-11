#!/usr/bin/env tsx
/**
 * Script to create an admin user for development/testing
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  const username = 'admin';
  const email = 'admin@example.com';
  const password = 'Admin123456!';
  
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  
  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the admin user
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        password: hashedPassword,
        passwordHash: hashedPassword,
        role: 'admin',
        isAdmin: true,
        tier: 'premium',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        postsCount: 0,
        captionsGenerated: 0,
      })
      .returning();
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', email);
    console.log('👤 Username:', username);
    console.log('🔑 Password:', password);
    console.log('🆔 User ID:', newUser.id);
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

createAdminUser();
