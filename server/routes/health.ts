import { Router } from "express";

const healthRouter = Router();

// Minimal health check for tests and local development
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export { healthRouter };