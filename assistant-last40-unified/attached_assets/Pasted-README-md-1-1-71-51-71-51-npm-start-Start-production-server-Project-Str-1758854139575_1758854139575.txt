README.md
+1-1
@@ -71,51 +71,51 @@ npm start               # Start production server
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
Generate a coverage report to validate critical flows before shipping to production. The CI pipeline enforces a minimum of 70% coverage for statements, branches, functions, and lines—keep tests up to date so merges never regress below that safety bar:

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
fix-type-errors.cjs
+0-2
#!/usr/bin/env node

/* eslint-env node */
const fs = require('fs');
const path = require('path');

// Helper to fix common TypeScript errors
function fixTypeErrors(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix error.message patterns
  content = content.replace(/(\s)error\.message/g, '$1(error as Error).message');
  content = content.replace(/(\s)error\.stack/g, '$1(error as Error).stack');
  
  // Fix implicit any in map functions
  content = content.replace(/\.map\(\(([^,)]+),\s*([^)]+)\)/g, '.map(($1: any, $2: number)');
  
  // Fix implicit any in function parameters
  content = content.replace(/function\s+(\w+)\(([^:)]+)\)/g, 'function $1($2: any)');
  
  fs.writeFileSync(filePath, content);
}

// Process all TypeScript files
const files = process.argv.slice(2);
files.forEach(fixTypeErrors);

console.log('✅ Type errors fixed in', files.length, 'files');
package.json
+1-0
@@ -154,50 +154,51 @@
    "recharts": "^2.15.2",
    "sharp": "^0.34.3",
    "snoowrap": "^1.15.2",
    "stripe": "^18.5.0",
    "supertest": "^7.1.4",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tough-cookie": "^6.0.0",
    "ts-node": "^10.9.2",
    "tsc-alias": "^1.8.16",
    "tsconfig-paths": "^4.2.0",
    "tsx": "^4.19.1",
    "tw-animate-css": "^1.2.5",
    "typescript-eslint": "^8.42.0",
    "uuid": "^11.1.0",
    "vaul": "^1.1.2",
    "vitest": "^3.2.4",
    "winston": "^3.17.0",
    "winston-daily-rotate-file": "^5.0.0",
    "wouter": "^3.3.5",
    "ws": "^8.18.3",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.2.4",
    "@replit/vite-plugin-cartographer": "^0.2.8",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.2",
    "@types/node": "^20.19.0",
    "@types/passport": "^1.0.17",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.4",
    "esbuild": "^0.25.0",
    "eslint-formatter-compact": "^8.40.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "typescript": "5.6.3",
    "vite": "^7.1.5"
  },
  "optionalDependencies": {
    "bufferutil": "^4.0.8"
server/caption/openaiFallback.ts
+0-1
@@ -15,51 +15,50 @@ const CaptionItem = z.object({
});

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
tests/integration/content-generation.test.ts
+1-1
@@ -130,51 +130,51 @@ describe('Content Generation Integration Tests', () => {
          user: { id: user.id, email: user.email || undefined, tier: user.tier },
          platform: req.body.platform,
          imageDescription: req.body.imageDescription,
          customPrompt: req.body.customPrompt,
          subreddit: req.body.subreddit,
          allowsPromotion: req.body.allowsPromotion || 'no',
          baseImageUrl: req.body.imageUrl
        });
        
        // Save to database
        const [generation] = await db.insert(contentGenerations).values({
          userId: user.id,
          platform: req.body.platform || 'reddit',
          style: 'default',
          theme: 'default',
          content: result.content,
          titles: result.titles,
          photoInstructions: result.photoInstructions,
          prompt: req.body.customPrompt || '',
          subreddit: req.body.subreddit || null,
          allowsPromotion: req.body.allowsPromotion === 'yes',
          generationType: 'ai'
        }).returning();
        
        // Handle special cases for testing
        let response: any = {
        const response: any = {
          ...result,
          platform: req.body.platform || result.platform,
          imageAnalyzed: !!req.body.imageDescription
        };
        
        // Add fallback indicators for testing
        if (req.body.templateId === 'missing_template') {
          response.fallbackUsed = true;
        }
        
        if (req.body.imageUrl?.endsWith('.bmp')) {
          response.imageError = 'unsupported_format';
          response.fallbackUsed = true;
        }
        
        // Cache the response
        cache.set(cacheKey, response);
        
        res.json(response);
      } catch (error) {
        const errorMessage = (error as Error).message;
        safeLog('error', 'Caption generation failed in test', { error: errorMessage });
        
        // Check if it's a database error
        if (errorMessage.includes('Failed query') || errorMessage.includes('database')) {
vitest.config.ts
+9-0
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Default to Node for server tests
    environmentMatchGlobs: [
      ['client/**', 'jsdom'], // Use jsdom for client tests
      ['tests/**/*.{tsx,jsx}', 'jsdom'], // Use jsdom for React tests
    ],
    setupFiles: ['./tests/vitest-setup.ts'],
    testTimeout: 10000,
    coverage: {
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
