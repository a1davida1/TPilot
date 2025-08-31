import { Express } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import { storage } from './storage';
import { emailService } from './services/email-service';
import crypto from 'crypto';
import { z } from 'zod';
import { authLimiter } from './middleware/security.js';
import { safeLog, redactUserData } from './lib/logger-utils.js';

// Auth validation schemas
const signupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
});

const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters')
}).refine(data => data.username || data.email, {
  message: 'Either username or email is required'
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for secure token operations');
}
// Type assertion after validation
const JWT_SECRET_VALIDATED: string = JWT_SECRET;

export function setupAuth(app: Express) {
  // Regular signup
  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    try {
      // Validate input
      const validationResult = signupSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }
      
      const { username, password, email } = validationResult.data;

      // Check if user exists by username OR email
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        tier: 'free'
      });

      // Create verification token and send email
      if (user.email) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await storage.createVerificationToken({
          userId: user.id,
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
      }

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      safeLog('error', 'Authentication signup failed', { error: error.message });
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Regular login
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      // Validate input
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }
      
      const { username, password, email } = validationResult.data;

      // ADMIN LOGIN CHECK FIRST (using environment variables)
      const loginIdentifier = email || username;
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
      
      if (ADMIN_EMAIL && ADMIN_PASSWORD && loginIdentifier === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const adminUser = {
          id: 999,
          email: ADMIN_EMAIL,
          username: 'admin',
          tier: 'pro',
          isAdmin: true
        };

        const token = jwt.sign(
          { 
            userId: adminUser.id, 
            id: adminUser.id, 
            email: adminUser.email, 
            username: adminUser.username, 
            isAdmin: true
          },
          JWT_SECRET_VALIDATED,
          { expiresIn: '24h' }
        );

        return res.json({
          message: 'Admin login successful',
          token,
          user: adminUser
        });
      }

      // Regular user login logic continues below
      const loginEmail = email || username;

      // Try to find user by username first, then by email
      let user = await storage.getUserByUsername(username || loginEmail || '');
      if (!user && loginEmail) {
        user = await storage.getUserByEmail(loginEmail);
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ message: 'Email not verified' });
      }

      const token = jwt.sign(
        { id: user.id, userId: user.id, username: user.username },
        JWT_SECRET_VALIDATED,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tier: user.tier
        }
      });
    } catch (error) {
      safeLog('error', 'Authentication login failed', { error: error.message });
      res.status(500).json({ message: 'Error logging in' });
    }
  });

  // Email verification
  app.get('/api/auth/verify-email', authLimiter, async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const record = await storage.getVerificationToken(token);
      if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Get user details for welcome email
      const user = await storage.getUser(record.userId);
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // In the email verification endpoint, after marking email as verified:
      await storage.updateUserEmailVerified(user.id, true);
      await storage.deleteVerificationToken(token);

      // Send welcome email
      if (user.email) {
        await emailService.sendWelcomeEmail(user.email, user.username);
      }

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      safeLog('error', 'Email verification failed', { error: error.message });
      res.status(500).json({ message: 'Error verifying email' });
    }
  });

  // OAuth routes removed - placeholder routes created unnecessary attack surface
  // When ready to implement, use proper OAuth libraries and security practices

  // Password reset request
  app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      // Send password reset email
      if (user.email) {
        await emailService.sendPasswordResetEmail(user.email, user.username);
      }

      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      safeLog('error', 'Password reset request failed', { error: error.message });
      res.status(500).json({ message: 'Error processing password reset' });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as any;
      
      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid reset token' });
      }

      // Find user and update password
      const user = await storage.getUserByEmail(decoded.email);
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid reset token' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user password (would need to add this method to storage)
      await storage.updateUserPassword(user.id, hashedPassword);

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(400).json({ message: 'Reset link has expired' });
      }
      safeLog('error', 'Password reset failed', { error: error.message });
      res.status(500).json({ message: 'Error resetting password' });
    }
  });

  // Get current user endpoint (CRITICAL - this was missing!)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Try JWT token authentication
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as any;
          
          // Handle admin user
          if (decoded.isAdmin) {
            return res.json({
              id: 999,
              email: process.env.ADMIN_EMAIL || 'admin@thottopilot.com',
              username: 'admin',
              tier: 'admin',
              isAdmin: true
            });
          }
          
          // Handle regular user
          const user = await storage.getUser(decoded.userId || decoded.id);
          if (user) {
            const { password: _, ...userResponse } = user;
            return res.json({
              ...userResponse,
              tier: userResponse.tier || 'free'
            });
          }
          
          return res.json({
            ...decoded,
            tier: decoded.tier || 'free'
          });
        } catch (jwtError) {
          safeLog('error', 'JWT verification failed', { error: jwtError.message });
          return res.status(401).json({ message: 'Invalid token' });
        }
      }

      return res.status(401).json({ message: 'Access token required' });
    } catch (error) {
      safeLog('error', 'Get user failed', { error: error.message });
      res.status(500).json({ message: 'Error fetching user data' });
    }
  });

}