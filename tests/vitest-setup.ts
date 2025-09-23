import dotenv from 'dotenv';
import { beforeEach } from 'vitest';

// Load .env.test file specifically for vitest tests
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not present
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://thottopilot.com';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://user:pass@localhost:5432/thottopilot_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-1234567890-abcdef';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-key-1234567890abcd';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || 'test-google-genai-api-key';
process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'test-reddit-client-id';
process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'test-reddit-client-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123456789012345678901234567890';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123456789012345678901234567890';
process.env.STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2023-10-16';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$CwTycUXWue0Thq9StjUM0uJ8e3obK/QGaGL3hXhN3kLBXjg5eQ8F.';
process.env.NODE_ENV = 'test';

// Clean up between tests
beforeEach(() => {
  // Reset any global state here if needed
});
import dotenv from 'dotenv';
import { beforeEach } from 'vitest';
import { Assertion, util as chaiUtils } from 'chai';

Assertion.overwriteChainableMethod(
  'contain',
  (_super) =>
    function patchedContain(this: Assertion, expected: unknown) {
      if (
        expected &&
        typeof expected === 'object' &&
        'asymmetricMatch' in (expected as Record<string, unknown>) &&
        typeof (expected as { asymmetricMatch?: unknown }).asymmetricMatch === 'function'
      ) {
        const actual = chaiUtils.flag(this, 'object');
        const entries = typeof actual === 'string' ? [actual] : Array.from(actual ?? []);
        const matcher = expected as { asymmetricMatch: (value: unknown) => boolean };
        const pass = entries.some(entry => matcher.asymmetricMatch(entry));
        this.assert(pass, 'expected #{this} to contain #{exp}', 'expected #{this} not to contain #{exp}', expected, actual);
        return;
      }

      _super.call(this, expected);
    },
  (_super) => function chained(this: Assertion) {
    _super.call(this);
  }
);

// Load .env.test file specifically for vitest tests
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not present
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://thottopilot.com';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://user:pass@localhost:5432/thottopilot_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-1234567890-abcdef';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-key-1234567890abcd';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || 'test-google-genai-api-key';
process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'test-reddit-client-id';
process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'test-reddit-client-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123456789012345678901234567890';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123456789012345678901234567890';
process.env.STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2023-10-16';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$CwTycUXWue0Thq9StjUM0uJ8e3obK/QGaGL3hXhN3kLBXjg5eQ8F.';
process.env.NODE_ENV = 'test';

// Clean up between tests
beforeEach(() => {
  // Reset any global state here if needed
});
