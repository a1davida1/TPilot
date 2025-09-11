import type { Request } from "express";

export function extractAuthToken(req: Request): string | null {
  if (req.cookies?.authToken) return req.cookies.authToken;
  if (req.headers.authorization?.startsWith("Bearer "))
    return req.headers.authorization.slice(7);
  return null;
}