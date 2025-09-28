/**
 * Simple rate limiting middleware
 */

// Rate limiting placeholder implementation
export function createRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // max requests per window
    message = 'Too many requests, please try again later.'
  } = options;

  // Mock implementation for testing
  return (req, res, next) => {
    // In a real implementation, this would track requests per IP
    // For tests, we just pass through
    next();
  };
}

export const defaultRateLimit = createRateLimit();
export default createRateLimit;