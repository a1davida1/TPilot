import { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { emailService } from './services/email-service';
import { db } from './db';
import { creatorAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { safeLog } from './lib/logger-utils.js';
import { FRONTEND_URL } from './config.js';
import { verificationLimiter, passwordResetLimiter, loginLimiter, signupLimiter, passwordChangeLimiter } from './middleware/simple-rate-limit.js';
import { authMetrics } from './services/basic-metrics.js';
import { logger } from './bootstrap/logger.js';
import { validate, loginValidationSchema, signupValidationSchema, passwordChangeValidationSchema, passwordResetValidationSchema } from './middleware/validation.js';
import { extractAuthToken } from './middleware/extract-token.js';
import { API_PREFIX, prefixApiPath } from './lib/api-prefix.js';
import { assertExists } from '../helpers/assert';
import { getCookieConfig } from './utils/cookie-config.js';
import { ensureAdminAccount, verifyAdminCredentials, getAdminCredentials } from './lib/admin-auth.js';

// Auth validation schemas removed - handled by middleware

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || /changeme|placeholder/i.test(JWT_SECRET)) {
  throw new Error('JWT_SECRET environment variable is required and must not be a placeholder');
}
// Type assertion after validation
const JWT_SECRET_VALIDATED: string = JWT_SECRET;

export async function setupAuth(app: Express, apiPrefix: string = API_PREFIX) {
  const route = (path: string) => prefixApiPath(path, apiPrefix);

  logger.info('Setting up auth routes', {
    apiPrefix,
    signupRoute: route('/auth/signup'),
    loginRoute: route('/auth/login')
  });

  // Ensure the bootstrap admin account exists before routes become live.
  // Uses ADMIN_EMAIL and ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD) env vars.
  try {
    await ensureAdminAccount();
  } catch (err) {
    logger.error('Failed to ensure admin account exists', { err });
  }

  // Regular signup
  app.post(route('/auth/signup'), signupLimiter, validate(signupValidationSchema), async (req, res) => {
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

      const cfg = getCookieConfig();
      const cookieOptions = {
        ...cfg.options,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (86400000 ms)
      };

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
        res.cookie(cfg.authName, token, cookieOptions);

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

        // Align production signup response with development by setting auth cookie immediately
        res.cookie(cfg.authName, token, cookieOptions);

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
  app.post(route('/auth/login'), loginLimiter, validate(loginValidationSchema), async (req, res) => {
    const startTime = Date.now();
    try {
      // Input already validated by middleware
      const { username, password, email } = req.body;
      const loginIdentifier = email || username;

      // Remove hardcoded admin backdoor - all logins must go through regular user verification
      // Admin status is determined by isAdmin flag in database, not hardcoded credentials

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

      let validPassword = await bcrypt.compare(password, user.password);
      
      // Admin fallback: if bcrypt fails but this is the admin email, try verifying against env credentials
      if (!validPassword && user.email) {
        const { email: adminEmail } = getAdminCredentials();
        if (adminEmail && user.email === adminEmail) {
          const adminEmailVerified = await verifyAdminCredentials(loginIdentifier, password);
          if (adminEmailVerified) {
            // Password is correct per env vars - resync the database
            const hashedPassword = await bcrypt.hash(password, 10);
            await storage.updateUser(user.id, { password: hashedPassword });
            validPassword = true;
          }
        }
      }
      
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

      // Update last login time for auditing and session management
      await storage.updateUserLastLogin(user.id, new Date());

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
      const cfg = getCookieConfig();
      res.cookie(cfg.authName, token, {
        ...cfg.options,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (86400000 ms)
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
  app.post(route('/auth/forgot-password'), passwordResetLimiter, async (req, res) => {
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
  app.get(route('/auth/email-status'), (req, res) => {
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
  app.get(route('/auth/user'), async (req: Request, res: Response) => {
    try {
      let token: string | null = null;

      // Extract token using the utility function
      token = extractAuthToken(req);

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; };

        // Verify admin status through database lookup only

        // Regular user lookup
        const userId = decoded.userId || decoded.id;
        if (!userId) {
          return res.status(401).json({ error: 'Invalid token: missing user ID' });
        }
        const user = await storage.getUser(userId);
        if (user) {
          const { password: _, ...userResponse } = user;
          const isAdmin = Boolean(userResponse.isAdmin || userResponse.role === 'admin');
          
          // Check for Reddit connection
          let redditUsername: string | null = null;
          try {
            const redditAccounts = await db
              .select()
              .from(creatorAccounts)
              .where(
                and(
                  eq(creatorAccounts.userId, userId),
                  eq(creatorAccounts.platform, 'reddit'),
                  eq(creatorAccounts.isActive, true)
                )
              )
              .limit(1);
            
            if (redditAccounts.length > 0) {
              redditUsername = redditAccounts[0].platformUsername || redditAccounts[0].handle || null;
            }
          } catch (err) {
            console.error('Failed to fetch Reddit connection status:', err);
          }
          
          return res.json({
            ...userResponse,
            tier: userResponse.tier || 'free',
            isAdmin,
            redditUsername,
            reddit_username: redditUsername // For backwards compatibility
          });
        }

        return res.status(404).json({ error: 'User not found' });
      } catch (jwtError) {
        safeLog('error', 'JWT verification failed', { error: (jwtError as Error).message });
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      safeLog('error', 'Get user failed', { error: (error as Error).message });
      res.status(500).json({ message: 'Error fetching user data' });
    }
  });

  // Force password change endpoint (for temporary passwords)
  app.post(route('/auth/change-password'), passwordChangeLimiter, validate(passwordChangeValidationSchema), async (req, res) => {
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
        return res.status(404).json({ error: 'User not found' });
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
      await storage.updateUser(userId, { mustChangePassword: false });
      await storage.updateUserLastLogin(userId, new Date());

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

      const cfg = getCookieConfig();
      res.cookie(cfg.authName, token, {
        ...cfg.options,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (86400000 ms)
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
  app.get(route('/auth/verify-email'), async (req, res) => {
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
          return res.status(400).json({ error: 'Token is required' });
        }
        return res.redirect(`${FRONTEND_URL}/email-verification?error=token_required`);
      }

      // Get the verification token from database
      logger.debug('🔍 Consuming token from database...');
      const verificationToken = await storage.consumeVerificationToken(token as string);

      if (!verificationToken) {
        logger.warn('❌ EMAIL VERIFICATION FAILED: Token not found or already consumed', {
          token: `${String(token).substring(0, 8)}...`
        });
        if (isJsonResponse) {
          return res.status(400).json({ error: 'Invalid or expired token' });
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
        if (isJsonResponse) {
          return res.status(400).json({ error: 'Invalid or expired token' });
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

      // Token already consumed earlier in flow; log the outcome
      logger.debug('🗑️ Verification token consumed successfully');

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
        return res.status(500).json({ error: 'Error verifying email' });
      }
      res.redirect(`${FRONTEND_URL}/email-verification?error=verification_failed`);
    }
  });

  // Password reset token verification route
  app.post(route('/auth/reset-password'), passwordResetLimiter, validate(passwordResetValidationSchema), async (req, res) => {
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
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Extract email from JWT payload
      const { email } = decoded;
      if (!email) {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password, mark email as verified, and clear temporary password flag
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.updateUserEmailVerified(user.id, true);
      await storage.updateUser(user.id, { mustChangePassword: false });
      await storage.updateUserLastLogin(user.id, new Date());

      logger.info('Password reset successful', {
        userId: user.id,
        username: user.username,
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      });

      res.json({ message: 'Password reset successful' });

    } catch (error) {
      safeLog('error', 'Password reset error:', { error: (error as Error).message });
      res.status(400).json({ error: 'Invalid or expired token' });
    }
  });

  // DEPRECATED ROUTE - REMOVED (use POST /api/auth/reset-password instead)
  /*
  app.post(route('/auth/verify-reset-token'), passwordResetLimiter, async (req, res) => {
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
        const decoded = jwt.verify(decodedToken, JWT_SECRET_VALIDATED) as jwt.JwtPayload & { type?: string; email?: string };

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
  app.delete(route('/auth/delete-account'), async (req: Request, res: Response) => {
    try {
      // Check authentication from JWT cookie or token
      const token = extractAuthToken(req);

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let userId: number;
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; role?: string };
        const decodedUserId = decoded.userId || decoded.id;
        if (!decodedUserId) {
          return res.status(401).json({ error: 'Invalid token: missing user ID' });
        }
        userId = decodedUserId;
      } catch (jwtError) {
        safeLog('error', 'JWT verification failed during delete account', { error: (jwtError as Error).message });
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password verification required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify password before deletion
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Password verification failed' });
      }

      // Hard delete for now (soft delete requires schema changes)
      await storage.deleteUser(userId);

      // Clear auth cookie using centralized config
      const cfg = getCookieConfig();
      cfg.clear(res, cfg.authName);

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      safeLog('error', 'Delete account error:', { error: (error as Error).message });
      res.status(500).json({ message: 'Error deleting account' });
    }
  });

  // Admin metrics endpoint
  app.get(route('/admin/auth-metrics'), async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      const token = extractAuthToken(req);

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token and check admin status
      try {
        const decoded = jwt.verify(token, JWT_SECRET_VALIDATED) as { userId?: number; id?: number; isAdmin?: boolean; role?: string };
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

  // Logout endpoint
  app.post(route('/auth/logout'), async (req: Request, res: Response) => {
    try {
      const cfg = getCookieConfig();
      
      // Clear session cookie
      cfg.clear(res, cfg.sessionName);
      
      // Clear auth token cookie with both sameSite values to handle both regular auth and OAuth
      cfg.clear(res, cfg.authName); // Default (sameSite: lax)
      cfg.clear(res, cfg.authName, { ...cfg.options, sameSite: 'none' }); // OAuth (sameSite: none)
      
      // Destroy session if exists
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            logger.error('Session destroy error', { error: err });
          }
        });
      }
      
      return res.status(204).end();
    } catch (error) {
      logger.error('Logout error', { error: error instanceof Error ? error.message : String(error) });
      // Even on error, try to clear cookies
      const cfg = getCookieConfig();
      cfg.clear(res, cfg.sessionName);
      cfg.clear(res, cfg.authName);
      cfg.clear(res, cfg.authName, { ...cfg.options, sameSite: 'none' });
      return res.status(204).end();
    }
  });

  // Resend verification email route
  app.post(route('/auth/resend-verification'), verificationLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      // Find user
      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If that email exists, we sent a verification link' });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await storage.createVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send verification email
      assertExists(user.email, 'User email must exist to send verification email');
      await emailService.sendVerificationEmail(user.email, user.username || 'User', verificationToken);

      res.json({ 
        message: 'Verification email sent. Please check your inbox and spam folder.' 
      });

    } catch (error) {
      safeLog('error', 'Resend verification error:', { error: (error as Error).message });
      res.status(500).json({ message: 'Error sending verification email' });
    }
  });

}