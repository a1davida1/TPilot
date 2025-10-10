import { ensureAdminAccount } from '../lib/admin-auth.js';
import { logger } from '../bootstrap/logger.js';

async function createAdmin() {
  const result = await ensureAdminAccount();
  if (result.created) {
    logger.error(`✅ Admin user created with email ${result.email}`);
  } else {
    logger.error(`✅ Admin user already exists with email ${result.email}`);
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Failed to create admin user:', err);
    process.exit(1);
  });