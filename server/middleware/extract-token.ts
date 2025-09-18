import type { Request } from "express";

export function extractAuthToken(req: Request): string | null {
  // Priority 1: HttpOnly cookie (primary method)
  if (req.cookies?.authToken) {
    console.log('Found auth token in cookie');
    return req.cookies.authToken;
  }
  
  // Priority 2: Bearer token (API compatibility)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    console.log('Found auth token in Authorization header');
    return authHeader.slice(7);
  }
  
  console.log('No auth token found in cookie or header');
  return null;
}