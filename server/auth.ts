import { Express } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import { storage } from './storage';
import { emailService } from './services/email-service';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export function setupAuth(app: Express) {
  // Regular signup
  app.post('/api/auth/signup', async (req, res) => {
    try {
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
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Regular login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, email } = req.body;

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
          JWT_SECRET,
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
      let user = await storage.getUserByUsername(username || loginEmail);
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
        JWT_SECRET,
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
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in' });
    }
  });

  // Email verification
  app.get('/api/auth/verify-email', async (req, res) => {
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
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Error verifying email' });
    }
  });

  // OAuth routes
  app.get('/api/auth/google', (req, res) => {
    // Redirect to Google OAuth
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/api/auth/google/callback`);
    const scope = encodeURIComponent('email profile');

    if (!clientId) {
      return res.status(500).json({ message: 'Google OAuth not configured' });
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    res.redirect(authUrl);
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      // In a real implementation, you would exchange the code for an access token
      // and fetch the user profile from Google
      // For now, we'll show an error message
      res.redirect('/?error=oauth-not-implemented');
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/?error=oauth-failed');
    }
  });

  app.get('/api/auth/facebook', (req, res) => {
    // Similar to Google OAuth
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/api/auth/facebook/callback`);

    if (!appId) {
      return res.status(500).json({ message: 'Facebook OAuth not configured' });
    }

    const authUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=email`;
    res.redirect(authUrl);
  });

  app.get('/api/auth/facebook/callback', async (req, res) => {
    try {
      res.redirect('/?error=oauth-not-implemented');
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect('/?error=oauth-failed');
    }
  });

  // Password reset request
  app.post('/api/auth/forgot-password', async (req, res) => {
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
      console.error('Password reset request error:', error);
      res.status(500).json({ message: 'Error processing password reset' });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
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
      console.error('Password reset error:', error);
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
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          
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
          console.error('JWT verification error:', jwtError);
          return res.status(401).json({ message: 'Invalid token' });
        }
      }

      return res.status(401).json({ message: 'Access token required' });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Error fetching user data' });
    }
  });

}