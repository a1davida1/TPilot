/**
 * Token extraction utilities for authentication
 */

export function extractAuthToken(req) {
  if (req.cookies?.authToken) return req.cookies.authToken;
  if (req.headers.authorization?.startsWith("Bearer "))
    return req.headers.authorization.slice(7);
  return null;
}