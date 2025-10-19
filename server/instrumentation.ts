// Load environment variables FIRST - before any other imports
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import { initializeSentry } from './bootstrap/sentry.js';
  initializeSentry();
