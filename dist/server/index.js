import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes.js";
import { setupAuth } from "./auth.js";
import { mountStripeWebhook } from "./routes/webhooks.stripe.js";
import { mountBillingRoutes } from "./routes/billing.js";
import { initializeQueue } from "./lib/queue-factory.js";
import { initializeWorkers } from "./lib/workers/index.js";
import { seedDemoUser } from "./seed-demo-user.js";
import winston from "winston";
import { v4 as uuidv4 } from "uuid";
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} [${level}]${requestId ? ` [${requestId}]` : ""} ${message}${metaStr}`;
    })),
    transports: [new winston.transports.Console()],
});
const app = express();
let Sentry;
if (process.env.SENTRY_DSN) {
    try {
        // Dynamic import with proper error handling for optional dependency
        const SentryModule = await import("@sentry/node").catch(() => null);
        if (SentryModule) {
            Sentry = SentryModule;
            Sentry.init({ dsn: process.env.SENTRY_DSN });
            app.use(Sentry.Handlers.requestHandler());
        }
        else {
            logger.warn("Sentry module not available, continuing without error tracking");
        }
    }
    catch (err) {
        logger.warn("Sentry initialization failed", { error: err });
    }
}
app.use((req, _res, next) => {
    req.id = uuidv4();
    next();
});
// Raw body for Stripe webhook signature verification
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (_req, _res, next) => next());
app.use(cookieParser()); // Parse cookies for authentication
app.use(express.json({ limit: '50mb' })); // Increase for image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' })); // Increase for image uploads
app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse = undefined;
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
    // Ensure demo user exists for development
    try {
        await seedDemoUser();
    }
    catch (error) {
        logger.warn("Demo user seeding failed", { error });
    }
    // Initialize Phase 5 queue system
    await initializeQueue();
    // Initialize all workers
    await initializeWorkers();
    // Start queue monitoring
    const { queueMonitor } = await import("./lib/queue-monitor.js");
    await queueMonitor.startMonitoring(30000); // Monitor every 30 seconds
    // Start worker auto-scaling
    const { workerScaler } = await import("./lib/worker-scaler.js");
    await workerScaler.startScaling(60000); // Scale every minute
    // Setup auth routes BEFORE other routes
    setupAuth(app);
    // Mount Stripe webhook and billing routes
    mountStripeWebhook(app);
    mountBillingRoutes(app);
    const server = await registerRoutes(app);
    app.use((err, req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
        logger.error(message, { requestId: req.id, stack: err.stack });
        if (Sentry) {
            Sentry.captureException(err);
        }
        // Don't throw - let Express handle the error response
    });
    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
        const { setupVite } = await import("./vite");
        await setupVite(app, server);
    }
    else {
        // Serve static files in production
        const path = await import("path");
        const { fileURLToPath } = await import("url");
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const clientPath = path.join(__dirname, "..", "client", "dist");
        app.use(express.static(clientPath));
        app.get("*", (_req, res) => {
            res.sendFile(path.join(clientPath, "index.html"));
        });
    }
    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // Graceful port binding with EADDRINUSE error handling
    const startServer = (attemptPort, retryCount = 0) => {
        const maxRetries = 3;
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
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.warn(`Port ${attemptPort} is in use`, { error: err.message });
                if (retryCount < maxRetries) {
                    // In Replit, we can only use the PORT environment variable
                    // Try to kill any stray processes and retry the same port
                    logger.info(`Retrying port ${attemptPort} in 2 seconds (attempt ${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => {
                        startServer(attemptPort, retryCount + 1);
                    }, 2000);
                }
                else {
                    logger.error(`Failed to bind to port ${attemptPort} after ${maxRetries} attempts`);
                    logger.error('Please check if another process is using this port and restart the application');
                    process.exit(1);
                }
            }
            else {
                logger.error('Server error:', err);
                process.exit(1);
            }
        });
    };
    startServer(port);
})();
