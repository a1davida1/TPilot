
import { storage } from '../storage.js';
import bcrypt from 'bcrypt';

async function createTestUser() {
  try {
    const testUsername = 'testuser';
    const testEmail = 'testuser@example.com';
    const testPassword = 'TestUser123!'; // Meets caps and symbols requirements
    
    // Check if test user already exists
    const existingUser = await storage.getUserByUsername(testUsername);
    if (existingUser) {
      console.log('Test user already exists with ID:', existingUser.id);
      console.log('Email:', testEmail);
      console.log('Password:', testPassword);
      return existingUser;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const testUser = await storage.createUser({
      username: testUsername,
      email: testEmail,
      password: hashedPassword,
      tier: 'free',
      role: 'user',
      isAdmin: false,
      emailVerified: true // Pre-verified for testing
    });

    console.log('✅ Test user created successfully!');
    console.log('Username:', testUsername);
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('User ID:', testUser.id);
    console.log('Email Verified:', true);
    
    return testUser;
  } catch (error) {
    console.error('Failed to create test user:', error);

    // Try to find existing test user by email as fallback
    try {
      const existingByEmail = await storage.getUserByEmail('testuser@example.com');
      if (existingByEmail) {
        console.log('Found existing test user by email:', existingByEmail.id);
        return existingByEmail;
      }
    } catch (e) {
      // Ignore fallback error
    }

    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUser().then(() => {
    console.log('Test user setup complete');
    process.exit(0);
  });
}

export { createTestUser };
