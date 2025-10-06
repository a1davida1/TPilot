import type { Server } from 'http';

/**
 * Test utilities for cleaning up resources and preventing handle leaks
 */

/**
 * Close an HTTP server and wait for all connections to terminate
 */
export async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) return;
  
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Close database connections to prevent handle leaks
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    const { closeDatabaseConnections } = await import('../server/db.js');
    await closeDatabaseConnections();
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
}

/**
 * Complete cleanup - close server and database connections
 */
export async function cleanupAll(server?: Server): Promise<void> {
  await closeServer(server);
  await closeDatabaseConnections();
  
  // Give a moment for all connections to fully close
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Print any remaining open handles (for debugging)
 */
export function logOpenHandles(): void {
  if (typeof process !== 'undefined' && process.getActiveResourcesInfo) {
    const handles = process.getActiveResourcesInfo();
    if (handles && handles.length > 0) {
      console.log('⚠️  Open handles:', handles);
    }
  }
}
