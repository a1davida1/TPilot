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

      // For development, provide immediate authentication
      // For production, require email verification
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        // Automatically verify email in development
        await storage.updateUserEmailVerified(user.id, true);
        
        // Generate JWT token for immediate authentication
        const token = jwt.sign(
          {
            id: user.id,
            userId: user.id,
            username: user.username,
            isAdmin: user.isAdmin,
            role: user.role
          },
          JWT_SECRET_VALIDATED,
          { expiresIn: '24h' }
        );

        // Set JWT in HttpOnly cookie
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(201).json({
          message: 'User created successfully',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            tier: user.tier,
            isAdmin: user.isAdmin,
            role: user.role,
            emailVerified: true
          }
        });
      } else {
        // Production: Create verification token and send email
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
      }
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
      const loginIdentifier = email || username;

      // CHECK FOR ADMIN LOGIN FIRST
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
      
      if (ADMIN_EMAIL && ADMIN_PASSWORD && 
          loginIdentifier === ADMIN_EMAIL && 
          password === ADMIN_PASSWORD) {
        
        // Create admin token
        const token = jwt.sign(
          {
            id: 999,
            userId: 999,
            username: 'admin',
            isAdmin: true,
            role: 'admin',
            tier: 'premium'
          },
          JWT_SECRET_VALIDATED,
          { expiresIn: '24h' }
        );

        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        });

        return res.json({
          user: {
            id: 999,
            username: 'admin',
            email: ADMIN_EMAIL,
            tier: 'premium',
            isAdmin: true,
            role: 'admin'
          }
        });
      }

      // Regular user login continues...
      let user;
      if (loginIdentifier && loginIdentifier.includes('@')) {
        // It's an email
        user = await storage.getUserByEmail(loginIdentifier);
      } else {
        // It's a username
        user = await storage.getUserByUsername(loginIdentifier || '');
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

      // Check if user must change password (temporary password)
      if (user.mustChangePassword) {
        return res.status(202).json({ 
          message: 'Password change required', 
          mustChangePassword: true,
          userId: user.id 
        });
      }

      // Update last login time
      await storage.updateUser(user.id, { lastLogin: new Date() });

      const token = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          role: user.role
        },
        JWT_SECRET_VALIDATED,
        { expiresIn: '24h' }
      );

      // Set JWT in HttpOnly cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tier: user.tier,
          isAdmin: user.isAdmin,
          role: user.role
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

      // Redirect to success page instead of returning JSON
      res.redirect('/dashboard?verified=true&welcome=true');
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
      
      // Production debugging
      console.log('🔍 Password reset request received for:', email);
      console.log('🔍 SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
      console.log('🔍 Email service configured:', emailService.isEmailServiceConfigured);
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log('🔍 User not found for email:', email);
        // Don't reveal if email exists for security
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      console.log('🔍 User found:', user.username, 'attempting to send email...');
      
      // Send password reset email
      if (user.email) {
        console.log('🔍 Calling emailService.sendPasswordResetEmail...');
        await emailService.sendPasswordResetEmail(user.email, user.username);
        console.log('🔍 Email service call completed');
      }

      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      console.error('❌ Password reset failed:', error.message);
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

      // Decode the token (it might be URL encoded from the frontend)
      const decodedToken = decodeURIComponent(token);
      
      // Verify token
      let decoded: any;
      try {
        decoded = jwt.verify(decodedToken, JWT_SECRET_VALIDATED) as any;
      } catch (verifyError: any) {
        if (verifyError.name === 'TokenExpiredError') {
          return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
        }
        if (verifyError.name === 'JsonWebTokenError') {
          return res.status(400).json({ message: 'Invalid reset token. Please request a new reset link.' });
        }
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      
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

  // Email service health check endpoint
  app.get('/api/auth/email-status', (req, res) => {
    const status = {
      configured: emailService.isEmailServiceConfigured,
      sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
      from_email: process.env.FROM_EMAIL || 'not set',
      frontend_url: process.env.FRONTEND_URL || 'not set',
      jwt_secret_exists: !!process.env.JWT_SECRET,
      node_env: process.env.NODE_ENV || 'not set',
      deployment: process.env.REPLIT_DEPLOYMENT || 'not set'
    };
    
    console.log('📊 Email service status check:', status);
    res.json(status);
  });

  // Get current user endpoint (CRITICAL - this was missing!)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      let token = null;

      // Try cookie-based authentication first (preferred)
      if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
      }
      // Fallback to Bearer token authentication  
      else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }

      if (!token) {
        return res.status(401).json({ message: 'Access token required' });
      }
        
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as any;
        
        // CHECK IF IT'S ADMIN TOKEN
        if (decoded.id === 999 || decoded.isAdmin) {
          return res.json({
            id: 999,
            username: 'admin',
            email: process.env.ADMIN_EMAIL,
            tier: 'premium',
            isAdmin: true,
            role: 'admin',
            emailVerified: true
          });
        }
        
        // Regular user lookup
        const user = await storage.getUser(decoded.userId || decoded.id);
        if (user) {
          const { password: _, ...userResponse } = user;
          return res.json({
            ...userResponse,
            tier: userResponse.tier || 'free'
          });
        }

        return res.status(404).json({ message: 'User not found' });
      } catch (jwtError) {
        safeLog('error', 'JWT verification failed', { error: jwtError.message });
        return res.status(401).json({ message: 'Invalid token' });
      }
    } catch (error) {
      safeLog('error', 'Get user failed', { error: error.message });
      res.status(500).json({ message: 'Error fetching user data' });
    }
  });

  // Force password change endpoint (for temporary passwords)
  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear mustChangePassword flag
      await storage.updateUserPassword(userId, hashedNewPassword);
      await storage.updateUser(userId, { 
        mustChangePassword: false,
        lastLogin: new Date()
      });

      // Create token for immediate login
      const token = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          role: user.role
        },
        JWT_SECRET_VALIDATED,
        { expiresIn: '24h' }
      );

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.json({
        message: 'Password changed successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tier: user.tier,
          isAdmin: user.isAdmin,
          role: user.role
        }
      });
    } catch (error) {
      safeLog('error', 'Password change failed', { error: error.message });
      res.status(500).json({ message: 'Error changing password' });
    }
  });

}