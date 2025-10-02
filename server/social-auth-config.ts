import passport from 'passport';
import type { AuthenticateOptions } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
// Explicitly import compiled entry to avoid Node's extensionless main deprecation
import * as redditStrategyPkg from 'passport-reddit/lib/passport-reddit/index.js';
const RedditStrategy = (
  redditStrategyPkg as unknown as { Strategy: typeof import('passport-reddit').Strategy }
).Strategy;
import type {
  RedditProfile as RedditStrategyProfile,
  StrategyOptions as RedditStrategyOptions,
} from 'passport-reddit';
import { storage } from './storage';
import type { User } from '@shared/schema';
import { API_PREFIX, prefixApiPath } from './lib/api-prefix.js';

type RedditAuthenticateOptions = AuthenticateOptions & { duration?: 'temporary' | 'permanent' };

// Helper function to handle social auth user creation/update
async function handleSocialAuth(
  provider: string,
  profile: { id: string; emails?: { value: string }[]; username?: string; displayName?: string; photos?: { value: string }[]; },
  done: (error: Error | null, user?: User) => void
) {
  try {
    const email = profile.emails?.[0]?.value || `${profile.id}@${provider}.social`;
    const username = profile.username || profile.displayName || `${provider}_${profile.id}`;
    
    // Check if user exists by email or social provider ID
    let user = await storage.getUserByEmail(email);
    
    if (!user) {
      // Create new user with social provider info
      user = await storage.createUser({
        email,
        username,
        password: '', // No password for social login
        tier: 'free',
        provider: provider,
        providerId: profile.id,
        avatar: profile.photos?.[0]?.value,
        emailVerified: true // Auto-verify social accounts
      });
    } else {
      // Update existing user with social provider info if needed
      if (!user.provider) {
        await storage.updateUser(user.id, {
          provider: provider,
          providerId: profile.id,
          avatar: user.avatar || profile.photos?.[0]?.value
        });
      }
    }
    
    done(null, user);
  } catch (error) {
    done(error as Error);
  }
}

export function configureSocialAuth(apiPrefix: string = API_PREFIX) {
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: prefixApiPath('/auth/google/callback', apiPrefix),
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      await handleSocialAuth('google', profile, done);
    }));
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: prefixApiPath('/auth/facebook/callback', apiPrefix),
      profileFields: ['id', 'emails', 'displayName', 'photos']
    }, async (accessToken, refreshToken, profile, done) => {
      await handleSocialAuth('facebook', profile, done);
    }));
  }

  // Reddit OAuth Strategy
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    const redditStrategyOptions: RedditStrategyOptions = {
      clientID: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      callbackURL: prefixApiPath('/reddit/callback', apiPrefix),
      scope: ['identity'],
      state: true,
    };

    passport.use(
      new RedditStrategy(
        redditStrategyOptions,
        async (accessToken, refreshToken, profile: RedditStrategyProfile, done) => {
          const iconImage =
            (typeof profile.icon_img === 'string' && profile.icon_img.length > 0
              ? profile.icon_img
              : undefined) ??
            (typeof profile._json.icon_img === 'string' && profile._json.icon_img.length > 0
              ? profile._json.icon_img
              : undefined);

          await handleSocialAuth(
            'reddit',
            {
              id: profile.id,
              username: profile.name ?? `reddit_${profile.id}`,
              emails: [],
              photos: iconImage ? [{ value: iconImage }] : [],
            },
            done,
          );
        },
      ),
    );
  }

  // Serialize and deserialize user
  passport.serializeUser((user: unknown, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

// Social auth route handlers
export const socialAuthRoutes = {
  // Google routes
  googleAuth: passport.authenticate('google', { scope: ['profile', 'email'] }),
  googleCallback: passport.authenticate('google', { 
    failureRedirect: '/login?error=google_auth_failed',
    successRedirect: '/dashboard' 
  }),

  // Facebook routes
  facebookAuth: passport.authenticate('facebook', { scope: ['email'] }),
  facebookCallback: passport.authenticate('facebook', { 
    failureRedirect: '/login?error=facebook_auth_failed',
    successRedirect: '/dashboard' 
  }),

  // Reddit routes
  redditAuth: passport.authenticate(
    'reddit',
    {
      scope: ['identity'],
      duration: 'permanent',
    } satisfies RedditAuthenticateOptions as any,
  ),
  redditCallback: passport.authenticate('reddit', { 
    failureRedirect: '/login?error=reddit_auth_failed',
    successRedirect: '/dashboard?reddit=connected' 
  })
};