import express from 'express';
import bcrypt from 'bcrypt';
import { storage } from '../storage.js';
import { logger, authLimiter } from '../middleware/security.js';
import { createToken, ADMIN_EMAIL, ADMIN_PASSWORD } from '../middleware/auth.js';

const router = express.Router();

// Signup route with rate limiting
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await storage.createUser({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      tier: 'free'
    });

    // Generate JWT token
    const token = createToken({
      id: newUser.id, 
      userId: newUser.id, 
      username: newUser.username, 
      email: newUser.email
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// TEST ROUTE - Remove this after debugging
router.get("/test", (req, res) => {
  console.log("🚨 AUTH TEST ROUTE HIT!");
  res.json({ message: "Auth routes working!" });
});

// Login route with rate limiting
router.post("/login", authLimiter, async (req, res) => {
  console.log("🚨 LOGIN ROUTE HIT - THIS SHOULD DEFINITELY SHOW UP!");
  try {
    const { email, username, password } = req.body;
    console.log("🚨 REQUEST BODY:", { email, username, passwordProvided: !!password });
    
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
        tier: 'pro',
        isAdmin: true
      };

      const token = createToken({
        userId: adminUser.id, 
        id: adminUser.id, 
        email: adminUser.email, 
        username: adminUser.username, 
        isAdmin: true
      });

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
    const token = createToken({
      id: user.id, 
      userId: user.id, 
      username: user.username, 
      email: user.email
    });

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
      if (req.user?.isAdmin || req.user?.id === 999) {
        return res.json({
          id: 999,
          email: ADMIN_EMAIL,
          username: 'admin',
          tier: 'pro',
          isAdmin: true
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
            tier: userResponse.tier || 'free'
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
        
        if (decoded.isAdmin) {
          return res.json({
            id: 999,
            email: ADMIN_EMAIL,
            username: 'admin',
            tier: 'pro',
            isAdmin: true
          });
        }
        
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
  if (req.logout) {
    req.logout((err: any) => {
      if (err) {
        logger.error('Logout error:', err);
        return res.status(500).json({ message: 'Error logging out' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'Logged out successfully' });
  }
});

export { router as authRoutes };