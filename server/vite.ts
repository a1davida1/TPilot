
import type { Express } from 'express';
import type { Server as HttpServer } from 'http';
import { createServer as createViteServer } from 'vite';

export async function setupVite(app: Express, server: HttpServer) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        server,
      },
    },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  return vite;
}
