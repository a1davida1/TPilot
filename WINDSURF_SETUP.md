# Windsurf Development Setup

## Quick Start (Replit-like Experience)

### Single Command (Recommended)
```bash
npm run dev:full
```
This runs both backend (port 5000) and frontend (port 5173) with auto-reload.

### Manual Two-Terminal Setup
**Terminal 1** (Backend):
```bash
npm run dev
```

**Terminal 2** (Frontend):
```bash
npm run dev:client
```

## What Just Got Fixed

### 1. CSRF Token Generation ✅
**Issue**: Login was broken with "api endpoint not found" error  
**Root Cause**: CSRF token generation was returning empty string  
**Fix**: Properly typed the csrf-csrf v4 API to expose `generateToken`

**File**: `server/app.ts` lines 256-275

### 2. Dev Workflow ✅
**Added Scripts**:
- `npm run dev:full` - Runs both frontend & backend together
- `npm run dev:client` - Runs Vite dev server only

## Database Connection

You're already connected to **Neon PostgreSQL** (cloud database).  
Your `.env` file has:
```
DATABASE_URL=postgresql://neondb_owner:...@ep-quiet-waterfall...neon.tech/neondb
```

This works from anywhere - Replit, Windsurf, or your local machine.

## Next Steps

1. **Install concurrently** (if not done):
   ```bash
   npm install --save-dev concurrently
   ```

2. **Start development**:
   ```bash
   npm run dev:full
   ```

3. **Access your app**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api
   - Drizzle Studio: `npm run db:studio`

## Deploying to Replit

After fixing the CSRF bug, you need to redeploy:

1. **Commit the fix**:
   ```bash
   git add -A
   git commit -m "fix: CSRF token generation for login endpoint"
   git push origin main
   ```

2. **Replit will auto-deploy** (or click Deploy if manual)

The login should work now!

## Common Commands

| Command | What It Does |
|---------|-------------|
| `npm run dev:full` | Full stack dev (frontend + backend) |
| `npm run dev` | Backend only |
| `npm run typecheck` | Check for TypeScript errors |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |
| `npm run db:studio` | Open database GUI |

## Troubleshooting

**Port 5173 already in use?**
```bash
# Kill the process
pkill -f vite
```

**Backend won't start?**
Check `.env` file exists and has required vars.

**Can't connect to database?**
Verify `DATABASE_URL` in `.env` is correct.
