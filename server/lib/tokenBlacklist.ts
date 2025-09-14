import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

function signatureFromToken(token: string): string | null {
  const parts = token.split('.');
  return parts.length === 3 ? parts[2] : null;
}

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  const sig = signatureFromToken(token);
  if (!sig) return;
  await redis.setex(`bl:${sig}`, ttlSeconds, '1');
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!redis) return false;
  const sig = signatureFromToken(token);
  if (!sig) return false;
  const exists = await redis.exists(`bl:${sig}`);
  return exists === 1;
}