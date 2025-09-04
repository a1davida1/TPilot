import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from '../storage.js';
import { logger, authLimiter } from '../middleware/security.js';
import { createToken, ADMIN_EMAIL, ADMIN_PASSWORD } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';

const router = express.Router();

// Signup route - DEPRECATED: Frontend now uses /api/auth/signup in server/auth.ts  
// This route is kept for backward compatibility but should not be used for new implementations
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

// Login route - DEPRECATED: Frontend now uses /api/auth/login in server/auth.ts
// This route is kept for backward compatibility but should not be used for new implementations
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

// Email verification route - REMOVED: Conflicts with /api/auth/verify-email in server/auth.ts

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

// Request password reset route - REMOVED: Frontend now uses /api/auth/forgot-password

// [DEPRECATED - verify-reset-token]
// This route is no longer used - verification is handled in main auth flow
// // Verify reset token route
// router.post("/verify-reset-token", async (req, res) => {
//   try {
//     const { token } = req.body;
//     
//     if (!token) {
//       return res.status(400).json({ message: 'Token required' });
//     }
//     
//     const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET!) as any;
//     
//     if (decoded.type !== 'password-reset') {
//       return res.status(400).json({ message: 'Invalid token type' });
//     }
//     
//     res.json({ valid: true, email: decoded.email });
//   } catch (error) {
//     res.status(400).json({ message: 'Invalid or expired token' });
//   }
// });

// Complete password reset route - REMOVED: Frontend now uses /api/auth/reset-password

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