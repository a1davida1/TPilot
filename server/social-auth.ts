import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import type { CookieOptions, Express, NextFunction, Request, Response } from 'express';
import type { AuthenticateOptions } from 'passport';
import type { User } from '@shared/schema';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import { blacklistToken } from './lib/tokenBlacklist';
import { logger } from './bootstrap/logger';
import { API_PREFIX, prefixApiPath } from './lib/api-prefix.js';
import { createToken } from './middleware/auth.js';
import { getSessionCookieConfig } from './bootstrap/session.js';

type RedditAuthenticateOptions = AuthenticateOptions & {
  state?: string;
  duration?: 'temporary' | 'permanent';
};

const redditCallbackOptions: RedditAuthenticateOptions = {
  failureRedirect: '/login?error=reddit_failed'
  // Note: No successRedirect - we handle cookie + redirect in the callback handler
};

  const clearSessionCookie = (res: Response): void => {
  const { name, cookie } = getSessionCookieConfig();
  const cookieOptions: CookieOptions = {
    path: cookie.path ?? '/',
    httpOnly: cookie.httpOnly ?? true,
  };

  if (typeof cookie.sameSite !== 'undefined') {
    cookieOptions.sameSite = cookie.sameSite;
  }

  if (typeof cookie.secure !== 'undefined') {
    cookieOptions.secure = cookie.secure;
  }

  if (cookie.domain) {
    cookieOptions.domain = cookie.domain;
  }

  res.clearCookie(name, cookieOptions);
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
        const email = profile.emails?.[0]?.value || '';
        const username = profile.displayName || email || '';
        const avatar = profile.photos?.[0]?.value;
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('google', profile.id);
        
        if (user) {
          // Update avatar and username if changed
          if (avatar && user.avatar !== avatar || user.username !== username) {
            await storage.updateUser(user.id, { avatar, username });
            user = await storage.getUserById(user.id);
          }
        } else {
          // Check by email as fallback (only if email is non-empty)
          if (email && email.trim().length > 0) {
            user = await storage.getUserByEmail(email);
          }
          
          if (user) {
            // Link existing user with Google provider
            await storage.updateUser(user.id, { 
              provider: 'google', 
              providerId: profile.id,
              avatar,
              username,
              emailVerified: true // Google verifies emails
            });
            user = await storage.getUserById(user.id);
          } else {
            // Create new user
            user = await storage.createUser({
              email,
              username,
              password: '',
              provider: 'google',
              providerId: profile.id,
              avatar,
              tier: 'free',
              emailVerified: true // Google provides verified emails
            });
          }
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
        const email = profile.emails?.[0]?.value || '';
        const username = `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || email || '';
        const avatar = profile.photos?.[0]?.value;
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('facebook', profile.id);
        
        if (user) {
          // Update avatar and username if changed
          if (avatar && user.avatar !== avatar || user.username !== username) {
            await storage.updateUser(user.id, { avatar, username });
            user = await storage.getUserById(user.id);
          }
        } else {
          // Check by email as fallback (only if email is non-empty)
          if (email && email.trim().length > 0) {
            user = await storage.getUserByEmail(email);
          }
          
          if (user) {
            // Link existing user with Facebook provider
            await storage.updateUser(user.id, { 
              provider: 'facebook', 
              providerId: profile.id,
              avatar,
              username,
              emailVerified: true // Facebook provides verified emails
            });
            user = await storage.getUserById(user.id);
          } else {
            // Create new user
            user = await storage.createUser({
              email,
              username,
              password: '',
              provider: 'facebook',
              providerId: profile.id,
              avatar,
              tier: 'free',
              emailVerified: true // Facebook provides verified emails
            });
          }
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
        const username = profile.name || `reddit_${profile.id}`;
        const avatar = profile.icon_img ?? '';
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('reddit', profile.id);
        
        if (user) {
          // Update avatar and username if changed
          if (avatar && user.avatar !== avatar || user.username !== username) {
            await storage.updateUser(user.id, { avatar, username });
            user = await storage.getUserById(user.id);
          }
        } else {
          // SECURITY: Never auto-link by username - this allows account takeover
          // Reddit provides no email, so we can only match by provider ID
          // If no match, create new user
          user = await storage.createUser({
            email: '', // Reddit doesn't provide email
            username,
            password: '',
            provider: 'reddit',
            providerId: profile.id,
            avatar,
            tier: 'free',
            emailVerified: true // Reddit has no email, mark verified to allow login
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
      // Set auth token cookie with SameSite=None for third-party OAuth redirect
      if (req.user) {
        const token = createToken(req.user as User);
        setAuthCookie(res, token);
      }
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
      // Set auth token cookie with SameSite=None for third-party OAuth redirect
      if (req.user) {
        const token = createToken(req.user as User);
        setAuthCookie(res, token);
      }
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
      // Set auth token cookie with SameSite=None for third-party OAuth redirect
      if (req.user) {
        const token = createToken(req.user as User);
        setAuthCookie(res, token);
      }
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
        clearSessionCookie(res);
        res.clearCookie('authToken', getAuthCookieOptions());
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
              clearSessionCookie(res);
              res.clearCookie('authToken', getAuthCookieOptions());
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
            clearSessionCookie(res);
            res.clearCookie('authToken', getAuthCookieOptions());
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
            clearSessionCookie(res);
            res.clearCookie('authToken', getAuthCookieOptions());
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
          clearSessionCookie(res);
          res.clearCookie('authToken', getAuthCookieOptions());
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
      clearSessionCookie(res);
      res.clearCookie('authToken', getAuthCookieOptions());
      res.json({ message: 'Logged out (with errors)' });
    }
  });

  // Get current user - REMOVED: Duplicate endpoint
  // The main /api/auth/user endpoint is handled in server/auth.ts with JWT support
}