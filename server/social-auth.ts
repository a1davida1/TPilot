import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { createRequire } from 'module';
import type { Express, NextFunction, Request, Response } from 'express';
import type { AuthenticateOptions } from 'passport';
import type { User, UserUpdate } from '@shared/schema';
import { storage } from './storage';
import { API_PREFIX, prefixApiPath } from './lib/api-prefix.js';
import { createToken } from './middleware/auth.js';
import { getCookieConfig } from './utils/cookie-config.js';
import { logger } from './bootstrap/logger.js';
import { trackEvent } from './lib/analytics.js';
import { authMetrics } from './services/basic-metrics.js';
import {
  createOAuthState,
  consumeOAuthState,
  extractSingleQueryParam,
  InvalidOAuthStateError,
  type OAuthStateData,
  type OAuthStateRecord,
  type OAuthProvider,
} from './lib/oauth-state-manager.js';

const require = createRequire(import.meta.url);
const { Strategy: RedditStrategy } =
  require('passport-reddit/lib/passport-reddit/index.js') as {
    Strategy: typeof import('passport-reddit/lib/passport-reddit/index.js')['Strategy'];
  };

type RedditAuthenticateOptions = AuthenticateOptions & {
  state?: string;
  duration?: 'temporary' | 'permanent';
};

interface OAuthStateLocals {
  oauthState?: OAuthStateRecord;
}

type OAuthSuccessRedirect = (state: OAuthStateData | undefined) => string;

const DEFAULT_OAUTH_SUCCESS_PATH = '/dashboard';
const SAFE_REDIRECT_MAX_LENGTH = 512;
const PUBLIC_OAUTH_INTENTS: ReadonlySet<OAuthStateData['intent']> = new Set([
  'login',
  'signup',
  'link',
  'account-link',
]);

const getOAuthStateFromResponse = (res: Response): OAuthStateRecord | undefined => {
  const locals = res.locals as Response['locals'] & OAuthStateLocals;
  return locals.oauthState;
};

const setOAuthStateOnResponse = (res: Response, record: OAuthStateRecord): void => {
  const locals = res.locals as Response['locals'] & OAuthStateLocals;
  locals.oauthState = record;
};

const setAuthCookie = (res: Response, token: string): void => {
  const cfg = getCookieConfig();
  const enforceSecure = process.env.OAUTH_COOKIE_ALLOW_INSECURE !== 'true';

  res.cookie(cfg.authName, token, {
    ...cfg.options,
    httpOnly: true,
    secure: enforceSecure ? true : cfg.options.secure,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

const isSafeRedirectPath = (value: string): boolean => (
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('://') &&
  !value.includes('\\') &&
  !value.includes('\n') &&
  !value.includes('\r') &&
  value.length <= SAFE_REDIRECT_MAX_LENGTH
);

const formatRedirectForLog = (value: string): string => value.replace(/[\r\n]/g, '').slice(0, SAFE_REDIRECT_MAX_LENGTH);

const sanitizeRedirectParam = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!isSafeRedirectPath(trimmed)) {
    return undefined;
  }
  return trimmed;
};

const resolveIntentOverride = (req: Request): OAuthStateData['intent'] | undefined => {
  const requested = extractSingleQueryParam(req.query.intent as unknown);
  if (!requested) {
    return undefined;
  }
  if (PUBLIC_OAUTH_INTENTS.has(requested as OAuthStateData['intent'])) {
    return requested as OAuthStateData['intent'];
  }
  logger.warn('Ignoring unsupported OAuth intent override', { requested: formatRedirectForLog(requested) });
  return undefined;
};

const resolveRedirectOverride = (req: Request): string | undefined => {
  const redirectParam = extractSingleQueryParam(req.query.redirect as unknown);
  const redirect = sanitizeRedirectParam(redirectParam);
  if (redirectParam && !redirect) {
    logger.warn('Rejected unsafe OAuth redirect parameter', { redirectParam: formatRedirectForLog(redirectParam) });
  }
  return redirect;
};

const resolveSuccessRedirect = (
  state: OAuthStateData | undefined,
  fallback: string = DEFAULT_OAUTH_SUCCESS_PATH,
): string => {
  if (!state) {
    return fallback;
  }
  const redirect = sanitizeRedirectParam(
    typeof state.meta?.redirect === 'string' ? state.meta.redirect : undefined,
  );

  if (state.meta?.redirect && !redirect) {
    logger.warn('Rejected unsafe redirect from OAuth state metadata', {
      provider: state.provider,
      intent: state.intent,
      redirect: formatRedirectForLog(state.meta?.redirect as string ?? ''),
    });
  }

  return redirect ?? fallback;
};

const createSuccessRedirectResolver = (fallback: string): OAuthSuccessRedirect => (
  state,
) => resolveSuccessRedirect(state, fallback);

const normalizeProviderUsername = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  if (ascii.length < 3) {
    return undefined;
  }

  return ascii.slice(0, 48);
};

const buildProviderUsername = (
  provider: OAuthProvider,
  providerId: string,
  ...candidates: Array<string | undefined>
): string => {
  for (const candidate of candidates) {
    const normalized = normalizeProviderUsername(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const fallbackSource = normalizeProviderUsername(providerId)
    ?? providerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase();
  const suffix = fallbackSource && fallbackSource.length >= 3
    ? fallbackSource
    : Math.random().toString(36).slice(2, 10);

  return `${provider}_${suffix}`.slice(0, 48);
};

const shouldUpdateProviderUsername = (
  existing: string | undefined,
  provider: OAuthProvider,
  proposed: string | undefined,
): proposed is string => {
  if (!proposed) {
    return false;
  }
  if (!existing) {
    return true;
  }
  const normalizedExisting = existing.trim().toLowerCase();
  if (normalizedExisting === proposed) {
    return false;
  }
  if (normalizedExisting.startsWith(`${provider}_`)) {
    return true;
  }
  return false;
};

const attachOAuthState = (provider: OAuthProvider, failureRedirect: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawState = extractSingleQueryParam(req.query.state);
      const record = await consumeOAuthState(provider, rawState ?? null);
      setOAuthStateOnResponse(res, record);
      next();
    } catch (error) {
      const reason = error instanceof InvalidOAuthStateError ? error.message : 'state_validation_failed';
      logger.warn('OAuth state validation failed', { provider, reason });
      authMetrics.track(`oauth:${provider}`, false, 0, reason);
      await trackEvent(null, 'oauth_state_invalid', { provider, reason });
      res.redirect(failureRedirect);
      return;
    }
  };
};

interface OAuthCallbackOptions {
  provider: OAuthProvider;
  failureRedirect: string;
  successRedirect: OAuthSuccessRedirect;
  authenticateOptions?: AuthenticateOptions;
}

const createOAuthCallbackHandler = ({
  provider,
  failureRedirect,
  successRedirect,
  authenticateOptions = {},
}: OAuthCallbackOptions) => {
  const authOptions = { ...authenticateOptions, session: false } satisfies AuthenticateOptions;

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    passport.authenticate(provider, authOptions, async (err: Error | null, user: User | false, info?: unknown) => {
      const stateRecord = getOAuthStateFromResponse(res);
      const duration = stateRecord ? Date.now() - stateRecord.data.timestamp : 0;
      const intent = stateRecord?.data.intent ?? 'login';
      const stateUserId = typeof stateRecord?.data.userId === 'number' ? stateRecord?.data.userId : null;
      const infoMessage = typeof info === 'string'
        ? info
        : typeof info === 'object' && info !== null && 'message' in info
          ? String((info as { message?: unknown }).message ?? '')
          : undefined;

      if (err || !user) {
        const reason = err?.message || infoMessage || `${provider}_failed`;
        logger.warn('OAuth callback failed', { provider, reason, intent });
        authMetrics.track(`oauth:${provider}`, false, duration, reason);
        await trackEvent(stateUserId, 'oauth_failed', { provider, intent, reason, duration });
        res.redirect(failureRedirect);
        return;
      }

      const castUser = user as User;
      req.user = castUser;

      const token = createToken(castUser);
      setAuthCookie(res, token);

      authMetrics.track(`oauth:${provider}`, true, duration);
      await trackEvent(castUser.id ?? stateUserId, 'oauth_success', {
        provider,
        intent,
        duration,
        redirect: stateRecord?.data.meta?.redirect
          ? formatRedirectForLog(String(stateRecord.data.meta.redirect))
          : null,
      });

      res.redirect(successRedirect(stateRecord?.data));
    })(req, res, next);
  };
};

interface InitiateOAuthOptions {
  intent?: OAuthStateData['intent'];
  meta?: Record<string, unknown>;
  ttlSeconds?: number;
}

const initiateOAuthFlow = async (
  provider: OAuthProvider,
  req: Request,
  res: Response,
  next: NextFunction,
  authenticateOptions: AuthenticateOptions,
  failureRedirect: string,
  options: InitiateOAuthOptions = {},
) => {
  try {
    const { state, data } = await createOAuthState(provider, req, {
      intent: options.intent,
      meta: options.meta,
      ttlSeconds: options.ttlSeconds,
    });

    const redirect = typeof data.meta?.redirect === 'string' ? data.meta.redirect : undefined;

    logger.info('OAuth flow initiated', {
      provider,
      intent: data.intent,
      userId: data.userId ?? null,
      redirect,
    });

    await trackEvent(data.userId ?? null, 'oauth_start', {
      provider,
      intent: data.intent,
      redirect: redirect ? formatRedirectForLog(redirect) : null,
    });

    passport.authenticate(provider, { ...authenticateOptions, state })(req, res, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'oauth_start_failed';
    logger.error('Failed to start OAuth flow', { provider, error: message });
    authMetrics.track(`oauth:${provider}`, false, 0, message);
    await trackEvent(null, 'oauth_failed', { provider, intent: options.intent ?? 'login', reason: message, stage: 'initiation' });
    res.redirect(failureRedirect);
    return;
  }
};

const normalizeEmail = (value: string | undefined | null): string => value?.trim().toLowerCase() ?? '';

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
        const emailRaw = profile.emails?.[0]?.value;
        const email = normalizeEmail(emailRaw);
        const emailLocalPart = email ? email.split('@')[0] : undefined;
        const avatar = profile.photos?.[0]?.value;
        const username = buildProviderUsername('google', profile.id, profile.displayName, emailLocalPart);
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('google', profile.id);

        if (user) {
          // Update avatar and username if changed
          const updates: Partial<UserUpdate> = {};
          if (avatar && user.avatar !== avatar) {
            updates.avatar = avatar;
          }
          if (email && !user.email) {
            updates.email = email;
          }
          if (!user.emailVerified) {
            updates.emailVerified = true;
          }
          if (shouldUpdateProviderUsername(user.username, 'google', username)) {
            updates.username = username;
          }
          if (Object.keys(updates).length > 0) {
            user = await storage.updateUser(user.id, updates);
          }
        } else {
          // Check by email as fallback
          if (email) {
            user = await storage.getUserByEmail(email);
          }

          if (user) {
            // Link existing user with Google provider
            const updates: Partial<UserUpdate> = {
              provider: 'google',
              providerId: profile.id,
              emailVerified: true,
            };
            if (avatar) {
              updates.avatar = avatar;
            }
            if (email && user.email !== email) {
              updates.email = email;
            }
            if (shouldUpdateProviderUsername(user.username, 'google', username)) {
              updates.username = username;
            }
            user = await storage.updateUser(user.id, updates);
          } else {
            // Create new user
            user = await storage.createUser({
              username,
              password: '',
              provider: 'google',
              providerId: profile.id,
              tier: 'free',
              emailVerified: true,
              ...(email ? { email } : {}),
              ...(avatar ? { avatar } : {}),
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
        const emailRaw = profile.emails?.[0]?.value;
        const email = normalizeEmail(emailRaw);
        const avatar = profile.photos?.[0]?.value;
        const nameCandidate = `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();
        const emailLocalPart = email ? email.split('@')[0] : undefined;
        const username = buildProviderUsername('facebook', profile.id, nameCandidate, emailLocalPart);
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('facebook', profile.id);
        
        if (user) {
          // Update avatar and username if changed
          const updates: Partial<UserUpdate> = {};
          if (avatar && user.avatar !== avatar) {
            updates.avatar = avatar;
          }
          if (email && !user.email) {
            updates.email = email;
          }
          if (!user.emailVerified) {
            updates.emailVerified = true;
          }
          if (shouldUpdateProviderUsername(user.username, 'facebook', username)) {
            updates.username = username;
          }
          if (Object.keys(updates).length > 0) {
            user = await storage.updateUser(user.id, updates);
          }
        } else {
          // Check by email as fallback
          if (email) {
            user = await storage.getUserByEmail(email);
          }

          if (user) {
            // Link existing user with Facebook provider
            const updates: Partial<UserUpdate> = {
              provider: 'facebook',
              providerId: profile.id,
              emailVerified: true,
            };
            if (avatar) {
              updates.avatar = avatar;
            }
            if (email && user.email !== email) {
              updates.email = email;
            }
            if (shouldUpdateProviderUsername(user.username, 'facebook', username)) {
              updates.username = username;
            }
            user = await storage.updateUser(user.id, updates);
          } else {
            // Create new user
            user = await storage.createUser({
              username,
              password: '',
              provider: 'facebook',
              providerId: profile.id,
              tier: 'free',
              emailVerified: true,
              ...(email ? { email } : {}),
              ...(avatar ? { avatar } : {}),
            });
          }
        }
        
        return done(null, user);
      } catch (error) {
        logger.error('Facebook strategy error', { error: error instanceof Error ? error.message : String(error) });
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
    passport.use(new (RedditStrategy as any)({
      clientID: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      callbackURL: prefixApiPath('/auth/reddit/callback', apiPrefix),
      scope: ['identity'],
      passReqToCallback: true
    }, async (
      req: Express.Request,
      accessToken: string,
      refreshToken: string,
      profile: RedditProfile,
      done: (error: Error | null, user?: User | false) => void
    ) => {
      try {
        const avatar = profile.icon_img ?? '';
        const username = buildProviderUsername('reddit', profile.id, profile.name);
        
        // First, check by provider ID (most reliable for OAuth)
        let user = await storage.getUserByProviderId('reddit', profile.id);
        
        if (user) {
          // Update avatar if changed
          const updates: Partial<UserUpdate> = {};
          if (avatar && user.avatar !== avatar) {
            updates.avatar = avatar;
          }
          if (!user.emailVerified) {
            updates.emailVerified = true;
          }
          if (shouldUpdateProviderUsername(user.username, 'reddit', username)) {
            updates.username = username;
          }
          if (Object.keys(updates).length > 0) {
            user = await storage.updateUser(user.id, updates);
          }
        } else {
          // Check if user is already logged in (linking flow)
          const existingUser = req?.user as User | undefined;
          
          if (existingUser?.id) {
            // Link Reddit to existing logged-in user
            const updates: Partial<UserUpdate> = {
              provider: 'reddit',
              providerId: profile.id,
              emailVerified: true,
            };
            if (avatar) {
              updates.avatar = avatar;
            }
            if (shouldUpdateProviderUsername(existingUser.username, 'reddit', username)) {
              updates.username = username;
            }
            user = await storage.updateUser(existingUser.id, updates);
          } else {
            // SECURITY: Never auto-link by username - this allows account takeover
            // Reddit provides no email, so we can only match by provider ID
            // If no match and not logged in, create new user (signup flow)
            user = await storage.createUser({
              username,
              password: '',
              provider: 'reddit',
              providerId: profile.id,
              tier: 'free',
              emailVerified: true,
              ...(avatar ? { avatar } : {}),
            });
          }
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
  app.get(route('/auth/google'), (req, res, next) => {
    const intentOverride = resolveIntentOverride(req);
    const redirectOverride = resolveRedirectOverride(req);
    const meta = redirectOverride ? { redirect: redirectOverride } : undefined;

    void initiateOAuthFlow(
      'google',
      req,
      res,
      next,
      { scope: ['profile', 'email'], prompt: 'select_account' },
      '/login?error=google_init_failed',
      { intent: intentOverride, meta },
    );
  });

  app.get(
    route('/auth/google/callback'),
    attachOAuthState('google', '/login?error=google_state'),
    createOAuthCallbackHandler({
      provider: 'google',
      failureRedirect: '/login?error=google_failed',
      successRedirect: createSuccessRedirectResolver(DEFAULT_OAUTH_SUCCESS_PATH),
    }),
  );

  // Facebook routes
  app.get(route('/auth/facebook'), (req, res, next) => {
    const intentOverride = resolveIntentOverride(req);
    const redirectOverride = resolveRedirectOverride(req);
    const meta = redirectOverride ? { redirect: redirectOverride } : undefined;

    void initiateOAuthFlow(
      'facebook',
      req,
      res,
      next,
      { scope: ['email'] },
      '/login?error=facebook_init_failed',
      { intent: intentOverride, meta },
    );
  });

  app.get(
    route('/auth/facebook/callback'),
    attachOAuthState('facebook', '/login?error=facebook_state'),
    createOAuthCallbackHandler({
      provider: 'facebook',
      failureRedirect: '/login?error=facebook_failed',
      successRedirect: createSuccessRedirectResolver(DEFAULT_OAUTH_SUCCESS_PATH),
    }),
  );

  // Reddit routes
  app.get(route('/auth/reddit'), (req: Request, res: Response, next: NextFunction) => {
    const redditAuthOptions: RedditAuthenticateOptions = {
      duration: 'permanent',
    };
    void initiateOAuthFlow(
      'reddit',
      req,
      res,
      next,
      redditAuthOptions,
      '/login?error=reddit_init_failed',
      { intent: 'account-link' },
    );
  });

  app.get(
    route('/auth/reddit/callback'),
    attachOAuthState('reddit', '/login?error=reddit_state'),
    createOAuthCallbackHandler({
      provider: 'reddit',
      failureRedirect: '/login?error=reddit_failed',
      successRedirect: () => '/dashboard?connected=reddit',
    }),
  );

  // Logout endpoint removed - now handled in server/auth.ts

  // Get current user - REMOVED: Duplicate endpoint
  // The main /api/auth/user endpoint is handled in server/auth.ts with JWT support
}