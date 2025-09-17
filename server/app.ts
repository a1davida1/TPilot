
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

export interface CreateAppOptions {
  startQueue?: boolean;
  configureStaticAssets?: boolean;
  enableVite?: boolean;
}

export interface CreateAppResult {
  app: express.Express;
  server: import('http').Server;
}

export const API_PREFIX = '/api/v1';

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
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      if (path.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          const safe = (({ token, email, ...rest }) => rest)(capturedJsonResponse as Record<string, unknown>);
          logLine += ` :: ${JSON.stringify(safe)}`;
        }

        if (logLine.length > 80) {
          logLine = `${logLine.slice(0, 79)}…`;
        }

        logger.info(logLine, { requestId: req.id });
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
  if (enableVite && app.get('env') === 'development') {
    try {
      const { setupVite } = await import('./vite.js');
      await setupVite(app, server);

      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const clientPath = path.join(__dirname, '..', 'dist', 'client');
      const fs = await import('fs');

      if (fs.existsSync(clientPath)) {
        app.use(express.static(clientPath));
        app.get('*', (req, res, next) => {
          if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/') && !req.path.startsWith('/webhook/')) {
            res.sendFile(path.join(clientPath, 'index.html'));
          } else {
            next();
          }
        });
      }

      app.use((req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/webhook/')) {
          return notFoundHandler(req, res);
        }
        next();
      });
      return;
    } catch (error) {
      logger.warn('Could not setup Vite in development mode:', error);
    }
  }

  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientPath = path.join(__dirname, '..', 'client');
  const fs = await import('fs');

  if (!fs.existsSync(clientPath)) {
    logger.error(`Production build directory not found: ${clientPath}`);
    logger.error("Please run 'npm run build' to create the production build");
    return;
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/webhook/')) {
      return notFoundHandler(req, res);
    }
    next();
  });

  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.type('html');
    res.sendFile(path.join(clientPath, 'index.html'));
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

  applyRequestLogging(app);

  const startQueueOption = options.startQueue ?? true;
  const configureStaticOption = options.configureStaticAssets ?? true;
  const enableVite = options.enableVite ?? (app.get('env') === 'development');

  try {
    app.use(`${API_PREFIX}/auth`, authLimiter);

    if (startQueueOption) {
      await startQueue();
    } else {
      logger.info('Queue startup disabled for current execution context.');
    }

    setupAuth(app);
    setupSocialAuth(app);
    mountStripeWebhook(app);
    mountBillingRoutes(app);

    const server = await registerRoutes(app, API_PREFIX);

    if (configureStaticOption) {
      await configureStaticAssets(app, server, enableVite);
    }

    return { app, server };
  } catch (error) {
    logger.error('Failed to initialise application:', error);
    throw error;
  }
}
