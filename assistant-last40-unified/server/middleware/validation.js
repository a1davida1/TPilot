/**
 * Validation middleware for request validation
 */

import { z } from 'zod';

// Validation middleware factory
export function validate(schema) {
  return (req, res, next) => {
    try {
      // Validate request body against schema
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors
        });
      }
      next(error);
    }
  };
}

// Common validation schemas
export const loginValidationSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1)
});

export const signupValidationSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

export default validate;