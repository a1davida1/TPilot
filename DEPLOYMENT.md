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

# External Services (if used)
SENDGRID_API_KEY=your_sendgrid_key
GOOGLE_GENAI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

## 📝 Important Notes

1. **Memory Store Warning**: The warning about MemoryStore is expected in production. For production deployments, consider using Redis or PostgreSQL for session storage.

2. **Client Build**: The client needs to be built separately with `cd client && npx vite build` for production deployment.

3. **Database**: Ensure your PostgreSQL database is accessible from the deployment environment.

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