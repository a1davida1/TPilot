import type { Request } from "express";

export function extractAuthToken(req: Request): string | null {
  // Priority 1: HttpOnly cookie (primary method)
  if (req.cookies?.authToken) {
    return req.cookies.authToken;
  }
  
  // Priority 2: Bearer token (API compatibility)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  return null;
}