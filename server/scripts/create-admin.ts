import { ensureAdminAccount } from '../lib/admin-auth.js';

async function createAdmin() {
  const result = await ensureAdminAccount();
  if (result.created) {
    console.error(`✅ Admin user created with email ${result.email}`);
  } else {
    console.error(`✅ Admin user already exists with email ${result.email}`);
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to create admin user:', err);
    process.exit(1);
  });