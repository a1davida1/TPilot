import jwt, { type JwtPayload } from 'jsonwebtoken';

let currentRequest: Request | null = null;

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const parts = headerValue.trim().split(/\s+/u);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }
  const token = parts[1]?.trim();
  return token && token.includes('.') ? token : null;
}

function extractTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split('=');
    if (!rawName) continue;
    if (rawName.trim() === 'authToken') {
      const value = rest.join('=').trim();
      return value && value.includes('.') ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

function resolveUserId(payload: JwtPayload | string): number | null {
  if (typeof payload === 'string') {
    return null;
  }
  const { userId, id } = payload;
  if (typeof userId === 'number') {
    return userId;
  }
  if (typeof id === 'number') {
    return id;
  }
  return null;
}

export function setAuthRequestContext(request: Request): void {
  currentRequest = request;
}

export function clearAuthRequestContext(): void {
  currentRequest = null;
}

export function auth(): { userId: number | null } {
  const request = currentRequest;
  if (!request) {
    return { userId: null };
  }

  const headerToken = extractTokenFromHeader(
    request.headers.get('authorization') ?? request.headers.get('Authorization')
  );
  const cookieToken = extractTokenFromCookies(request.headers.get('cookie'));
  const token = headerToken ?? cookieToken;
  if (!token) {
    return { userId: null };
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    return { userId: resolveUserId(payload) };
  } catch {
    return { userId: null };
  }
}
