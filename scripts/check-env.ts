
#!/usr/bin/env tsx

interface VariableSpec {
  key: string;
  description: string;
  required: boolean;
}

type CategoryKey =
  | 'core'
  | 'security'
  | 'database'
  | 'queue'
  | 'ai'
  | 'payments'
  | 'media'
  | 'email'
  | 'analytics';

interface CategorySpec {
  label: string;
  variables: VariableSpec[];
}

const categories: Record<CategoryKey, CategorySpec> = {
  core: {
    label: 'Core runtime',
    variables: [
      { key: 'NODE_ENV', description: 'Deployment mode', required: true },
      { key: 'APP_BASE_URL', description: 'Public application URL', required: true },
      { key: 'PORT', description: 'Listening port', required: true },
      { key: 'CRON_TZ', description: 'Timezone for schedulers', required: true },
    ],
  },
  security: {
    label: 'Security secrets',
    variables: [
      { key: 'JWT_SECRET', description: 'JWT signing secret', required: true },
      { key: 'SESSION_SECRET', description: 'Session encryption secret', required: true },
      { key: 'TURNSTILE_SITE_KEY', description: 'Cloudflare Turnstile site key', required: false },
      { key: 'TURNSTILE_SECRET_KEY', description: 'Cloudflare Turnstile secret', required: false },
    ],
  },
  database: {
    label: 'Database',
    variables: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true },
      { key: 'DATABASE_SSL', description: 'Enable TLS for database', required: true },
    ],
  },
  queue: {
    label: 'Queue & cache',
    variables: [
      { key: 'REDIS_URL', description: 'Redis connection string', required: false },
      { key: 'USE_PG_QUEUE', description: 'Fallback to PostgreSQL-backed queue', required: false },
      { key: 'SESSION_TTL_SECONDS', description: 'Session lifetime in seconds', required: true },
    ],
  },
  ai: {
    label: 'AI providers',
    variables: [
      { key: 'GOOGLE_GENAI_API_KEY', description: 'Google Vertex AI key', required: false },
      { key: 'GEMINI_API_KEY', description: 'Gemini API key', required: false },
      { key: 'OPENAI_API_KEY', description: 'OpenAI API key', required: false },
    ],
  },
  payments: {
    label: 'Payments',
    variables: [
      { key: 'STRIPE_SECRET_KEY', description: 'Stripe secret key', required: true },
      { key: 'STRIPE_PUBLISHABLE_KEY', description: 'Stripe publishable key', required: true },
      { key: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook secret', required: true },
      { key: 'SEGPAY_API_KEY', description: 'Segpay API key', required: false },
      { key: 'EPOCH_API_KEY', description: 'Epoch API key', required: false },
      { key: 'PAXUM_API_KEY', description: 'Paxum API key', required: false },
      { key: 'COINBASE_COMMERCE_KEY', description: 'Coinbase Commerce key', required: false },
    ],
  },
  media: {
    label: 'Media storage',
    variables: [
      { key: 'AWS_ACCESS_KEY_ID', description: 'AWS access key', required: true },
      { key: 'AWS_SECRET_ACCESS_KEY', description: 'AWS secret key', required: true },
      { key: 'S3_BUCKET_MEDIA', description: 'Media bucket', required: true },
      { key: 'S3_PUBLIC_CDN_DOMAIN', description: 'Public CDN domain', required: true },
    ],
  },
  email: {
    label: 'Email delivery',
    variables: [
      { key: 'FROM_EMAIL', description: 'Default from email', required: true },
      { key: 'SENDGRID_API_KEY', description: 'SendGrid API key', required: false },
      { key: 'RESEND_API_KEY', description: 'Resend API key', required: false },
    ],
  },
  analytics: {
    label: 'Monitoring & analytics',
    variables: [
      { key: 'SENTRY_DSN', description: 'Sentry DSN', required: true },
      { key: 'ANALYTICS_WRITE_KEY', description: 'Analytics provider key', required: true },
    ],
  },
};

type Status = 'ok' | 'missing' | 'placeholder';

interface VariableResult extends VariableSpec {
  status: Status;
  category: CategoryKey;
  value?: string;
}

const placeholderPattern = /(changeme|placeholder|example|sample|your_|demo)/i;

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
};

const evaluateValue = (value: string | undefined): Status => {
  if (!value || value.trim() === '') {
    return 'missing';
  }
  if (placeholderPattern.test(value)) {
    return 'placeholder';
  }
  return 'ok';
};

const results: VariableResult[] = [];

for (const [category, spec] of Object.entries(categories) as [CategoryKey, CategorySpec][]) {
  for (const variable of spec.variables) {
    const raw = process.env[variable.key];
    const status = evaluateValue(raw);
    results.push({ ...variable, status, category, value: raw });
  }
}

const aiProviderKeys: string[] = ['GOOGLE_GENAI_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'];
const hasAiProvider = aiProviderKeys.some((key) => {
  const match = results.find((entry) => entry.key === key);
  return match?.status === 'ok';
});

const redisStatus = results.find((entry) => entry.key === 'REDIS_URL');
const usePgQueue = parseBoolean(process.env.USE_PG_QUEUE);

const missingRequired = results.filter((entry) => entry.required && entry.status !== 'ok');
const placeholderRequired = results.filter((entry) => entry.required && entry.status === 'placeholder');

const lines: string[] = [];
lines.push('Category | Variable | Status | Required | Notes');
lines.push('---------|----------|--------|----------|------');

for (const result of results) {
  const statusLabel = result.status === 'ok' ? 'OK' : result.status.toUpperCase();
  const requiredLabel = result.required ? 'yes' : 'no';
  let notes = result.description;

  if (!result.required && result.status === 'missing') {
    notes += ' (optional)';
  }

  lines.push(`${categories[result.category].label} | ${result.key} | ${statusLabel} | ${requiredLabel} | ${notes}`);
}

console.error(lines.join('\n'));

if (!hasAiProvider) {
  console.warn('\n⚠️  No AI provider keys configured. Set at least one of GOOGLE_GENAI_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.');
}

if (redisStatus?.status !== 'ok' && !usePgQueue) {
  console.error('\n❌ Neither REDIS_URL nor USE_PG_QUEUE is configured for queues and session storage.');
}

const production = process.env.NODE_ENV === 'production';

if (production && (missingRequired.length > 0 || placeholderRequired.length > 0 || (!hasAiProvider) || (redisStatus?.status !== 'ok' && !usePgQueue))) {
  console.error('\nEnvironment validation failed. Populate the missing variables before starting the server.');
  process.exit(1);
}

if (!production && missingRequired.length > 0) {
  console.warn('\nDevelopment warning: required production variables are missing. Configure them in your secret manager.');
}
