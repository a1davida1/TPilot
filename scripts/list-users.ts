#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';

async function listUsers() {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      tier: users.tier,
      isAdmin: users.isAdmin
    }).from(users);
    
    console.log('\n📋 Users in database:\n');
    if (allUsers.length === 0) {
      console.log('  (no users found)');
    } else {
      allUsers.forEach(user => {
        console.log(`  • ${user.username} (${user.email})`);
        console.log(`    - ID: ${user.id}, Verified: ${user.emailVerified}, Tier: ${user.tier}, Admin: ${user.isAdmin}`);
      });
    }
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

listUsers();
