import { cookies } from 'next/headers';
import jwt, { type JwtPayload } from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return secret;
}

function extractUserId(payload: JwtPayload | string): number | null {
  if (typeof payload === 'string') {
    return null;
  }
  if (typeof payload.userId === 'number') {
    return payload.userId;
  }
  if (typeof payload.id === 'number') {
    return payload.id;
  }
  return null;
}

export function getServerUserId(): number | null {
  const cookieStore = cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    return extractUserId(payload);
  } catch (error) {
    console.error('Failed to verify auth token for server request', error);
    return null;
  }
}
