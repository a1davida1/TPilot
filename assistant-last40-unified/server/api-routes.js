/**
 * Core API routes configuration and handlers
 */

import express from 'express';

const router = express.Router();

// Core API route handlers
export function setupApiRoutes(app) {
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Version endpoint  
  router.get('/version', (req, res) => {
    res.json({ 
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });
  
  app.use('/api', router);
}

// API utilities
export function createApiResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

export function createApiError(message, code = 'UNKNOWN_ERROR') {
  return {
    success: false,
    error: {
      message,
      code
    },
    timestamp: new Date().toISOString()
  };
}

export default { setupApiRoutes, createApiResponse, createApiError };