import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { initializeQueue } from "./lib/queue-factory.js";
import { initializeWorkers } from "./lib/workers/index.js";
import { seedDemoUser } from "./seed-demo-user.js";

// Simple log function for production
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[express] ${message}`);
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure demo user exists for development
  try {
    await seedDemoUser();
  } catch (error) {
    console.warn('Demo user seeding failed:', error);
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
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
