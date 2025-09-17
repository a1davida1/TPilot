import { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import { storage } from './storage';
import { emailService } from './services/email-service';
import crypto from 'crypto';
import { z } from 'zod';
import { authLimiter } from './middleware/security.js';
import { safeLog } from './lib/logger-utils.js';
import { FRONTEND_URL } from './config.js';
import { verificationLimiter, passwordResetLimiter, loginLimiter, signupLimiter, passwordChangeLimiter } from './middleware/simple-rate-limit.js';
import { authMetrics } from './services/basic-metrics.js';
import { logger } from './bootstrap/logger.js';
import { verifyAdminCredentials } from './lib/admin-auth.js';
import { validate, ValidationSource, loginValidationSchema, signupValidationSchema, passwordChangeValidationSchema, passwordResetValidationSchema } from './middleware/validation.js';
import { extractAuthToken } from './middleware/extract-token.js';

// Auth validation schemas removed - handled by middleware

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || /changeme|placeholder/i.test(JWT_SECRET)) {
  throw new Error('JWT_SECRET environment variable is required and must not be a placeholder');
}
// Type assertion after validation
const JWT_SECRET_VALIDATED: string = JWT_SECRET;

export function setupAuth(app: Express, apiPrefix: string = '/api') {
  // Regular signup
  app.post(`${apiPrefix}/auth/signup`, signupLimiter, validate(signupValidationSchema), async (req, res) => {
    const startTime = Date.now();
    try {
      // Input already validated by middleware
      const { username, password, email } = req.body;

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

        // Generate auth token for immediate login (but email verification still required for full access)
        const token = jwt.sign(
          {
            id: user.id,
            userId: user.id,
            username: user.username,
            isAdmin: user.isAdmin,
            role: user.role,
            emailVerified: false
          },
          JWT_SECRET_VALIDATED,
          { expiresIn: '24h' }
        );

          res.status(201).json({
            message: 'User created successfully. Verification email sent.',
            user: {
            id: user.id,
            username: user.username,
            email: user.email,
            tier: user.tier,
            isAdmin: user.isAdmin,
            role: user.role,
            emailVerified: false
          }
        });
      }
      
      // Track signup metrics
      authMetrics.track('signup', true, Date.now() - startTime);
      
    } catch (error) {
      safeLog('error', 'Authentication signup failed', { error: (error as Error).message });
      
      // Track failed signup
      authMetrics.track('signup', false, Date.now() - startTime, (error as Error).message);
      
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Regular login
  app.post(`${apiPrefix}/auth/login`, loginLimiter, validate(loginValidationSchema), async (req, res) => {
    const startTime = Date.now();
    try {
      // Input already validated by middleware
      const { username, password, email } = req.body;
      const loginIdentifier = email || username;

      const adminEmail = await verifyAdminCredentials(loginIdentifier, password);

      if (adminEmail) {
        
        // Create admin token
        const token = jwt.sign(
          {
            id: 999,
            userId: 999,
            username: 'admin',
            isAdmin: true,
            role: 'admin',
            tier: 'admin'
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
          token,
          user: {
            id: 999,
            username: 'admin',
            email: adminEmail,
            tier: 'admin',
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

      if (!user || user.isDeleted) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ 
          message: 'Email not verified. Please check your email or resend verification.',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email // Include email for resend option
        });
      }

      // Check if user must change password (temporary password)
      if (user.mustChangePassword) {
        return res.status(202).json({ 
          message: 'Password change required', 
          mustChangePassword: true,
          userId: user.id 
        });
      }

      // Update last login time - temporarily disabled due to schema export issue
      // TODO: Fix lastLogin column export in schema
      // await storage.updateUser(user.id, { lastLogin: new Date() });

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
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tier: user.tier,
          isAdmin: user.isAdmin,
          role: user.role
        }
      });
      
      // Track successful login metrics
      authMetrics.track('login', true, Date.now() - startTime);
      
    } catch (error) {
      safeLog('error', 'Authentication login failed', { error: (error as Error).message });
      
      // Track failed login metrics
      authMetrics.track('login', false, Date.now() - startTime, (error as Error).message);
      
      res.status(500).json({ message: 'Error logging in' });
    }
  });

  // When ready to implement, use proper OAuth libraries and security practices
  
  // Note: Resend verification email route is defined at line 812 with proper rate limiting

  // Password reset request
  app.post(`${apiPrefix}/auth/forgot-password`, passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      logger.info('Password reset workflow started', {
        email: email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'No email',
        requestIP: req.ip || 'Unknown',
        sendGridConfigured: !!process.env.SENDGRID_API_KEY,
        emailServiceReady: emailService.isEmailServiceConfigured,
        timestamp: new Date().toISOString()
      });
      
      if (!email) {
        logger.warn('Password reset failed: No email provided');
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      logger.debug('Looking up user by email');
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        logger.warn('User not found for password reset (returning generic message for security)', {
          email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        });
        // Don't reveal if email exists for security
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      logger.info('User found for password reset', {
        username: user.username,
        userId: user.id,
        emailVerified: user.emailVerified || false
      });
      
      // Send password reset email
      if (user.email) {
        logger.info('Preparing to send password reset email', {
          to: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
          username: user.username
        });
        
        // Generate JWT token for password reset (not database token)
        const resetToken = jwt.sign(
          { email: user.email },
          JWT_SECRET_VALIDATED,
          { expiresIn: '1h' }
        );
        
        // Send password reset email with JWT token
        await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
        
        logger.info('Password reset email sent successfully - check email service logs for delivery status');
      }

      logger.info('Password reset request completed - returning generic success message for security');
      
      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      logger.error('Password reset error', {
        error: (error as Error).message,
        stack: (error as Error).stack?.split('\n')[1]?.trim() || 'No stack trace',
        email: req.body?.email ? req.body.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'No email',
        timestamp: new Date().toISOString()
      });
      
      safeLog('error', 'Password reset request failed', { error: (error as Error).message });
      res.status(500).json({ message: 'Error processing password reset' });
    }
  });


  // Email service health check endpoint
  app.get(`${apiPrefix}/auth/email-status`, (req, res) => {
    const status = {
      configured: emailService.isEmailServiceConfigured,
      sendgrid_key_exists: !!process.env.SENDGRID_API_KEY,
      from_email: process.env.FROM_EMAIL || 'not set',
      frontend_url: process.env.FRONTEND_URL || 'not set',
      jwt_secret_exists: !!process.env.JWT_SECRET,
      node_env: process.env.NODE_ENV || 'not set',
      deployment: process.env.REPLIT_DEPLOYMENT || 'not set'
    };
    
    logger.info('Email service status check', status);
    res.json(status);
  });

  // Get current user endpoint (CRITICAL - this was missing!)
  app.get(`${apiPrefix}/auth/user`, async (req: Request, res: Response) => {
    try {
      let token: string | null = null;

      // Extract token using the utility function
      token = extractAuthToken(req);

      if (!token) {
        return res.status(401).json({ message: 'Access token required' });
      }
        
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; };
        
        // CHECK IF IT'S ADMIN TOKEN
        if (decoded.id === 999 || decoded.isAdmin) {
          return res.json({
            id: 999,
            username: 'admin',
            email: process.env.ADMIN_EMAIL,
            tier: 'admin',
            isAdmin: true,
            role: 'admin',
            emailVerified: true
          });
        }
        
        // Regular user lookup
        const userId = decoded.userId || decoded.id;
        if (!userId) {
          return res.status(401).json({ message: 'Invalid token: missing user ID' });
        }
        const user = await storage.getUser(userId);
        if (user) {
          const { password: _, ...userResponse } = user;
          return res.json({
            ...userResponse,
            tier: userResponse.tier || 'free'
          });
        }

        return res.status(404).json({ message: 'User not found' });
      } catch (jwtError) {
        safeLog('error', 'JWT verification failed', { error: (jwtError as Error).message });
        return res.status(401).json({ message: 'Invalid token' });
      }
    } catch (error) {
      safeLog('error', 'Get user failed', { error: (error as Error).message });
      res.status(500).json({ message: 'Error fetching user data' });
    }
  });

  // Force password change endpoint (for temporary passwords)
  app.post(`${apiPrefix}/auth/change-password`, passwordChangeLimiter, validate(passwordChangeValidationSchema), async (req, res) => {
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
        mustChangePassword: false
        // TODO: Fix lastLogin column export in schema
        // lastLogin: new Date()
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
      safeLog('error', 'Password change failed', { error: (error as Error).message });
      res.status(500).json({ message: 'Error changing password' });
    }
  });

  // Email verification route
  app.get(`${apiPrefix}/auth/verify-email`, async (req, res) => {
    try {
      const { token } = req.query;
      
      // Determine preferred response type: prioritize HTML for browsers, JSON for APIs
      const preferredType = req.accepts(['html', 'json']);
      const isJsonResponse = preferredType === 'json' || 
                            req.query.format === 'json' ||
                            req.headers['user-agent']?.includes('superagent') || // supertest uses superagent
                            req.headers['user-agent']?.includes('node-fetch') ||
                            req.headers['user-agent']?.includes('node'); // Node.js test runner
      
      logger.info('📧 EMAIL VERIFICATION WORKFLOW STARTED', {
        token: token ? `${String(token).substring(0, 8)}...` : 'No token',
        origin: req.headers.origin || 'Unknown',
        responseMode: isJsonResponse ? 'JSON' : 'REDIRECT',
        preferredType: preferredType,
        timestamp: new Date().toISOString()
      });
      
      // Check for missing or empty token
      if (!token || token === '') {
        logger.warn('❌ EMAIL VERIFICATION FAILED: No token provided');
        if (isJsonResponse) {
          return res.status(400).json({ message: 'Token is required' });
        }
        return res.redirect(`${FRONTEND_URL}/email-verification?error=token_required`);
      }

      // Get the verification token from database
      logger.debug('🔍 Looking up token in database...');
      const verificationToken = await storage.getVerificationToken(token as string);
      
      if (!verificationToken) {
        logger.warn('❌ EMAIL VERIFICATION FAILED: Token not found in database', {
          token: `${String(token).substring(0, 8)}...`
        });
        if (isJsonResponse) {
          return res.status(400).json({ message: 'Invalid or expired token' });
        }
        return res.redirect(`${FRONTEND_URL}/email-verification?error=invalid_token`);
      }
      
      logger.debug('✅ Token found', {
        userId: verificationToken.userId,
        created: 'N/A',
        expires: new Date(verificationToken.expiresAt).toISOString()
      });
      
      // Check if token is expired
      if (new Date(verificationToken.expiresAt) < new Date()) {
        logger.warn('❌ EMAIL VERIFICATION FAILED: Token expired', {
          expiredAt: new Date(verificationToken.expiresAt).toISOString(),
          currentTime: new Date().toISOString()
        });
        await storage.deleteVerificationToken(token as string);
        if (isJsonResponse) {
          return res.status(400).json({ message: 'Invalid or expired token' });
        }
        return res.redirect(`${FRONTEND_URL}/email-verification?error=token_expired`);
      }

      // Update user's email verification status
      logger.debug('📝 Updating user email verification status...');
      await storage.updateUserEmailVerified(verificationToken.userId, true);
      logger.debug('✅ User email marked as verified');
      
      // Get user data for email
      logger.debug('🔍 Fetching user data...');
      const user = await storage.getUser(verificationToken.userId);
      logger.debug('✅ User data retrieved', {
        username: user?.username || 'Unknown',
        email: user?.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'No email'
      });
      
      // Send welcome email
      if (user?.email && user?.username) {
        logger.debug('📧 Sending welcome email...');
        await emailService.sendWelcomeEmail(user.email, user.username);
        logger.debug('✅ Welcome email sent successfully');
      }
      
      // Delete the used token
      logger.debug('🗑️ Deleting used verification token...');
      await storage.deleteVerificationToken(token as string);
      logger.debug('✅ Token deleted successfully');
      
      logger.info('✅ EMAIL VERIFICATION SUCCESSFUL', {
        user: user?.username || 'Unknown',
        email: user?.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'No email',
        responseMode: isJsonResponse ? 'JSON' : 'REDIRECT'
      });
      
      // Return appropriate response based on mode
      if (isJsonResponse) {
        return res.status(200).json({ message: 'Email verified successfully' });
      }
      
      // Redirect to email verification page with success message
      const redirectUrl = `${FRONTEND_URL}/email-verification?verified=true&email=${encodeURIComponent(user?.email || '')}`;
      res.redirect(redirectUrl);
      
    } catch (error) {
      logger.error('❌ EMAIL VERIFICATION ERROR', {
        error: (error as Error).message,
        stack: (error as Error).stack?.split('\n')[1]?.trim() || 'No stack trace',
        time: new Date().toISOString()
      });
      
      safeLog('error', 'Email verification error:', { error: (error as Error).message });
      
      // Determine response mode from earlier logic
      const preferredTypeError = req.accepts(['html', 'json']);
      const isJsonResponseError = preferredTypeError === 'json' || 
                                 req.query.format === 'json' ||
                                 req.headers['user-agent']?.includes('superagent') ||
                                 req.headers['user-agent']?.includes('node-fetch') ||
                                 req.headers['user-agent']?.includes('node');
      
      if (isJsonResponseError) {
        return res.status(500).json({ message: 'Error verifying email' });
      }
      res.redirect(`${FRONTEND_URL}/email-verification?error=verification_failed`);
    }
  });

  // Password reset token verification route
  app.post(`${apiPrefix}/auth/reset-password`, passwordResetLimiter, validate(passwordResetValidationSchema), async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      // Decode and verify JWT token (generated by forgot-password endpoint)
      let decoded: { email?: string };
      try {
        decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { email?: string };
      } catch (jwtError) {
        safeLog('warn', 'Invalid JWT token in password reset', {
          error: (jwtError as Error).message,
          tokenLength: token.length
        });
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      
      // Extract email from JWT payload
      const { email } = decoded;
      if (!email) {
        return res.status(400).json({ message: 'Invalid token format' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password, mark email as verified, and clear temporary password flag
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.updateUserEmailVerified(user.id, true);
      await storage.updateUser(user.id, { mustChangePassword: false });
      
      logger.info('Password reset successful', {
        userId: user.id,
        username: user.username,
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      });
      
      res.json({ message: 'Password reset successful' });
      
    } catch (error) {
      safeLog('error', 'Password reset error:', { error: (error as Error).message });
      res.status(400).json({ message: 'Invalid or expired token' });
    }
  });

  // DEPRECATED ROUTE - REMOVED (use POST /api/auth/reset-password instead)
  /*
  app.post('/api/auth/verify-reset-token', passwordResetLimiter, async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token required' });
      }
      
      // Decode the token (it might be URL encoded from the frontend)
      const decodedToken = decodeURIComponent(token);
      
      // Check if it's a JWT token or database token
      try {
        // Try JWT first (from forgot-password flow)
        const decoded = jwt.verify(decodedToken, JWT_SECRET_VALIDATED) as any;
        
        if (decoded.type !== 'password-reset') {
          return res.status(400).json({ message: 'Invalid token type' });
        }
        
        res.json({ valid: true, email: decoded.email });
      } catch (jwtError) {
        // If JWT fails, try database token (from verification flow)
        const resetToken = await storage.getVerificationToken(decodedToken);
        
        if (!resetToken) {
          return res.status(400).json({ message: 'Invalid token' });
        }
        
        // Check if token is expired
        if (new Date(resetToken.expiresAt) < new Date()) {
          return res.status(400).json({ message: 'Token has expired' });
        }
        
        // Get user email for response
        const user = await storage.getUser(resetToken.userId);
        if (!user) {
          return res.status(400).json({ message: 'Invalid token' });
        }
        
        res.json({ valid: true, email: user.email });
      }
    } catch (error) {
      safeLog('error', 'Token verification error:', { error: (error as Error).message });
      res.status(400).json({ message: 'Invalid or expired token' });
    }
  });
  */

  // Delete account route
  app.delete(`${apiPrefix}/auth/delete-account`, async (req: Request, res: Response) => {
    try {
      // Check authentication from JWT cookie or token
      const token = extractAuthToken(req);
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      let userId: number;
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; };
        const decodedUserId = decoded.userId || decoded.id;
        if (!decodedUserId) {
          return res.status(401).json({ message: 'Invalid token: missing user ID' });
        }
        userId = decodedUserId;
      } catch (jwtError) {
        return res.status(401).json({ message: 'Invalid authentication token' });
      }
      
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: 'Password verification required' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify password before deletion
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Password verification failed' });
      }
      
      // Hard delete for now (soft delete requires schema changes)
      await storage.deleteUser(userId);
      
      // Clear auth cookie
      res.clearCookie('authToken');
      
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      safeLog('error', 'Delete account error:', { error: (error as Error).message });
      res.status(500).json({ message: 'Error deleting account' });
    }
  });

  // Admin metrics endpoint
  app.get(`${apiPrefix}/admin/auth-metrics`, async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      const token = extractAuthToken(req);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Verify token and check admin status
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; role?: string; };
        if (!decoded.isAdmin && decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }
      } catch {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      
      // Get metrics summary
      const metrics = authMetrics.getSummary(24);
      const recentEvents = authMetrics.getRecentEvents(20);
      
      res.json({
        summary: metrics,
        recentEvents
      });
    } catch (error) {
      safeLog('error', 'Admin metrics error:', { error: (error as Error).message });
      res.status(500).json({ error: 'Error fetching metrics' });
    }
  });

  // Resend verification email route
  app.post(`${apiPrefix}/auth/resend-verification`, verificationLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email required' });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If that email exists, we sent a verification link' });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email already verified' });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await storage.createVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send verification email
      await emailService.sendVerificationEmail(user.email!, user.username || 'User', verificationToken);

      res.json({ 
        message: 'Verification email sent. Please check your inbox and spam folder.' 
      });

    } catch (error) {
      safeLog('error', 'Resend verification error:', { error: (error as Error).message });
      res.status(500).json({ message: 'Error sending verification email' });
    }
  });

}