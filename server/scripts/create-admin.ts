import { ensureAdminAccount } from '../lib/admin-auth.js';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
async function createAdmin() {
  const result = await ensureAdminAccount();
  if (result.created) {
    logger.error(...formatLogArgs(`✅ Admin user created with email ${result.email}`));
  } else {
    logger.error(...formatLogArgs(`✅ Admin user already exists with email ${result.email}`));
  }
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(...formatLogArgs('Failed to create admin user:', err));
    process.exit(1);
  });