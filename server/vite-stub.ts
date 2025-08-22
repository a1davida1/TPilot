// Stub for production builds - vite is only used in development
import type { Express } from "express";
import type { Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // No-op in production
}

export function serveStatic(app: Express) {
  // No-op in production - static files are served differently in production
}