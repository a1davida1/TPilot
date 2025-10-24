import express from 'express';
import type { RequestHandler } from 'express';
import type { Session, SessionData, Store } from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { v4 as uuidv4 } from 'uuid';
import { registerRoutes } from './routes.js';
import { setupAuth } from './auth.js';
import { setupSocialAuth } from './social-auth.js';
import { mountBillingRoutes } from './routes/billing.js';
// Rate limiting handled in individual routes
import { permissionsPolicy } from './middleware/permissions-policy.js';
import { mountStripeWebhook } from './routes/webhooks.stripe.js';
import { logger } from './bootstrap/logger.js';
import { startQueue } from './bootstrap/queue.js';
import { prepareResponseLogPayload, truncateLogLine } from './lib/request-logger.js';
import passport from 'passport';
import { createSessionMiddleware } from './bootstrap/session.js';
import { Sentry } from './bootstrap/sentry.js';
import { API_PREFIX } from './lib/api-prefix.js';

export interface CreateAppOptions {
  startQueue?: boolean;
  configureStaticAssets?: boolean;
  enableVite?: boolean;
}

export interface CreateAppResult {
  app: express.Express;
  server: import('http').Server;
}

// Augment Express Request interface using ES6 module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

type SessionWithCsrf = Session & Partial<SessionData> & { csrfSessionId?: string };

const resolveCsrfSessionIdentifier = (req: express.Request): string => {
  const session = req.session as SessionWithCsrf | undefined;

  if (session) {
    if (typeof session.csrfSessionId === 'string' && session.csrfSessionId.length > 0) {
      return session.csrfSessionId;
    }

    const existingSessionId = (session as { id?: unknown }).id;
    const sessionIdCandidate =
      typeof req.sessionID === 'string' && req.sessionID.length > 0
        ? req.sessionID
        : (typeof existingSessionId === 'string' && existingSessionId.length > 0 ? existingSessionId : null);

    if (typeof sessionIdCandidate === 'string' && sessionIdCandidate.length > 0) {
      session.csrfSessionId = sessionIdCandidate;
      return session.csrfSessionId;
    }

    const generatedId = uuidv4();
    session.csrfSessionId = generatedId;
    return generatedId;
  }

  const requestWithFallback = req as express.Request & { csrfFallbackId?: string };
  if (typeof requestWithFallback.csrfFallbackId === 'string' && requestWithFallback.csrfFallbackId.length > 0) {
    return requestWithFallback.csrfFallbackId;
  }

  const generatedId = uuidv4();
  requestWithFallback.csrfFallbackId = generatedId;
  return generatedId;
};

function configureCors(app: express.Express): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [];

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV === 'development') {
        const devOrigins = [
          'http://localhost:5000',
          'http://localhost:3000',
          'http://127.0.0.1:5000',
          'http://127.0.0.1:3000',
        ];

        if (devOrigins.includes(origin)) {
          return callback(null, true);
        }

        if (origin.includes('.replit.dev') || origin.includes('.repl.co') || origin.includes('.replit.app')) {
          return callback(null, true);
        }
      }

      if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
        return callback(null, false);
      }

      return callback(null, false);
    },
    credentials: true,
  }));
}

function applyRequestLogging(app: express.Express): void {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: unknown;

    const originalResJson = res.json.bind(res) as typeof res.json;
    res.json = function jsonOverride(...args: Parameters<typeof originalResJson>) {
      const [body] = args;
      capturedJsonResponse = body;
      return originalResJson(...args);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      const isApiRequest = path === API_PREFIX || path.startsWith(`${API_PREFIX}/`);
      if (isApiRequest) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        const payload = prepareResponseLogPayload(capturedJsonResponse);
        if (payload) {
          logLine += ` :: ${payload}`;
        }

        logger.info(truncateLogLine(logLine), { requestId: req.id });
      }
    });

    next();
  });
}

async function configureStaticAssets(
  app: express.Express,
  server: import('http').Server,
  enableVite: boolean,
): Promise<void> {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fs = await import('fs');

  const candidateClientPaths: string[] = [
    path.resolve(__dirname, '..', '..', 'dist', 'client'),
    path.resolve(__dirname, '..', '..', 'client', 'dist'),
  ];

  if (enableVite) {
    candidateClientPaths.push(path.resolve(__dirname, '..', 'client'));
  }

  let clientPath: string | null = null;

  const missingIndexPaths: string[] = [];

  for (const candidate of candidateClientPaths) {
    const indexPath = path.join(candidate, 'index.html');
    if (!fs.existsSync(indexPath)) {
      missingIndexPaths.push(indexPath);
      logger.debug(`Client build candidate missing index at ${indexPath}`);
      continue;
    }

    clientPath = candidate;
    logger.info(`Serving client from: ${clientPath}`);
    break;
  }

  if (!clientPath) {
    if (missingIndexPaths.length > 0) {
      const missingDescriptions = missingIndexPaths
        .map((missingPath) => `Client build not found at ${missingPath}`)
        .join('; ');
      logger.warn(missingDescriptions);
    }
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Production build missing client files!');
    }
    logger.error('Client build not found; unable to locate compiled client assets in any known directory.');

    // Don't add a catch-all route here - let the API routes handle it
    // The SPA fallback will be handled later after API routes are registered
    return;
  }

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/assets/')) {
      logger.info(`Asset request received: ${req.method} ${req.path}`);
    }
    next();
  });

  app.use(express.static(clientPath, {
    index: false,
    setHeaders: (res, path) => {
      logger.info(`Static file served: ${path}`);
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  const isDevelopment = app.get('env') === 'development';
  const viteDevFlag = process.env.ENABLE_VITE_DEV?.toLowerCase();
  const isViteExplicitlyDisabled = viteDevFlag === 'false' || viteDevFlag === '0';
  const shouldEnableVite = enableVite && isDevelopment && !isViteExplicitlyDisabled;

  if (shouldEnableVite) {
    try {
      const { setupVite } = await import('./vite.js');
      await setupVite(app, server);
      logger.info('Vite development server configured');
    } catch (error) {
      logger.warn('Could not setup Vite in development mode:', error);
    }
  } else if (enableVite && isDevelopment) {
    logger.info('Vite development server disabled via ENABLE_VITE_DEV flag. Remove or set to true to re-enable.');
  }

  app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isApiRoute = req.path === API_PREFIX || req.path.startsWith(`${API_PREFIX}/`);
    if (isApiRoute ||
        req.path.startsWith('/auth/') ||
        req.path.startsWith('/webhook/') ||
        req.path.startsWith('/assets/')) {
      logger.debug(`Asset request bypassed SPA fallback: ${req.path}`);
      return next();
    }

    // Check if clientPath was actually found
    if (!clientPath) {
      logger.warn(`Client path not set, unable to serve SPA for ${req.path}`);
      if (process.env.NODE_ENV === 'production') {
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Service Temporarily Unavailable</title>
            <style>
              body { font-family: -apple-system, sans-serif; padding: 50px; text-align: center; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <h1>Service Temporarily Unavailable</h1>
            <p>The application is being deployed. Please refresh this page in a moment.</p>
          </body>
          </html>
        `);
      } else {
        res.status(404).send('Client build not found - run npm run build:client');
      }
      return;
    }

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

  // Import and apply rate limiting
  const { generalLimiter } = await import('./middleware/security.js');
  app.use(generalLimiter);

  // Apply advanced tier-based rate limiting
  try {
    const { applyRateLimiting } = await import('./middleware/rate-limiter.js');
    applyRateLimiting(app);
    logger.info('Advanced rate limiting applied');
  } catch (error) {
    logger.warn('Could not apply advanced rate limiting', { error });
  }

  // Apply observability middleware
  try {
    const { applyObservability } = await import('./middleware/observability.js');
    applyObservability(app);
    logger.info('Observability middleware applied');
  } catch (error) {
    logger.warn('Could not apply observability', { error });
  }

  configureCors(app);

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.id = req.correlationId || uuidv4();
    next();
  });

  app.use(permissionsPolicy);

  const cookieSecret = process.env.COOKIE_SECRET || process.env.SESSION_SECRET || 'dev-cookie-secret';
  if (!cookieSecret && process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_SECRET or SESSION_SECRET must be set in production');
  }
  app.use(cookieParser(cookieSecret));

  // Raw body for Stripe webhook signature verification - must come BEFORE express.json()
  app.post(`${API_PREFIX}/webhooks/stripe`, express.raw({ type: 'application/json' }), (_req, _res, next) => next());

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  app.use(createSessionMiddleware());
  app.set('sessionConfigured', true);

  app.use(passport.initialize());
  app.use(passport.session());

  // Set up routes BEFORE applying CSRF protection
  if (app.get('authRoutesConfigured') !== true) {
    await setupAuth(app, API_PREFIX);
    app.set('authRoutesConfigured', true);
  }

  if (app.get('socialAuthConfigured') !== true) {
    setupSocialAuth(app, API_PREFIX);
    app.set('socialAuthConfigured', true);
  }

  if (app.get('billingRoutesConfigured') !== true) {
    mountBillingRoutes(app, API_PREFIX);
    app.set('billingRoutesConfigured', true);
  }

  const isProd = process.env.NODE_ENV === 'production';
  
  // Modern CSRF protection using csrf-csrf (maintained alternative to csurf)
  const csrfCookieName = isProd ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token';

  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    getSessionIdentifier: resolveCsrfSessionIdentifier,
    cookieName: csrfCookieName,
    cookieOptions: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 3600000,
      path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req: express.Request) => {
      const headerToken =
        req.get('x-csrf-token') ??
        req.get('X-CSRF-Token') ??
        req.get('csrf-token') ??
        req.get('X-XSRF-TOKEN');

      if (typeof headerToken === 'string' && headerToken.length > 0) {
        return headerToken;
      }

      const bodyToken = typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)._csrf ?? (req.body as Record<string, unknown>).csrfToken
        : undefined;

      if (typeof bodyToken === 'string' && bodyToken.length > 0) {
        return bodyToken;
      }

      const queryToken = typeof req.query === 'object' && req.query !== null
        ? (req.query as Record<string, unknown>)._csrf ?? (req.query as Record<string, unknown>).csrfToken
        : undefined;

      if (typeof queryToken === 'string' && queryToken.length > 0) {
        return queryToken;
      }

      return null;
    },
  }) as {
    doubleCsrfProtection: RequestHandler;
    generateCsrfToken: (req: express.Request, res: express.Response) => string;
  };

  const csrfProtection: RequestHandler = doubleCsrfProtection;

  type SessionAwareRequest = express.Request & {
    session: SessionWithCsrf;
    sessionStore: (Store & { generate?: (req: express.Request) => void }) | undefined;
  };

  app.get(`${API_PREFIX}/csrf-token`, (req, res) => {
    const sessionRequest = req as Partial<SessionAwareRequest>;

    if (!sessionRequest.session) {
      sessionRequest.sessionStore?.generate?.(req);
    }

    const activeSession = sessionRequest.session;
    if (!activeSession) {
      logger.error('CSRF token requested without active session', {
        correlationId: req.correlationId,
      });
      return res.status(503).json({ error: 'Session unavailable' });
    }

    try {
      if (typeof activeSession.touch === 'function') {
        activeSession.touch();
      }

      resolveCsrfSessionIdentifier(req);
      const token = generateCsrfToken(req, res);
      res.json({ csrfToken: token });
    } catch (error) {
      logger.error('Failed to generate CSRF token', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Unable to generate CSRF token' });
    }
  });

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Phase 1: Exempt Bearer token requests from CSRF (CSRF doesn't apply to JWT)
    if (req.headers.authorization?.startsWith('Bearer ')) {
      logger.debug('CSRF exemption: Bearer token detected', { 
        path: req.path,
        method: req.method 
      });
      return next();
    }

    const exemptPaths = [
      `${API_PREFIX}/auth/login`,
      `${API_PREFIX}/auth/signup`,
      `${API_PREFIX}/auth/reddit/callback`, // Old passport flow (legacy)
      `${API_PREFIX}/reddit/callback`,      // New secure Reddit OAuth flow
      `${API_PREFIX}/auth/google/callback`,
      `${API_PREFIX}/auth/facebook/callback`,
      `${API_PREFIX}/auth/logout`,
      `${API_PREFIX}/webhooks/`,
      `${API_PREFIX}/health`,
      `${API_PREFIX}/uploads/imgur`,        // Exempt Imgur uploads from CSRF
      `${API_PREFIX}/upload/catbox-proxy`,  // Exempt Catbox proxy from CSRF
      `${API_PREFIX}/catbox/`,              // Exempt all Catbox endpoints from CSRF
      `${API_PREFIX}/caption/`              // Exempt caption generation from CSRF
    ];

    const isExempt = exemptPaths.some((path) => req.path.startsWith(path));
    
    if (isExempt) {
      logger.debug('CSRF exemption: path matched', { 
        path: req.path,
        method: req.method 
      });
      return next();
    }

    return csrfProtection(req, res, next);
  });

  app.set('csrfProtectionConfigured', true);

  applyRequestLogging(app);

  const startQueueOption = options.startQueue ?? true;
  const configureStaticOption = options.configureStaticAssets ?? true;
  // Never enable Vite in production, even if NODE_ENV is missing
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const enableVite = options.enableVite ?? (!isProduction && app.get('env') === 'development');
  const queuePrerequisitesPresent = Boolean(process.env.REDIS_URL || process.env.DATABASE_URL);
  const shouldStartQueue = startQueueOption && queuePrerequisitesPresent;

  try {

    if (shouldStartQueue) {
      await startQueue();
    } else if (startQueueOption) {
      logger.info(
        'Queue startup skipped: provide REDIS_URL or DATABASE_URL environment variables to enable background workers.'
      );
    } else {
      logger.info('Queue startup disabled for current execution context.');
    }

    mountStripeWebhook(app, API_PREFIX);


    const server = await registerRoutes(app, API_PREFIX, { sentry: Sentry });

    if (configureStaticOption) {
      await configureStaticAssets(app, server, enableVite);
    }

    // Sentry v7 error handler
    if (process.env.SENTRY_DSN) {
      // In v7, use Handlers.errorHandler() instead
      app.use(Sentry.Handlers.errorHandler());
    }

    // Optional fallthrough error handler
    app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error in Express:', {
        error: err.message,
        stack: err.stack,
        requestId: req.id
      });

      if (res.statusCode === 200) {
        res.statusCode = 500;
      }

      if (!res.headersSent) {
        const sentryRes = res as express.Response & { sentry?: string };
        res.json({
          error: 'Internal server error',
          requestId: req.id,
          sentryId: sentryRes.sentry,
        });
      }
    });

    return { app, server };
  } catch (error) {
    logger.error('Failed to initialise application:', error);
    throw error;
  }
}