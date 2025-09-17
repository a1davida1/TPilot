
import { storage } from '../storage.js';

async function deleteAdmin() {
  try {
    console.log('Looking for existing admin user...');
    const existingAdmin = await storage.getUserByUsername('admin');
    
    if (existingAdmin) {
      console.log('Found admin user with ID:', existingAdmin.id);
      await storage.deleteUser(existingAdmin.id);
      console.log('Admin user deleted successfully');
    } else {
      console.log('No admin user found to delete');
    }
  } catch (error) {
    console.error('Failed to delete admin user:', error);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deleteAdmin().then(() => {
    console.log('Admin deletion complete');
    process.exit(0);
  });
}

export { deleteAdmin };
