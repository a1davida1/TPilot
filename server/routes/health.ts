import { Router } from "express";
import { pool } from "../db";
import Redis from "ioredis";
import { storage } from "../storage";
import { logger } from "../bootstrap/logger";

const healthRouter = Router();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

healthRouter.get("/health", async (_req, res) => {
  const checks = { database: false, redis: false, storage: false };

  try {
    await pool.query("SELECT 1");
    checks.database = true;
  } catch (err) {
    logger.error("Database health check failed", { error: err instanceof Error ? err.message : String(err) });
  }

  try {
    if (redis) {
      await redis.ping();
      checks.redis = true;
    } else {
      checks.redis = false;
    }
  } catch (err) {
    logger.error("Redis health check failed", { error: err instanceof Error ? err.message : String(err) });
  }

  try {
    await storage.getTotalUserCount();
    checks.storage = true;
  } catch (err) {
    logger.error("Storage health check failed", { error: err instanceof Error ? err.message : String(err) });
  }

  const healthy = Object.values(checks).every(Boolean);
  res.status(healthy ? 200 : 503).json(checks);
});

export { healthRouter };