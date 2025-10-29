import Redis from 'ioredis';

let redis: Redis | null = null;

// Only create Redis connection if available and not using PG queue
if (process.env.REDIS_URL && process.env.USE_PG_QUEUE !== 'true') {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,  // Allow commands to queue while connecting
      lazyConnect: false,        // Connect immediately on startup
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 50, 2000); // Exponential backoff
      }
    });
    redis.on('error', () => {
      // Silently handle errors - blacklist will use memory fallback
    });
  } catch {
    redis = null;
  }
}

function signatureFromToken(token: string): string | null {
  const parts = token.split('.');
  return parts.length === 3 ? parts[2] : null;
}

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  const sig = signatureFromToken(token);
  if (!sig) return;
  try {
    await redis.setex(`bl:${sig}`, ttlSeconds, '1');
  } catch {
    // Redis unavailable, token blacklisting disabled
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!redis) return false;
  const sig = signatureFromToken(token);
  if (!sig) return false;
  try {
    const exists = await redis.exists(`bl:${sig}`);
    return exists === 1;
  } catch {
    // Redis unavailable, assume token is not blacklisted
    return false;
  }
}