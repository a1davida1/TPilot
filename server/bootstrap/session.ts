
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import connectRedisPkg from 'connect-redis';
import Redis from 'ioredis';
import createMemoryStore from 'memorystore';
import type { Store } from 'express-session';
import type { Redis as RedisClient } from 'ioredis';
import { logger } from './logger.js';

const connectRedis = connectRedisPkg(session);

const ONE_DAY_MS = 86_400_000;

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

interface RedisStoreConstructor {
  new (options: { client: RedisClient; prefix?: string; disableTouch?: boolean; ttl?: number }): Store;
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to a strong value for session encryption');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const redisUrl = process.env.REDIS_URL;
  const usePgQueue = parseBoolean(process.env.USE_PG_QUEUE);
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();

  const baseCookie: session.CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: parseInteger(process.env.SESSION_MAX_AGE_MS, ONE_DAY_MS * 7),
  };

  if (cookieDomain) {
    baseCookie.domain = cookieDomain;
  }

  const sessionOptions: session.SessionOptions = {
    name: process.env.SESSION_COOKIE_NAME ?? 'tpilot.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: baseCookie,
  };

  if (redisUrl) {
    const RedisStore = connectRedis as unknown as RedisStoreConstructor;
    const redisClient = new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
    });

    redisClient.on('error', (error) => {
      logger.error('Redis session store error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    sessionOptions.store = new RedisStore({
      client: redisClient,
      prefix: process.env.REDIS_SESSION_PREFIX ?? 'tpilot:sess:',
      disableTouch: false,
      ttl: parseInteger(process.env.SESSION_TTL_SECONDS, (ONE_DAY_MS / 1000) * 7),
    });

    logger.info('Session store configured with Redis backend');
  } else if (usePgQueue || isProduction) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.error('DATABASE_URL is required when REDIS_URL is not set');
      throw new Error('DATABASE_URL must be set when using PostgreSQL-backed sessions');
    }

    const PgStore = connectPgSimple(session);
    const pgStoreOptions: ConstructorParameters<typeof PgStore>[0] = {
      conString: databaseUrl,
      tableName: process.env.SESSION_TABLE_NAME ?? 'user_sessions',
      schemaName: process.env.SESSION_SCHEMA ?? 'public',
      createTableIfMissing: true,
      pruneSessionInterval: parseInteger(process.env.SESSION_PRUNE_INTERVAL, ONE_DAY_MS / 1000),
    };

    sessionOptions.store = new PgStore(pgStoreOptions);
    logger.info('Session store configured with PostgreSQL backend');
  } else {
    const MemoryStore = createMemoryStore(session);
    sessionOptions.store = new MemoryStore({
      checkPeriod: parseInteger(process.env.SESSION_CHECK_PERIOD_MS, ONE_DAY_MS),
      max: parseInteger(process.env.SESSION_MEMORY_MAX, 5_000),
    });

    logger.warn('Using in-memory session store. Configure REDIS_URL or set USE_PG_QUEUE=true for production.');
  }

  return session(sessionOptions);
}
