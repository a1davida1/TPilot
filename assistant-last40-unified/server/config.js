/**
 * Configuration constants and environment variables
 */

// Frontend URL configuration
export const FRONTEND_URL = process.env.FRONTEND_URL || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';

// Other config constants can be added here as needed
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
export const NODE_ENV = process.env.NODE_ENV || 'development';