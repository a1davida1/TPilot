import { Express } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export function setupAuth(app: Express) {
  // Regular signup
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, password, email } = req.body;

      // Check if user exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
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

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username },
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
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Regular login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
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

  app.get('/api/auth/reddit', (req, res) => {
    // Similar to Google OAuth
    const clientId = process.env.REDDIT_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/api/auth/reddit/callback`);
    
    if (!clientId) {
      return res.status(500).json({ message: 'Reddit OAuth not configured' });
    }

    const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=RANDOM_STRING&redirect_uri=${redirectUri}&duration=permanent&scope=identity`;
    res.redirect(authUrl);
  });

  app.get('/api/auth/reddit/callback', async (req, res) => {
    try {
      res.redirect('/?error=oauth-not-implemented');
    } catch (error) {
      console.error('Reddit OAuth callback error:', error);
      res.redirect('/?error=oauth-failed');
    }
  });
}