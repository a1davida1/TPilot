README.md
+6-0
@@ -71,50 +71,56 @@ npm start               # Start production server
### Project Structure

```
├── client/             # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Route pages
│   │   └── lib/        # Client utilities
├── server/             # Express backend
│   ├── lib/            # Core services
│   ├── routes/         # API routes
│   ├── caption/        # AI content generation
│   └── workers/        # Background jobs
├── shared/             # Shared types & schema
└── prompts/            # AI generation prompts
```

## Testing

Run the full test suite:

```bash
npm test
```

Generate a coverage report to validate critical flows before shipping to production:

```bash
npm run test:coverage
```

Key test areas:
- Authentication and authorization
- Content generation pipelines  
- Image protection algorithms
- Billing and subscription management
- Rate limiting and safety systems

## Deployment

### Production Deployment

1. **Environment Variables**: Ensure all required variables in `.env.example` are configured
2. **Database**: Run `npm run db:push` to sync schema
3. **Build**: Run `npm run build` to create production assets
4. **Start**: Run `npm start` to launch the production server

### Key Production Considerations

- Configure proper `DATABASE_URL` for production PostgreSQL
- Set `NODE_ENV=production`
- Configure `APP_BASE_URL` for your domain
- Enable Redis with `REDIS_URL` for optimal performance
- Set up monitoring with `SENTRY_DSN`
- Configure email services (`SENDGRID_API_KEY` or `RESEND_API_KEY`)

package.json
+2-1
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "bash build-production.sh",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "NODE_ENV=production tsx server/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "fix-imports": "bash fix-all-imports.sh",
    "lint": "eslint .",
    "test": "vitest run"
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@aws-sdk/client-s3": "^3.864.0",
    "@aws-sdk/s3-request-presigner": "^3.864.0",
    "@eslint/js": "^9.35.0",
    "@google-cloud/storage": "^7.17.0",
    "@google/genai": "^1.12.0",
    "@google/generative-ai": "^0.24.1",
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@maxmind/geoip2-node": "^6.1.0",
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
server/app.ts
+9-3
@@ -119,60 +119,66 @@ async function configureStaticAssets(
  let clientPath: string;
  if (process.env.NODE_ENV === 'production') {
    // In production: server runs from dist/server
    // So '../client' resolves to dist/client (where build script places files)
    clientPath = path.resolve(__dirname, '..', 'client');
  } else {
    // In development: serve built files from client/dist directory
    clientPath = path.resolve(__dirname, '..', 'client', 'dist');
  }
  
  // Check if index.html exists in the client directory
  const indexPath = path.join(clientPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    logger.warn(`Client build not found at ${indexPath}`);
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Production build missing client files!');
    }
  } else {
    logger.info(`Serving client from: ${clientPath}`);
  }

  // IMPORTANT: Serve static files BEFORE Vite setup to ensure they're accessible
  // Set index: true to serve index.html for root path
  app.use(express.static(clientPath, { index: 'index.html' }));
  
  // Skip Vite in development since it's not working properly
  // and we're serving the built files instead
  if (enableVite && app.get('env') === 'development' && false) {
  // Skip Vite in development unless explicitly enabled for diagnostics
  const shouldEnableVite =
    enableVite &&
    app.get('env') === 'development' &&
    process.env.ENABLE_VITE_DEV === 'true';

  if (shouldEnableVite) {
    try {
      const { setupVite } = await import('./vite.js');
      await setupVite(app, server);
      logger.info('Vite development server configured');
    } catch (error) {
      logger.warn('Could not setup Vite in development mode:', error);
    }
  } else if (enableVite && app.get('env') === 'development') {
    logger.info('Vite development server disabled; set ENABLE_VITE_DEV=true to opt-in.');
  }
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Let API/auth/webhook routes fall through to 404 handler
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/auth/') || 
        req.path.startsWith('/webhook/')) {
      return next();
    }
    
    // Serve index.html for SPA routing
    const indexFile = path.join(clientPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.type('html');
      res.sendFile(indexFile);
    } else {
      res.status(404).send('Client build not found');
    }
  });
}

export async function createApp(options: CreateAppOptions = {}): Promise<CreateAppResult> {
  const app = express();
  app.set('trust proxy', 1);
server/caption/openaiFallback.ts
+0-1
@@ -16,51 +16,50 @@ const CaptionItem = z.object({


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export interface FallbackParams {
  platform: string;
  voice: string;
  imageUrl?: string;
  theme?: string;
  context?: string;
  existingCaption?: string;
}

export async function openAICaptionFallback({
  platform,
  voice = "flirty_playful",
  imageUrl,
  existingCaption
}: {
  platform: "instagram" | "x" | "reddit" | "tiktok";
  voice?: string;
  imageUrl?: string;
  existingCaption?: string;
}): Promise<z.infer<typeof CaptionItem>> {
  // Analyze image if provided
  let imageAnalysis = '';
  let messages: any[] = [];

  if (imageUrl && openai) {
    try {
      console.log('OpenAI fallback: Analyzing image for accurate captions');

      if (imageUrl.startsWith('data:')) {
        // For data URLs, we can send directly to OpenAI vision
        messages = [
          {
            role: "system",
            content: `You are an expert social media caption writer. Analyze the image carefully and create engaging ${voice} content for ${platform} that directly relates to what you see.

Return ONLY a JSON object with this structure:
{
  "caption": "engaging caption text that describes what's actually in the image",
  "hashtags": ["#relevant", "#to", "#image"],
  "safety_level": "safe_for_work",
  "mood": "${voice.includes('flirty') ? 'flirty' : 'confident'}",
  "style": "authentic",
  "cta": "relevant call to action",
  "alt": "detailed description of what's actually in the image",
  "nsfw": false
}`
          },
server/db.ts
+3-5

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { Pool as PostgresPool } from 'pg';
import ws from 'ws';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

// Allow tests to use TEST_DATABASE_URL while still failing fast in production.
const preferTestConnection = process.env.NODE_ENV === 'test';
const preferredConnectionString = preferTestConnection
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!preferredConnectionString) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

let poolInstance: NeonPool | PostgresPool;
let dbInstance: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePostgres>;

// Use Neon pool for serverless environment
const connectionString = preferredConnectionString as string;
const neonPool = new NeonPool({ connectionString });
poolInstance = neonPool;
dbInstance = drizzleNeon({ client: neonPool, schema });
const poolInstance: NeonPool | PostgresPool = neonPool;
const dbInstance: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePostgres> =
  drizzleNeon({ client: neonPool, schema });

export const pool = poolInstance;
export const db = dbInstance;

export async function closeDatabaseConnections(): Promise<void> {
  await (poolInstance as NeonPool).end();
}
