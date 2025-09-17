import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import type { Express, Request, Response } from 'express';
import type { AuthenticateOptions } from 'passport';
import type { User } from '@shared/schema';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import { blacklistToken } from './lib/tokenBlacklist';
import { logger } from './bootstrap/logger';

export function setupSocialAuth(app: Express, apiPrefix: string = '/api') {
  // Note: passport.initialize() and passport.session() are now called from routes.ts
  // after session middleware is initialized
  // Serialization/deserialization is also handled in routes.ts

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${apiPrefix}/auth/google/callback`
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
      callbackURL: `${apiPrefix}/auth/facebook/callback`,
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
      callbackURL: `${apiPrefix}/auth/reddit/callback`,
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
  // Google routes
  app.get(`${apiPrefix}/auth/google`,
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get(`${apiPrefix}/auth/google/callback`,
    passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Facebook routes
  app.get(`${apiPrefix}/auth/facebook`,
    passport.authenticate('facebook', { scope: ['email'] })
  );

  app.get(`${apiPrefix}/auth/facebook/callback`,
    passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_failed' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );

  // Reddit routes
  app.get(`${apiPrefix}/auth/reddit`,
    passport.authenticate('reddit', { 
      state: Math.random().toString(36).substring(7)
    } as (AuthenticateOptions & { state: string }))
  );

  app.get(`${apiPrefix}/auth/reddit/callback`,
    passport.authenticate('reddit', { failureRedirect: '/login?error=reddit_failed' }),
    (req, res) => {
      res.redirect('/dashboard?connected=reddit');
    }
  );

  // Get current user - REMOVED: Duplicate endpoint
  // The main /api/auth/user endpoint is handled in server/auth.ts with JWT support
}