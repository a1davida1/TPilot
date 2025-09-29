import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import type { Express, NextFunction, Request, Response } from 'express';
import type { AuthenticateOptions } from 'passport';
import type { User } from '@shared/schema';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import { blacklistToken } from './lib/tokenBlacklist';
import { logger } from './bootstrap/logger';
import { API_PREFIX, prefixApiPath } from './lib/api-prefix.js';

type RedditAuthenticateOptions = AuthenticateOptions & {
  state?: string;
  duration?: 'temporary' | 'permanent';
};

const redditCallbackOptions: RedditAuthenticateOptions = {
  failureRedirect: '/login?error=reddit_failed',
  successRedirect: '/dashboard?connected=reddit'
};

export function setupSocialAuth(app: Express, apiPrefix: string = API_PREFIX) {
  // Note: passport.initialize() and passport.session() are now called from routes.ts
  // after session middleware is initialized
  // Serialization/deserialization is also handled in routes.ts

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: prefixApiPath('/auth/google/callback', apiPrefix)
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
        return done(error as Error, false);
      }
    }));
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: prefixApiPath('/auth/facebook/callback', apiPrefix),
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
        return done(error as Error, false);
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
      callbackURL: prefixApiPath('/auth/reddit/callback', apiPrefix),
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
        return done(error as Error, false);
      }
    }));
  }

  // Auth routes
  setupAuthRoutes(app, apiPrefix);
}

function setupAuthRoutes(app: Express, apiPrefix: string) {
  const route = (path: string) => prefixApiPath(path, apiPrefix);
  // Google routes
  app.get(route('/auth/google'),
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get(route('/auth/google/callback'),
    passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Facebook routes
  app.get(route('/auth/facebook'),
    passport.authenticate('facebook', { scope: ['email'] })
  );

  app.get(route('/auth/facebook/callback'),
    passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Reddit routes
  app.get(route('/auth/reddit'), (req: Request, res: Response, next: NextFunction) => {
    const redditAuthOptions: RedditAuthenticateOptions = {
      state: Math.random().toString(36).substring(7)
    };
    return passport.authenticate('reddit', redditAuthOptions)(req, res, next);
  });

  app.get(route('/auth/reddit/callback'),
    passport.authenticate('reddit', redditCallbackOptions),
    (req, res) => {
      res.redirect('/dashboard?connected=reddit');
    }
  );

  // Logout with comprehensive error handling
  app.post(route('/auth/logout'), async (req: Request, res: Response) => {
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
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1] || req.cookies?.authToken;
        if (token) {
          const decoded = jwt.decode(token) as { exp?: number } | null;
          const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
          await blacklistToken(token, ttl);
        }
        return res.json({ message: 'Logged out successfully' });
      }

      // If using Passport and session exists
      if (r.logout) {
        r.logout(async (err) => {
          if (err) {
            logger.error('Passport logout error', { error: err instanceof Error ? err.message : String(err) });
            // Continue with logout anyway
          }
          
          // Destroy session if it exists
          if (r.session && r.session.destroy) {
            r.session.destroy(async (destroyErr) => {
              if (destroyErr) {
                logger.error('Session destroy error', { error: destroyErr instanceof Error ? destroyErr.message : String(destroyErr) });
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
              const authHeader = req.headers['authorization'];
              const token = authHeader?.split(' ')[1] || req.cookies?.authToken;
              if (token) {
                const decoded = jwt.decode(token) as { exp?: number } | null;
                const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
                await blacklistToken(token, ttl);
              }
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
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1] || req.cookies?.authToken;
            if (token) {
              const decoded = jwt.decode(token) as { exp?: number } | null;
              const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
              await blacklistToken(token, ttl);
            }
            res.json({ message: 'Logged out successfully' });
          }
        });
      } else {
        // No passport logout, destroy session directly
        if (r.session && r.session.destroy) {
          r.session.destroy(async (err) => {
            if (err) {
              logger.error('Session destroy error', { error: err instanceof Error ? err.message : String(err) });
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
            const authHeader = req.headers['authorization'];
            const token = authHeader?.split(' ')[1] || req.cookies?.authToken;
            if (token) {
              const decoded = jwt.decode(token) as { exp?: number } | null;
              const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
              await blacklistToken(token, ttl);
            }
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
          const authHeader = req.headers['authorization'];
          const token = authHeader?.split(' ')[1] || req.cookies?.authToken;
          if (token) {
            const decoded = jwt.decode(token) as { exp?: number } | null;
            const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
            await blacklistToken(token, ttl);
          }
          res.json({ message: 'Logged out successfully' });
        }
      }
    } catch (error) {
      logger.error('Logout error', { error: error instanceof Error ? (error as Error).message : String(error) });
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