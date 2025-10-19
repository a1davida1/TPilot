# ThottoPilot Deployment Guide

## ✅ Deployment Issue Fixed!

The deployment error **"Cannot find package '@shared/schema'"** has been successfully resolved.

## 🔧 What Was Fixed

1. **Path Mapping Resolution**: TypeScript path mappings (`@shared/*`) are now properly converted to relative imports using `tsc-alias`
2. **Import Extensions**: All ES module imports now have proper `.js` extensions as required by Node.js
3. **Build Process**: Created a robust build script that handles all compilation issues
4. **Vite Exclusion**: Production builds exclude the development-only vite configuration

## 📦 Production Build Process

### Quick Build
```bash
./build-production.sh
```

> **Tip:** `npm start` now runs this script automatically through the `prestart` hook, so a fresh `dist/` directory is always available before the server boots.

### Manual Build Steps
```bash
# 1. Clean previous builds
rm -rf dist

# 2. Compile TypeScript (with vite.ts temporarily moved)
mv server/vite.ts server/vite.ts.bak
tsc -p tsconfig.json
mv server/vite.ts.bak server/vite.ts

# 3. Resolve path mappings
tsc-alias -p tsconfig.json

# 4. Fix import extensions
npm run fix-imports
./fix-double-js.sh
./fix-all-imports.sh

# 5. Build client (if needed)
cd client && npx vite build && cd ..
```

### Client Artifact Validation
```bash
npm run validate:client -- dist/client
```
This command verifies that the Vite output copied into `dist/client` references hashed assets, includes matching pre-compressed `.gz` files, and keeps the SPA entry from falling back to development sources. The production build now runs this step automatically and fails fast if the bundle is missing or corrupt.

### Production Smoke Gate
The `Production Smoke` GitHub Actions workflow exercises the live single-page application immediately after a deployment succeeds (or on demand via *Run workflow*). It reuses `scripts/smoke-test.ts` to fetch the SPA entry, confirm the `#root` mount, and download each hashed JS/CSS asset. Failures mark the `production` environment check as failed, blocking promotions until the issue is resolved.

To debug locally, build the client and serve it (for example via `npm run build:client` and `npm run dev:client -- --host 0.0.0.0 --port 4173`), then run:

```bash
npm run smoke:spa -- --base-url=http://localhost:4173
```

A convenience alias `npm run smoke:spa:local` is provided for the default Vite preview port.

## 🚀 Running in Production

### Recommended Command
```bash
npm start
```

This executes the full production build via `build-production.sh` and then launches `NODE_ENV=production node dist/server/index.js`, so you always run the compiled JavaScript without relying on `tsx`.

### Local Testing
```bash
NODE_ENV=production node dist/server/index.js
```

### With Custom Port
```bash
PORT=3000 NODE_ENV=production node dist/server/index.js
```

> If you start the server manually (without `npm start`), run `npm run build` or `./build-production.sh` beforehand to ensure `dist/` has been generated.

## 🌐 Deployment Files

The `dist/` directory contains all necessary files for deployment:
- `dist/server/` - Compiled server code
- `dist/shared/` - Shared schemas and types
- `dist/client/` - Production client build (when built)

## ⚙️ Environment Variables Required

```env
# Database
DATABASE_URL=your_postgres_connection_string

# Optional but recommended
NODE_ENV=production
PORT=5000
SESSION_SECRET=your_secure_session_secret

# Reddit community sync service (optional but recommended for automated updates)
REDDIT_CLIENT_ID=service_app_client_id
REDDIT_CLIENT_SECRET=service_app_client_secret
REDDIT_USER_AGENT=ThottoPilot/1.0 (Community sync bot)
# Choose one authentication approach for the dedicated sync client
# REDDIT_REFRESH_TOKEN=service_refresh_token
#   - or -
# REDDIT_USERNAME=service_account_username
# REDDIT_PASSWORD=service_account_password

# External Services (if used)
SENDGRID_API_KEY=your_sendgrid_key
GOOGLE_GENAI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

## 📝 Important Notes

1. **Memory Store Warning**: The warning about MemoryStore is expected in production. For production deployments, consider using Redis or PostgreSQL for session storage.

2. **Client Build**: The client needs to be built separately with `cd client && npx vite build` for production deployment.

3. **Database**: Ensure your PostgreSQL database is accessible from the deployment environment.

4. **Reddit Credential Isolation**: Configure the Reddit sync service credentials separately from any creator posting accounts. The server now provisions a cached Snoowrap client during startup (`registerDefaultRedditClients`) so queue workers reuse the shared service identity exclusively for community discovery workloads.

## 🔐 Provisioning the Admin Account

Follow these steps so production only relies on hashed credentials:

1. **Generate a bcrypt hash locally**
   ```bash
   node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" 'StrongPassword!'
   ```
   Replace `StrongPassword!` with the real admin password and copy the printed hash.

2. **Store deployment secrets**
   - `ADMIN_EMAIL` – required.
   - `ADMIN_PASSWORD_HASH` – the hash generated above.
   - *(Optional)* `ADMIN_USERNAME` – shown in the UI and used by the seed script.

3. **Seed the database (if needed)**
   Run the compiled script during deployment bootstrap so the admin row exists:
   ```bash
   node dist/server/scripts/create-admin.js
   ```
   Ensure the environment already contains the variables from step 2 before running the script.

4. **Limit plaintext usage to local tooling**
   Only mirror the plaintext password into local or QA tooling (e.g. `VITE_ADMIN_PASSWORD`, `E2E_ADMIN_PASSWORD`) and avoid storing it in shared production secrets.

## ✨ Deployment Ready!

Your application is now ready for deployment. The build process has been tested and verified to work correctly without any module resolution errors.