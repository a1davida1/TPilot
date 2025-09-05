import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import type { Express } from 'express';
import { storage } from './storage';
import type { User } from '@shared/schema';

export function setupSocialAuth(app: Express) {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists by email OR username
        const email = profile.emails?.[0]?.value || '';
        const username = profile.displayName || email || '';
        
        let user = await storage.getUserByEmail(email);
        if (!user) {
          user = await storage.getUserByUsername(username);
        }
        
        if (!user) {
          // Create new user only if not found by email OR username
          user = await storage.createUser({
            email,
            username,
            password: '', // No password for social auth
            provider: 'google',
            providerId: profile.id,
            avatar: profile.photos?.[0]?.value
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }));
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/api/auth/facebook/callback",
      profileFields: ['id', 'emails', 'name', 'picture']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists by email OR username  
        const email = profile.emails?.[0]?.value || '';
        const username = `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || email || '';
        
        let user = await storage.getUserByEmail(email);
        if (!user) {
          user = await storage.getUserByUsername(username);
        }
        
        if (!user) {
          // Create new user only if not found by email OR username
          user = await storage.createUser({
            email,
            username,
            password: '',
            provider: 'facebook',
            providerId: profile.id,
            avatar: profile.photos?.[0]?.value
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }));
  }

  // Reddit OAuth Strategy
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    passport.use(new RedditStrategy({
      clientID: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      callbackURL: "/api/auth/reddit/callback",
      scope: ['identity']
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // Reddit doesn't provide email, use username
        let user = await storage.getUserByUsername(profile.name || profile.id);
        
        if (!user) {
          user = await storage.createUser({
            email: '', // Reddit doesn't provide email
            username: profile.name || `reddit_${profile.id}`,
            password: '',
            provider: 'reddit',
            providerId: profile.id,
            avatar: profile.icon_img || ''
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }));
  }

  // Auth routes
  setupAuthRoutes(app);
}

function setupAuthRoutes(app: Express) {
  // Google routes
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Facebook routes
  app.get('/api/auth/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
  );

  app.get('/api/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Reddit routes
  app.get('/api/auth/reddit',
    passport.authenticate('reddit', { 
      state: Math.random().toString(36).substring(7)
    } as any)
  );

  app.get('/api/auth/reddit/callback',
    passport.authenticate('reddit', { failureRedirect: '/login?error=reddit_failed' }),
    (req, res) => {
      res.redirect('/dashboard?connected=reddit');
    }
  );

  // Logout with comprehensive error handling
  app.post('/api/auth/logout', (req: any, res) => {
    try {
      // Check if session exists first
      if (!req.session) {
        // No session, just clear cookies and return success
        res.clearCookie('connect.sid', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        res.clearCookie('authToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        res.clearCookie('thottopilot.sid', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        return res.json({ message: 'Logged out successfully' });
      }

      // If using Passport and session exists
      if (req.logout && typeof req.logout === 'function') {
        req.logout((err: any) => {
          if (err) {
            console.error('Passport logout error:', err);
            // Continue with logout anyway
          }
          
          // Destroy session if it exists
          if (req.session && req.session.destroy) {
            req.session.destroy((destroyErr: any) => {
              if (destroyErr) {
                console.error('Session destroy error:', destroyErr);
              }
              // Clear cookies regardless
              res.clearCookie('connect.sid', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
              });
              res.clearCookie('authToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
              });
              res.clearCookie('thottopilot.sid', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
              });
              res.json({ message: 'Logged out successfully' });
            });
          } else {
            // No session.destroy, just clear cookies
            res.clearCookie('connect.sid', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.clearCookie('authToken', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.clearCookie('thottopilot.sid', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.json({ message: 'Logged out successfully' });
          }
        });
      } else {
        // No passport logout, destroy session directly
        if (req.session && req.session.destroy) {
          req.session.destroy((err: any) => {
            if (err) {
              console.error('Session destroy error:', err);
            }
            res.clearCookie('connect.sid', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.clearCookie('authToken', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.clearCookie('thottopilot.sid', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            res.json({ message: 'Logged out successfully' });
          });
        } else {
          // Just clear cookies
          res.clearCookie('connect.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          res.clearCookie('authToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          res.clearCookie('thottopilot.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          res.json({ message: 'Logged out successfully' });
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even on error, clear cookies to help user
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.clearCookie('thottopilot.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.json({ message: 'Logged out (with errors)' });
    }
  });

  // Get current user
  app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
}