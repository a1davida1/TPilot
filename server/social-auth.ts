import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import type { Express, Request, Response } from 'express';
import type { AuthenticateOptions } from 'passport';
import type { User } from '@shared/schema';
import { storage } from './storage';

export function setupSocialAuth(app: Express) {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
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
    interface RedditProfile {
      id: string;
      name?: string;
      icon_img?: string;
    }
    passport.use(new RedditStrategy({
      clientID: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      callbackURL: "/api/auth/reddit/callback",
      scope: ['identity']
    }, async (
      accessToken: string,
      refreshToken: string,
      profile: RedditProfile,
      done: (error: Error | null, user?: User | false) => void
    ) => {
      try {
        // Reddit doesn't provide email, use username
        let user = await storage.getUserByUsername(profile.name ?? profile.id);
        
        if (!user) {
          user = await storage.createUser({
            email: '', // Reddit doesn't provide email
            username: profile.name || `reddit_${profile.id}`,
            password: '',
            provider: 'reddit',
            providerId: profile.id,
            avatar: profile.icon_img ?? ''
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
    } as (AuthenticateOptions & { state: string }))
  );

  app.get('/api/auth/reddit/callback',
    passport.authenticate('reddit', { failureRedirect: '/login?error=reddit_failed' }),
    (req, res) => {
      res.redirect('/dashboard?connected=reddit');
    }
  );

  // Logout with comprehensive error handling
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const r = req as Request & {
      session?: { destroy?: (cb: (err?: unknown) => void) => void };
      logout?: (cb: (err?: unknown) => void) => void;
    };
    try {
      // Check if session exists first
      if (!r.session) {
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
      if (r.logout) {
        r.logout((err) => {
          if (err) {
            console.error('Passport logout error:', err);
            // Continue with logout anyway
          }
          
          // Destroy session if it exists
          if (r.session && r.session.destroy) {
            r.session.destroy((destroyErr) => {
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
        if (r.session && r.session.destroy) {
          r.session.destroy((err) => {
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

  // Get current user - REMOVED: Duplicate endpoint
  // The main /api/auth/user endpoint is handled in server/auth.ts with JWT support
}