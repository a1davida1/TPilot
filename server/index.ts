import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { mountStripeWebhook } from "./routes/webhooks.stripe";
import { mountBillingRoutes } from "./routes/billing";
import { v4 as uuidv4 } from "uuid";
import { logger, initializeSentry } from "./bootstrap/logger";
import { startQueue } from "./bootstrap/queue";
import { notFoundHandler } from "./middleware/security";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Initialize Sentry with proper validation
const Sentry = await initializeSentry();
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use((req, _res, next) => {
  req.id = uuidv4();
  next();
});

// Raw body for Stripe webhook signature verification
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (_req,_res,next)=>next());
app.use(cookieParser()); // Parse cookies for authentication
app.use(express.json({ limit: '50mb' })); // Increase for image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' })); // Increase for image uploads

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      logger.info(logLine, { requestId: req.id });
    }
  });

  next();
});

(async () => {
  try {
    // Initialize queue system
    await startQueue();
  
    // Setup auth routes BEFORE other routes
    setupAuth(app);
  
    // Mount Stripe webhook and billing routes
    mountStripeWebhook(app);
    mountBillingRoutes(app);
  
    const server = await registerRoutes(app);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      try {
        const { setupVite } = await import("./vite");
        await setupVite(app, server);
        
        // Since Vite setup is a stub, serve the built client files in development too
        const path = await import("path");
        const { fileURLToPath } = await import("url");
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const clientPath = path.join(__dirname, "..", "client", "dist");
        
        // Check if build directory exists
        const fs = await import("fs");
        if (fs.existsSync(clientPath)) {
          app.use(express.static(clientPath));
          app.get("*", (req, res, next) => {
            // Only serve index.html for non-API routes
            if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/') && !req.path.startsWith('/webhook/')) {
              res.sendFile(path.join(clientPath, "index.html"));
            } else {
              next();
            }
          });
        }
        
        // Add 404 handler only for API routes in development (after Vite setup)
        app.use((req, res, next) => {
          // Only apply 404 handler to API routes, let Vite handle frontend routes
          if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/webhook/')) {
            return notFoundHandler(req, res);
          }
          next();
        });
      } catch (error) {
        logger.warn("Could not setup Vite in development mode:", error);
      }
    } else {
      // Serve static files in production
      const path = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const clientPath = path.join(__dirname, "..", "client", "dist");
      
      // Check if build directory exists
      const fs = await import("fs");
      if (!fs.existsSync(clientPath)) {
        logger.error(`Production build directory not found: ${clientPath}`);
        logger.error("Please run 'npm run build' to create the production build");
        process.exit(1);
      }
      
      // Add 404 handler for API routes in production (before static serving)
      app.use((req, res, next) => {
        // Apply 404 handler only to API routes, let static serving handle frontend routes
        if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/webhook/')) {
          return notFoundHandler(req, res);
        }
        next();
      });
      
      app.use(express.static(clientPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientPath, "index.html"));
      });
    }

    // Global error handler is applied within registerRoutes

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
  
    // Graceful port binding with EADDRINUSE error handling
    const startServer = (attemptPort: number, retryCount = 0): void => {
      const maxRetries = 3;
    
      // Remove any existing error listeners to prevent memory leaks
      server.removeAllListeners('error');
    
      server.listen({
        port: attemptPort,
        host: "0.0.0.0",
        reusePort: true,
      }, () => {
        logger.info(`serving on port ${attemptPort}`);
        // Update environment variable if we used a fallback port
        if (attemptPort !== port) {
          logger.info(`Note: Using fallback port ${attemptPort} instead of ${port}`);
        }
      });
    
      server.on('error', (err: unknown) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${attemptPort} is in use`, { error: err.message });
        
          if (retryCount < maxRetries) {
            // In Replit, we can only use the PORT environment variable
            // Try to kill any stray processes and retry the same port
            logger.info(`Retrying port ${attemptPort} in 2 seconds (attempt ${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              startServer(attemptPort, retryCount + 1);
            }, 2000);
          } else {
            logger.error(`Failed to bind to port ${attemptPort} after ${maxRetries} attempts`);
            logger.error('Please check if another process is using this port and restart the application');
            process.exit(1);
          }
        } else {
          logger.error('Server error:', err);
          process.exit(1);
        }
      });
    };
  
    startServer(port);
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
})();
