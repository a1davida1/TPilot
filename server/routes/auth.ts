import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from '../storage.js';
import { logger, authLimiter } from '../middleware/security.js';
import { createToken, ADMIN_EMAIL, ADMIN_PASSWORD } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';

const router = express.Router();

// Signup route with rate limiting
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Validate password strength
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with emailVerified set to false
    const newUser = await storage.createUser({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      tier: 'free',
      emailVerified: false // IMPORTANT: Set to false initially
    });

    // Generate verification token
    const verificationToken = jwt.sign(
      { 
        email: newUser.email, 
        userId: newUser.id, 
        type: 'email-verification'  // CRITICAL: Include type
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Send verification email
    console.log('🔐 AUTH WORKFLOW: Preparing to send verification email');
    console.log('🔐 User ID:', newUser.id);
    console.log('🔐 Email:', newUser.email);
    console.log('🔐 Username:', newUser.username);
    console.log('🔐 Token generated:', !!verificationToken);
    
    try {
      if (newUser.email) {
        console.log('🔐 AUTH WORKFLOW: Calling email service for verification email');
        await emailService.sendVerificationEmail(newUser.email, newUser.username || 'User', verificationToken);
        console.log('✅ AUTH WORKFLOW: Verification email workflow completed successfully');
      } else {
        console.log('❌ AUTH WORKFLOW: No email address available for user');
      }
    } catch (emailError) {
      console.error('❌ AUTH WORKFLOW: Verification email send failed');
      console.error('🔐 Email error details:', emailError);
      // Continue anyway - user can request resend
    }

    // Generate JWT token for immediate login (optional)
    const token = createToken(newUser);

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      token,
      user: userResponse,
      emailSent: true
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Login route with rate limiting (unused - handled by server/auth.ts)
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Get the login identifier (could be email or username)
    const loginIdentifier = email || username;
    
    // Debug logging for admin login
    logger.info('🔍 Login attempt:', {
      loginIdentifier,
      receivedPassword: password ? '***masked***' : 'null/undefined',
      adminEmail: ADMIN_EMAIL,
      adminPasswordSet: !!ADMIN_PASSWORD
    });
    
    // Admin login check
    logger.info('🔍 Admin login comparison:', { 
      matches: loginIdentifier === ADMIN_EMAIL && password === ADMIN_PASSWORD 
    });
    
    if (loginIdentifier === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminUser = {
        id: 999,
        email: ADMIN_EMAIL,
        username: 'admin',
        tier: 'premium',
        subscription_status: 'active',
        isAdmin: true,
        role: 'admin',
        features: {
          unlimited_generations: true,
          no_watermark: true,
          api_access: true,
          priority_support: true
        }
      };

      const token = createToken({
        ...adminUser,
        password: '' // Required by UserType but not needed for token
      } as any);

      // Store in session if available
      if (req.session) {
        (req.session as any).user = adminUser;
        (req.session as any).userId = 999;
        (req.session as any).isAdmin = true;
      }

      return res.json({
        message: 'Admin login successful',
        token,
        user: adminUser
      });
    }

    // Find user by email OR username
    let user = await storage.getUserByEmail(loginIdentifier);
    
    if (!user) {
      user = await storage.getUserByUsername(loginIdentifier);
    }
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = createToken(user);

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Get current user
router.get("/user", async (req: any, res) => {
  try {
    // Try session-based authentication first (Passport.js)
    if (req.isAuthenticated && req.isAuthenticated()) {
      
      // Handle admin user case
      if (req.user?.isAdmin || req.user?.id === 999 || req.session?.isAdmin) {
        return res.json({
          id: 999,
          email: ADMIN_EMAIL,
          username: 'admin',
          tier: 'premium',
          subscription_status: 'active',
          isAdmin: true,
          role: 'admin',
          features: {
            unlimited_generations: true,
            no_watermark: true,
            api_access: true,
            priority_support: true
          }
        });
      }

      // Handle regular session user
      const userId = req.user?.userId || req.user?.id;
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          const { password: _, ...userResponse } = user;
          return res.json({
            ...userResponse,
            tier: userResponse.tier || 'free',
            role: userResponse.role || 'user' // Handle nullable role
          });
        }
      }
      
      // Fallback to session user data
      return res.json({
        ...req.user,
        tier: req.user?.tier || 'free'
      });
    }
    
    // Try JWT token authentication as fallback
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const { verifyToken } = await import('../middleware/auth.js');
        const decoded = verifyToken(token) as any;
        
        if (decoded.isAdmin || decoded.id === 999 || decoded.userId === 999) {
          return res.json({
            id: 999,
            email: ADMIN_EMAIL,
            username: 'admin',
            tier: 'premium',
            subscription_status: 'active',
            isAdmin: true,
            role: 'admin',
            features: {
              unlimited_generations: true,
              no_watermark: true,
              api_access: true,
              priority_support: true
            }
          });
        }
        
        const user = await storage.getUser(decoded.userId || decoded.id);
        if (user) {
          const { password: _, ...userResponse } = user;
          return res.json({
            ...userResponse,
            tier: userResponse.tier || 'free',
            role: userResponse.role || 'user' // Handle nullable role
          });
        }
        
        return res.json({
          ...decoded,
          tier: decoded.tier || 'free'
        });
      } catch (jwtError) {
        logger.error('JWT verification error:', jwtError);
        return res.status(401).json({ message: 'Invalid token' });
      }
    }

    return res.status(401).json({ message: 'Access token required' });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Logout route
router.post("/logout", (req: any, res) => {
  logger.info('Logout attempt - session ID:', req.sessionID);
  logger.info('Session authenticated?:', req.isAuthenticated ? req.isAuthenticated() : false);
  
  // Handle Passport logout first, then destroy session
  const handleSessionDestroy = () => {
    // Always clear JWT authentication cookie first
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    if (req.session) {
      // Clear user data
      delete (req.session as any).user;
      delete (req.session as any).userId;
      delete (req.session as any).isAdmin;
      
      req.session.destroy((err: any) => {
        if (err) {
          logger.error('Session destruction error:', err);
          // Still clear cookies and return success as JWT is already cleared
        }
        
        logger.info('Session destroyed successfully');
        
        // Clear the session cookies
        res.clearCookie('thottopilot.sid', { 
          path: '/',
          httpOnly: true,
          sameSite: 'lax'
        });
        res.clearCookie('connect.sid', { path: '/' });
        
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      // Clear cookies even if no session
      res.clearCookie('thottopilot.sid', { 
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      });
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ message: 'Logged out successfully' });
    }
  };

  // Logout from Passport if authenticated and session exists
  if (req.logout && typeof req.logout === 'function' && req.session && req.isAuthenticated && req.isAuthenticated()) {
    try {
      req.logout((err: any) => {
        if (err) {
          logger.error('Passport logout error:', err);
        }
        // Proceed to destroy session after Passport logout
        handleSessionDestroy();
      });
    } catch (logoutError) {
      logger.error('Critical error during req.logout():', logoutError);
      // If req.logout fails, still proceed with session cleanup
      handleSessionDestroy();
    }
  } else {
    // No Passport session or no session exists, just destroy the regular session
    handleSessionDestroy();
  }
});

// Email verification route
router.get("/verify-email", async (req, res) => {
  try {
    console.log('🔐 EMAIL VERIFICATION: Starting verification process');
    const { token } = req.query;
    console.log('🔐 Token received:', !!token);
    console.log('🔐 Token type:', typeof token);
    console.log('🔐 Token length:', token ? (token as string).length : 0);
    
    if (!token) {
      console.log('❌ EMAIL VERIFICATION: No token provided');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=missing_token`);
    }

    console.log('🔐 EMAIL VERIFICATION: Processing verification token...');
    
    // Check if it's a JWT token (contains dots) or database token (hex string)
    const isJWT = (token as string).includes('.');
    console.log('🔐 EMAIL VERIFICATION: Token type detected:', isJWT ? 'JWT' : 'Database');
    
    let userId: number;
    
    if (isJWT) {
      // JWT token from new signup flow
      console.log('🔐 EMAIL VERIFICATION: Processing JWT token');
      try {
        const decoded = jwt.verify(token as string, process.env.JWT_SECRET!) as any;
        console.log('🔐 JWT decoded successfully');
        console.log('🔐 JWT type:', decoded.type);
        console.log('🔐 JWT userId:', decoded.userId);
        console.log('🔐 JWT email:', decoded.email);
        
        if (decoded.type !== 'email-verification') {
          console.log('❌ EMAIL VERIFICATION: Invalid token type:', decoded.type);
          return res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=invalid_token_type`);
        }
        userId = decoded.userId;
        console.log('✅ EMAIL VERIFICATION: JWT token validated successfully');
      } catch (error) {
        console.error('❌ EMAIL VERIFICATION: JWT verification failed:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=invalid_token`);
      }
    } else {
      // Database token from auth.ts flow
      console.log('🔐 EMAIL VERIFICATION: Processing database token');
      const verificationToken = await storage.getVerificationToken(token as string);
      
      if (!verificationToken) {
        console.error('❌ EMAIL VERIFICATION: Token not found in database');
        return res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=invalid_token`);
      }
      
      console.log('🔐 Database token found for user:', verificationToken.userId);
      console.log('🔐 Token expires at:', verificationToken.expiresAt);
      
      // Check if expired
      if (new Date(verificationToken.expiresAt) < new Date()) {
        console.log('❌ EMAIL VERIFICATION: Token expired, deleting');
        await storage.deleteVerificationToken(token as string);
        return res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=expired_token`);
      }
      
      userId = verificationToken.userId;
      console.log('✅ EMAIL VERIFICATION: Database token validated successfully');
      
      // Delete the used token
      console.log('🔐 EMAIL VERIFICATION: Deleting used token');
      await storage.deleteVerificationToken(token as string);
    }

    // Update user's email verification status
    console.log('🔐 EMAIL VERIFICATION: Updating user email verification status');
    console.log('🔐 User ID:', userId);
    await storage.updateUserEmailVerified(userId, true);
    console.log('✅ EMAIL VERIFICATION: User email verification status updated successfully');
    
    const user = await storage.getUser(userId);
    console.log('🔐 EMAIL VERIFICATION: Retrieved user data');
    console.log('🔐 User email:', user?.email);
    console.log('🔐 User username:', user?.username);
    console.log('🔐 User emailVerified:', user?.emailVerified);
    
    console.log('✅ EMAIL VERIFICATION: Email verified successfully for user:', userId);

    // Send welcome email
    console.log('🔐 EMAIL VERIFICATION: Starting welcome email workflow');
    try {
      if (user?.email) {
        console.log('🔐 EMAIL VERIFICATION: Calling email service for welcome email');
        await emailService.sendWelcomeEmail(user.email, user.username || 'User');
        console.log('✅ EMAIL VERIFICATION: Welcome email sent successfully');
      } else {
        console.log('❌ EMAIL VERIFICATION: No email available for welcome email');
      }
    } catch (emailError) {
      console.error('❌ EMAIL VERIFICATION: Failed to send welcome email:', emailError);
    }

    // Redirect with success message
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?verified=true&email=${encodeURIComponent(user?.email || '')}`;
    console.log('🔐 EMAIL VERIFICATION: Redirecting to success page');
    console.log('🔐 Redirect URL:', redirectUrl);
    return res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ EMAIL VERIFICATION: Verification process failed:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://thottopilot.com'}/login?error=verification_failed`);
  }
});

// Resend verification email route
router.post("/resend-verification", authLimiter, async (req, res) => {
  try {
    console.log('🔐 RESEND VERIFICATION: Starting resend verification process');
    const { email } = req.body;
    console.log('🔐 Email provided:', email);
    
    if (!email) {
      console.log('❌ RESEND VERIFICATION: No email provided');
      return res.status(400).json({ message: 'Email required' });
    }
    
    console.log('🔐 RESEND VERIFICATION: Looking up user by email');
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.log('❌ RESEND VERIFICATION: User not found for email (security response)');
      // Don't reveal if email exists for security
      return res.json({ message: 'If that email exists, we sent a verification link' });
    }

    console.log('🔐 RESEND VERIFICATION: User found');
    console.log('🔐 User ID:', user.id);
    console.log('🔐 Email verified status:', user.emailVerified);

    if (user.emailVerified) {
      console.log('❌ RESEND VERIFICATION: Email already verified');
      return res.status(400).json({ message: 'Email already verified' });
    }

    console.log('🔐 RESEND VERIFICATION: Generating new verification token');
    const token = jwt.sign(
      { 
        email: user.email, 
        userId: user.id, 
        type: 'email-verification' 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    console.log('🔐 RESEND VERIFICATION: Token generated successfully');

    console.log('🔐 RESEND VERIFICATION: Sending verification email');
    if (user.email) {
      await emailService.sendVerificationEmail(user.email, user.username || 'User', token);
      console.log('✅ RESEND VERIFICATION: Verification email sent successfully');
    } else {
      console.log('❌ RESEND VERIFICATION: No email available for user');
    }

    res.json({ message: 'Verification email sent. Please check your inbox.' });
    
  } catch (error) {
    console.error('❌ RESEND VERIFICATION: Process failed:', error);
    logger.error('Resend verification error:', error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
});

// Request password reset route
router.post("/request-password-reset", authLimiter, async (req, res) => {
  try {
    console.log('🔐 PASSWORD RESET: Starting password reset request');
    const { email } = req.body;
    console.log('🔐 Email provided:', email);
    console.log('🔐 SendGrid configured:', !!process.env.SENDGRID_API_KEY);
    console.log('🔐 Email service configured:', emailService.isEmailServiceConfigured);
    
    console.log('🔐 PASSWORD RESET: Looking up user by email');
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.log('❌ PASSWORD RESET: User not found for email (security response)');
      // Don't reveal if email exists
      return res.json({ message: 'If that email exists, we sent a reset link' });
    }

    console.log('🔐 PASSWORD RESET: User found');
    console.log('🔐 User ID:', user.id);
    console.log('🔐 Username:', user.username);
    console.log('🔐 Email verified:', user.emailVerified);

    // Send password reset email (token is generated inside the email service)
    console.log('🔐 PASSWORD RESET: Calling email service for password reset');
    if (user.email) {
      await emailService.sendPasswordResetEmail(user.email, user.username || 'User');
      console.log('✅ PASSWORD RESET: Password reset email sent successfully');
    } else {
      console.log('❌ PASSWORD RESET: No email available for user');
    }

    res.json({ message: 'Password reset email sent' });
    
  } catch (error) {
    console.error('❌ PASSWORD RESET: Process failed:', error);
    logger.error('Password reset request error:', error);
    res.status(500).json({ message: 'Error sending reset email' });
  }
});

// Verify reset token route
router.post("/verify-reset-token", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token required' });
    }
    
    const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET!) as any;
    
    if (decoded.type !== 'password-reset') {
      return res.status(400).json({ message: 'Invalid token type' });
    }
    
    res.json({ valid: true, email: decoded.email });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// Complete password reset route
router.post("/complete-reset", async (req, res) => {
  try {
    console.log('🔐 PASSWORD RESET COMPLETE: Starting password reset completion');
    const { token, newPassword } = req.body;
    console.log('🔐 Token provided:', !!token);
    console.log('🔐 New password provided:', !!newPassword);
    console.log('🔐 Token length:', token ? token.length : 0);
    
    // Validate password strength
    if (!newPassword || newPassword.length < 8) {
      console.log('❌ PASSWORD RESET COMPLETE: Password too short');
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    
    console.log('🔐 PASSWORD RESET COMPLETE: Decoding and verifying token');
    const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET!) as any;
    console.log('🔐 Token decoded successfully');
    console.log('🔐 Token type:', decoded.type);
    console.log('🔐 Token email:', decoded.email);
    
    if (decoded.type !== 'password-reset') {
      console.log('❌ PASSWORD RESET COMPLETE: Invalid token type:', decoded.type);
      return res.status(400).json({ message: 'Invalid reset token' });
    }
    
    console.log('🔐 PASSWORD RESET COMPLETE: Hashing new password');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔐 Password hashed successfully');
    
    // Update password and mark email as verified
    console.log('🔐 PASSWORD RESET COMPLETE: Updating user password');
    await storage.updateUserPassword(decoded.email, hashedPassword);
    console.log('✅ PASSWORD RESET COMPLETE: Password updated successfully');
    
    console.log('🔐 PASSWORD RESET COMPLETE: Marking email as verified');
    await storage.updateUserEmailVerified(decoded.email, true);
    console.log('✅ PASSWORD RESET COMPLETE: Email verification status updated');
    
    console.log('✅ PASSWORD RESET COMPLETE: Process completed successfully');
    res.json({ message: 'Password reset successful' });
    
  } catch (error: any) {
    console.error('❌ PASSWORD RESET COMPLETE: Process failed:', error);
    
    if (error.name === 'TokenExpiredError') {
      console.log('❌ PASSWORD RESET COMPLETE: Token expired');
      return res.status(400).json({ message: 'Reset token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ PASSWORD RESET COMPLETE: Invalid token format');
      return res.status(400).json({ message: 'Invalid reset token' });
    }
    
    logger.error('Password reset error:', error);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// Change password route (for logged-in users)
router.post("/change-password", async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    const { verifyToken } = await import('../middleware/auth.js');
    const decoded = verifyToken(token) as any;
    
    const userId = decoded.userId || decoded.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(user.id, hashedPassword);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

export { router as authRoutes };