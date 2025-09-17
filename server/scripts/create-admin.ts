import { storage } from '../storage.js';
import bcrypt from 'bcrypt';

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername('admin');
    if (existingAdmin) {
      console.log('Admin user already exists with ID:', existingAdmin.id);
      return existingAdmin;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('Admin123!*', 10);

    const adminUser = await storage.createUser({
      username: 'admin',
      email: 'admin@thottopilot.com',
      password: hashedPassword,
      tier: 'admin',
      role: 'admin',
      isAdmin: true,
      emailVerified: true
    });

    console.log('Admin user created successfully:', adminUser);
    return adminUser;
  } catch (error) {
    console.error('Failed to create admin user:', error);

    // Try to find existing admin by email as fallback
    try {
      const existingByEmail = await storage.getUserByEmail('admin@thottopilot.com');
      if (existingByEmail) {
        console.log('Found existing admin by email:', existingByEmail.id);
        return existingByEmail;
      }
    } catch (e) {
      // Ignore fallback error
    }

    process.exit(1);
  }
}

// Check if this script is being run directly (ES module equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}`) {
  createAdmin().then(() => {
    console.log('Admin setup complete');
    process.exit(0);
  });
}

export { createAdmin };