import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { registerRoutes } from './routes.js';
import { authLimiter, generalLimiter, sanitize, notFoundHandler } from './middleware/security.js';
import { setupAuth } from './auth.js';
import { setupSocialAuth } from './social-auth.js';
import { mountStripeWebhook } from './routes/webhooks.stripe.js';
import { mountBillingRoutes } from './routes/billing.js';
import { logger } from './bootstrap/logger.js';
import { startQueue } from './bootstrap/queue.js';
import { prepareResponseLogPayload, truncateLogLine } from './lib/request-logger.js';
import passport from 'passport'; // Assuming passport is imported elsewhere or needs to be imported here
import { createSessionMiddleware } from './bootstrap/session.js';
import { initializeSentry } from './bootstrap/sentry';
import { registerDefaultRedditClients } from './lib/reddit.js';
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

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

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
  app.use((req, res, next) => {
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
    path.resolve(__dirname, '..', 'client', 'dist'),
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

    // Return a 404 handler for all static file requests instead of crashing
    app.get('*', (req, res) => {
      res.status(404).send('Client build not found - static assets unavailable');
    });
    return;
  }

  // Debug middleware to trace all requests
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      logger.info(`Asset request received: ${req.method} ${req.path}`);
    }
    next();
  });

  // IMPORTANT: Serve static files BEFORE Vite setup to ensure they're accessible
  // Set index: false to prevent serving index.html for directory requests to avoid conflicts
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

  // Enable Vite in development by default; allow opt-out via ENABLE_VITE_DEV
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

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Let API/auth/webhook/assets routes fall through to 404 handler or static middleware
    const isApiRoute = req.path === API_PREFIX || req.path.startsWith(`${API_PREFIX}/`);
    if (isApiRoute ||
        req.path.startsWith('/auth/') ||
        req.path.startsWith('/webhook/') ||
        req.path.startsWith('/assets/')) {
      logger.debug(`Asset request bypassed SPA fallback: ${req.path}`);
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
  app.use(generalLimiter);
  app.use(sanitize);

  configureCors(app);

  app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.post(`${API_PREFIX}/webhooks/stripe`, express.raw({ type: 'application/json' }), (_req, _res, next) => next());
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));
  app.use(createSessionMiddleware());
  app.set('sessionConfigured', true);
  app.use(passport.initialize());
  app.use(passport.session());

  applyRequestLogging(app);

  const startQueueOption = options.startQueue ?? true;
  const configureStaticOption = options.configureStaticAssets ?? true;
  const enableVite = options.enableVite ?? (app.get('env') === 'development');
  const queuePrerequisitesPresent = Boolean(process.env.REDIS_URL || process.env.DATABASE_URL);
  const shouldStartQueue = startQueueOption && queuePrerequisitesPresent;

  try {
    app.use(`${API_PREFIX}/auth`, authLimiter);

    if (shouldStartQueue) {
      await startQueue();
    } else if (startQueueOption) {
      logger.info(
        'Queue startup skipped: provide REDIS_URL or DATABASE_URL environment variables to enable background workers.'
      );
    } else {
      logger.info('Queue startup disabled for current execution context.');
    }

    const sentry = initializeSentry();

    // Commented out to prevent unnecessary Reddit service client registration
    // The community sync worker will check for credentials during initialization
    // registerDefaultRedditClients();

    setupAuth(app, API_PREFIX);
    setupSocialAuth(app, API_PREFIX);  // Register social auth routes including logout
    mountStripeWebhook(app, API_PREFIX);
    mountBillingRoutes(app, API_PREFIX);

    const server = await registerRoutes(app, API_PREFIX, { sentry });

    if (configureStaticOption) {
      await configureStaticAssets(app, server, enableVite);
    }

    return { app, server };
  } catch (error) {
    logger.error('Failed to initialise application:', error);
    throw error;
  }
}