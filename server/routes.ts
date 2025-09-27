import type { Express, Response, NextFunction } from "express";
import express from "express";
import type { Session } from "express-session";
import { createServer, type Server } from "http";
import path from 'path';
import Stripe from 'stripe';
import passport from 'passport';

// Security and middleware
import { validateEnvironment, securityMiddleware, ipLoggingMiddleware, errorHandler, logger, generationLimiter } from "./middleware/security.js";
import { AppError, CircuitBreaker } from "./lib/errors.js";
import { authenticateToken } from "./middleware/auth.js";
import { createSessionMiddleware } from "./bootstrap/session.js";

// Route modules
// import { authRoutes } from "./routes/auth.js"; // Removed - using server/auth.ts instead
import { uploadRoutes, applyImageShieldProtection, protectionPresets } from "./routes/upload.js";
import { mediaRoutes } from "./routes/media.js";
import { analyticsRouter } from "./routes/analytics.js";
import { referralRouter } from "./routes/referrals.js";
import { registerExpenseRoutes } from "./expense-routes.js";
import { adminCommunitiesRouter } from "./routes/admin-communities.js";
import { createCancelSubscriptionHandler } from "./routes/subscription-management.js";
import { createLocalDownloadRouter } from "./routes/downloads.js";

// Core imports
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { setupAdminRoutes } from "./admin-routes.js";
import { configureSocialAuth, socialAuthRoutes } from "./social-auth-config.js";
import { visitorAnalytics } from "./visitor-analytics.js";
import { makePaxum, makeCoinbase, makeStripe } from "./payments/payment-providers.js";
import { deriveStripeConfig } from "./payments/stripe-config.js";
import { buildUploadUrl } from "./lib/uploads.js";
import { API_PREFIX, prefixApiPath } from "./lib/api-prefix.js";

export function buildCsrfProtectedRoutes(apiPrefix: string = API_PREFIX): string[] {
  return [
    prefixApiPath('/auth/verify-email', apiPrefix),
    prefixApiPath('/auth/change-password', apiPrefix),
    prefixApiPath('/auth/forgot-password', apiPrefix),
    prefixApiPath('/auth/reset-password', apiPrefix),
    prefixApiPath('/upload/image', apiPrefix),
    prefixApiPath('/generate-content', apiPrefix),
    prefixApiPath('/reddit/connect', apiPrefix),
    prefixApiPath('/reddit/submit', apiPrefix),
    prefixApiPath('/admin/*', apiPrefix),
    prefixApiPath('/billing/*', apiPrefix),
    prefixApiPath('/auth/delete-account', apiPrefix),
    prefixApiPath('/user/settings', apiPrefix),
  ];
}

export const csrfProtectedRoutes = buildCsrfProtectedRoutes();
// Analytics request type
interface AnalyticsRequest extends express.Request {
  sessionID: string;
}

// Import users table for type inference
<<<<<<< ours
import { users, type ContentGeneration, type InsertSavedContent } from "@shared/schema";
import type { IStorage } from "./storage.js";
=======
import { users, type ContentGeneration, insertSavedContentSchema, type InsertSavedContent } from "@shared/schema";
>>>>>>> theirs

// AuthUser interface for passport serialization
interface AuthUser {
  id: number;
  username?: string;
  isAdmin?: boolean;
}

// Auth request interface that includes user
type SessionUser = typeof users.$inferSelect & { subscriptionTier?: string | null };

interface AuthenticatedRequest extends express.Request {
  user?: SessionUser;
}

// User tier type
type UserTier = 'free' | 'starter' | 'pro' | 'premium';

// Additional interfaces for type safety
interface PhotoInstructionsData {
  cameraAngle?: string;
  mood?: string;
  technicalSettings?: string;
  lighting?: string | string[];
  angles?: string | string[];
  composition?: string | string[];
  styling?: string | string[];
  technical?: string | string[];
}

  export interface SaveContentRequestBody {
    title?: string;
    content?: string;
    platform?: string | null;
    generationId?: number | string | null;
    contentGenerationId?: number | string | null;
    socialMediaPostId?: number | string | null;
    tags?: string[]; // or a more specific type if available
    metadata?: InsertSavedContent['metadata'];
  }

}

interface SessionWithReddit extends Session {
  redditOAuthState?: string;
}

// ==========================================
// PRO RESOURCES ROUTES
// ==========================================

const normalizeOptionalId = (value: number | string | null | undefined): number | undefined | 'invalid' => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const stringified = String(value).trim();
  if (stringified.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(stringified, 10);
  if (Number.isNaN(parsed)) {
    return 'invalid';
  }

  return parsed;
};

export function createSaveContentHandler(
  deps: SaveContentHandlerDependencies = { storage }
): express.RequestHandler {
  return async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const body = (req.body ?? {}) as SaveContentRequestBody;

      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }

      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }

      const normalizedGenerationId = normalizeOptionalId(body.contentGenerationId ?? body.generationId);
      if (normalizedGenerationId === 'invalid') {
        return res.status(400).json({ message: 'generationId must be a valid number' });
      }

      const normalizedSocialPostId = normalizeOptionalId(body.socialMediaPostId);
      if (normalizedSocialPostId === 'invalid') {
        return res.status(400).json({ message: 'socialMediaPostId must be a valid number' });
      }

      let generation: ContentGeneration | undefined;
      if (typeof normalizedGenerationId === 'number') {
        const generations = await deps.storage.getUserContentGenerations(req.user.id);
        generation = generations.find(item => item.id === normalizedGenerationId);

        if (!generation) {
          return res.status(404).json({ message: 'Content generation not found' });
        }
      }

      let socialPost: Awaited<ReturnType<IStorage['getSocialMediaPost']>> | undefined;
      if (typeof normalizedSocialPostId === 'number') {
        socialPost = await deps.storage.getSocialMediaPost(normalizedSocialPostId);

        if (!socialPost || socialPost.userId !== req.user.id) {
          return res.status(404).json({ message: 'Social media post not found' });
        }
      }

      const providedPlatform = typeof body.platform === 'string' ? body.platform.trim() : '';
      const platform = providedPlatform
        || generation?.platform
        || socialPost?.platform
        || undefined;

      const payload: InsertSavedContent = {
        userId: req.user.id,
        title,
        content,
        platform,
        contentGenerationId: typeof normalizedGenerationId === 'number' ? normalizedGenerationId : undefined,
        socialMediaPostId: typeof normalizedSocialPostId === 'number' ? normalizedSocialPostId : undefined,
        metadata: body.metadata ?? undefined,
      };

      const record = await deps.storage.createSavedContent(payload);
      return res.status(201).json(record);
    } catch (error) {
      logger.error('Failed to save content:', error);
      return res.status(500).json({ message: 'Failed to save content' });
    }
  };
}

function registerProResourcesRoutes(app: Express, apiPrefix: string = API_PREFIX) {
  const route = (path: string) => prefixApiPath(path, apiPrefix);
  const resolveTier = (tierValue: string | null | undefined): UserTier | undefined => {
    if (tierValue === 'pro' || tierValue === 'premium' || tierValue === 'starter') {
      return tierValue;
    }
    if (tierValue === 'free') {
      return 'free';
    }
    return undefined;
  };

  // Helper to get user tier with storage fallback when session lacks tier information
  const getUserTier = async (user: SessionUser | undefined): Promise<UserTier> => {
    if (!user?.id) {
      return 'free';
    }

    if (user.subscriptionTier !== undefined && user.subscriptionTier !== null) {
      return resolveTier(user.subscriptionTier) ?? 'free';
    }

    const tierFromUser = resolveTier(user.tier);
    if (tierFromUser) {
      return tierFromUser;
    }

    try {
      const persistedUser = await storage.getUserById(user.id);
      if (persistedUser) {
        const persistedTier = resolveTier(
          (persistedUser as SessionUser).subscriptionTier ?? persistedUser.tier
        );
        if (persistedTier) {
          return persistedTier;
        }
      }
    } catch (storageError) {
      logger.warn('Failed to resolve user tier from storage', {
        userId: user.id,
        error: storageError instanceof Error ? storageError.message : String(storageError)
      });
    }

    return 'free';
  };


  // GET /api/pro-resources - List all perks for authenticated users
  app.get(route('/pro-resources'), authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(403).json({
          perks: [],
          accessGranted: false,
          message: "Authentication required for pro resources"
        });
      }

      const userTier = await getUserTier(req.user);

      // Only pro/premium users get access
      if (userTier === 'free' || userTier === 'starter') {
        return res.status(403).json({
          perks: [],
          accessGranted: false,
          message: "Pro subscription required to access these resources"
        });
      }

      const availablePerks = userTier === 'premium'
        ? getAvailablePerks('pro')
        : getAvailablePerks(userTier);

      res.json({
        perks: availablePerks,
        accessGranted: true
      });

    } catch (error) {
      logger.error("Pro resources error:", error);
      res.status(500).json({
        perks: [],
        accessGranted: false,
        message: "Failed to load pro resources"
      });
    }
  });

  // GET /api/pro-resources/:id/signup-instructions - Get detailed signup instructions
  app.get(route('/pro-resources/:id/signup-instructions'), authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userTier = await getUserTier(req.user);
      if (userTier === 'free' || userTier === 'starter') {
        return res.status(403).json({ message: "Pro subscription required" });
      }

      const perkId = req.params.id;
      if (!perkId) {
        return res.status(400).json({ message: "Perk ID required" });
      }

      // Verify the perk exists and user has access
      const availablePerks = userTier === 'premium'
        ? getAvailablePerks('pro')
        : getAvailablePerks(userTier);
      const perk = availablePerks.find(p => p.id === perkId);

      if (!perk) {
        return res.status(404).json({ message: "Perk not found or not accessible" });
      }

      const instructions = getSignupInstructions(perkId);

      res.json({
        instructions
      });

    } catch (error) {
      logger.error("Signup instructions error:", error);
      res.status(500).json({ message: "Failed to load signup instructions" });
    }
  });

}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeOptionalId = (value: number | string | null | undefined, field: string): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
    throw new Error(`Invalid ${field}`);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new Error(`Invalid ${field}`);
};

export function registerSavedContentRoutes(app: Express, options?: RegisterRoutesOptions): void {
  app.post('/api/saved-content', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const body = req.body as SaveContentRequestBody | undefined;
      const title = typeof body?.title === 'string' ? body.title.trim() : '';
      const content = typeof body?.content === 'string' ? body.content.trim() : '';

      if (title.length === 0) {
        return res.status(400).json({ message: 'Title is required' });
      }

      if (content.length === 0) {
        return res.status(400).json({ message: 'Content is required' });
      }

      let contentGenerationId: number | undefined;
      let socialMediaPostId: number | undefined;

      try {
        contentGenerationId = normalizeOptionalId(body?.contentGenerationId ?? undefined, 'contentGenerationId');
      } catch (idError) {
        return res.status(400).json({ message: (idError as Error).message });
      }

      try {
        socialMediaPostId = normalizeOptionalId(body?.socialMediaPostId ?? undefined, 'socialMediaPostId');
      } catch (idError) {
        return res.status(400).json({ message: (idError as Error).message });
      }

      if (Array.isArray(body?.tags)) {
        const hasInvalidTag = body.tags.some(tag => typeof tag !== 'string' || tag.trim().length === 0);
        if (hasInvalidTag) {
          return res.status(400).json({ message: 'Tags must be non-empty strings' });
        }
      } else if (body?.tags !== undefined && body.tags !== null) {
        return res.status(400).json({ message: 'Tags must be provided as an array of strings' });
      }

      if (body?.metadata !== undefined && body.metadata !== null && !isRecord(body.metadata)) {
        return res.status(400).json({ message: 'Metadata must be an object' });
      }

      if (contentGenerationId !== undefined) {
        const generations = await storage.getUserContentGenerations(req.user.id);
        const ownsGeneration = generations.some(generation => generation.id === contentGenerationId);
        if (!ownsGeneration) {
          return res.status(404).json({ message: 'Content generation not found' });
        }
      }

      let linkedPostPlatform: string | undefined;
      if (socialMediaPostId !== undefined) {
        const post = await storage.getSocialMediaPost(socialMediaPostId);
        if (!post || post.userId !== req.user.id) {
          return res.status(404).json({ message: 'Social media post not found' });
        }
        linkedPostPlatform = post.platform;
      }

      const requestedPlatform = typeof body?.platform === 'string' ? body.platform.trim() : undefined;
      const normalizedPlatform = requestedPlatform && requestedPlatform.length > 0
        ? requestedPlatform
        : linkedPostPlatform;

      const normalizedTags = Array.isArray(body?.tags)
        ? body.tags.map(tag => tag.trim())
        : undefined;

      const payloadInput: Partial<InsertSavedContent> = {
        userId: req.user.id,
        title,
        content,
      };

      if (normalizedPlatform) {
        payloadInput.platform = normalizedPlatform;
      }

      if (normalizedTags !== undefined) {
        payloadInput.tags = normalizedTags;
      }

      if (body?.metadata !== undefined && body.metadata !== null) {
        payloadInput.metadata = body.metadata as Record<string, unknown>;
      }

      if (contentGenerationId !== undefined) {
        payloadInput.contentGenerationId = contentGenerationId;
      }

      if (socialMediaPostId !== undefined) {
        payloadInput.socialMediaPostId = socialMediaPostId;
      }

      const payload = insertSavedContentSchema.parse(payloadInput);
      const record = await storage.createSavedContent(payload);

      return res.status(201).json(record);
    } catch (error) {
      logger.error('Failed to save content:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      return res.status(500).json({ message: 'Failed to save content' });
    }
  });
}

// Session interface with Reddit OAuth properties
interface RedditSessionData {
  redditOAuthState?: string;
  redditConnected?: boolean;
}

declare module 'express-session' {
  interface SessionData extends RedditSessionData {}
}

// Service imports
import { generateContent } from "./services/content-generator.js";
import { generateAIContent, analyzeImageForContent } from "./services/ai-generator.js";
import { generateWithMultiProvider, getProviderStatus } from "./services/multi-ai-provider.js";
import { generateUnifiedAIContent, analyzeImage } from "./services/unified-ai-service.js";
import { generateImageCaption, imageToBase64, validateImageFormat } from "./image-caption-generator.js";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage.js";
import { getRandomTemplates, addWatermark, getTemplateByMood } from "./content-templates.js";
import { generateAdvancedContent, type ContentParameters } from "./advanced-content-generator.js";

// Reddit communities now handled in reddit-routes.ts
import { getAvailablePerks, getPerksByCategory, getSignupInstructions } from "./pro-perks.js";

type SentryInstance = typeof import('@sentry/node');

interface RegisterRoutesOptions {
  sentry?: SentryInstance | null;
}
import type { ProPerk } from "./pro-perks.js";
import { ReferralManager } from './lib/referral-system.js';

// API route modules
import { registerApiRoutes } from "./api-routes.js";
import { registerPolicyRoutes } from "./policy-routes.js";
import { registerRedditRoutes } from "./reddit-routes.js";
import { registerAnalyticsRoutes } from "./analytics-routes.js";
import { createLead, confirmLead } from "./api/leads.js";
import { getLeads } from './api/admin-leads.js';
import { getComplianceStatus } from './api/compliance-status.js';
import { captionRouter } from "./routes/caption.js";
import { contentGenerationLimiter } from "./middleware/tiered-rate-limit.js";
import { registerSocialMediaRoutes } from "./social-media-routes.js";

// Schema imports
import { insertContentGenerationSchema, insertUserImageSchema } from "@shared/schema";

// Core dependencies
import multer from 'multer';
import fs from 'fs/promises';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import csrf from 'csurf';

// Get secure environment variables (no fallbacks)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const stripeConfig = deriveStripeConfig({
  env: process.env,
  logger,
});

// Initialize Stripe if configured
const stripe = stripeConfig ? new Stripe(stripeConfig.secretKey, {
  apiVersion: stripeConfig.apiVersion as Stripe.LatestApiVersion,
}) : null;

// Configure multer for optional image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Auth request interface
interface AuthRequest extends express.Request {
  user?: typeof users.$inferSelect;
}

interface GenerationRequestBody {
  mode?: string;
  prompt?: string;
  platform?: string;
  style?: string;
  theme?: string;
  includePromotion?: boolean | string;
  customInstructions?: string;
}

interface PhotoInstructionsResult {
  lighting?: string | string[];
  angles?: string | string[];
  cameraAngle?: string | string[];
  composition?: string | string[];
  styling?: string | string[];
  technicalSettings?: string | string[];
}

const normalizeInstructionValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    const normalized = value
      .map(entry => entry?.trim())
      .filter((entry): entry is string => Boolean(entry && entry.length > 0))
      .join(', ');
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

// Helper function to normalize photo instructions
function normalizePhotoInstructions(
  instructions: PhotoInstructionsResult | Record<string, unknown> | null | undefined
): PhotoInstructionsData {
  const result: PhotoInstructionsData = {};

  if (!instructions) return result;

  result.lighting = normalizeInstructionValue((instructions as any).lighting);
  result.cameraAngle = normalizeInstructionValue((instructions as any).cameraAngle ?? (instructions as any).angles);
  result.angles = normalizeInstructionValue((instructions as any).angles);
  result.composition = normalizeInstructionValue((instructions as any).composition);
  result.styling = normalizeInstructionValue((instructions as any).styling);
  result.mood = normalizeInstructionValue((instructions as any).mood) ?? (instructions as any).mood;
  result.technical = normalizeInstructionValue((instructions as any).technical);
  result.technicalSettings = normalizeInstructionValue((instructions as any).technicalSettings ?? (instructions as any).technical);

  return result;
}

const addIntervalToStart = (
  start: number,
  interval: Stripe.Plan.Interval,
  intervalCount: number
): number => {
  const startDate = new Date(start * 1000);

  switch (interval) {
    case 'day':
      startDate.setUTCDate(startDate.getUTCDate() + intervalCount);
      break;
    case 'week':
      startDate.setUTCDate(startDate.getUTCDate() + intervalCount * 7);
      break;
    case 'month':
      startDate.setUTCMonth(startDate.getUTCMonth() + intervalCount);
      break;
    case 'year':
      startDate.setUTCFullYear(startDate.getUTCFullYear() + intervalCount);
      break;
    default:
      break;
  }

  return Math.floor(startDate.getTime() / 1000);
};

const coerceStripeTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return undefined;
};

const coerceIsoString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return undefined;
};

const isStripeSubscription = (
  subscription: Stripe.Subscription | Stripe.SubscriptionSchedule
): subscription is Stripe.Subscription => subscription.object === 'subscription';

const isStripeSubscriptionSchedule = (
  subscription: Stripe.Subscription | Stripe.SubscriptionSchedule
): subscription is Stripe.SubscriptionSchedule => subscription.object === 'subscription_schedule';

const resolveBillingPeriodEnd = (
  subscription: Stripe.Subscription | Stripe.SubscriptionSchedule | null | undefined
): number | string | undefined => {
  if (!subscription) {
    return undefined;
  }

  if (isStripeSubscription(subscription)) {
    const primaryItem = subscription.items?.data?.[0];

    if (primaryItem) {
      const itemPeriodEnd = coerceStripeTimestamp(primaryItem.current_period_end);
      if (itemPeriodEnd !== undefined) {
        return itemPeriodEnd;
      }

      const start = coerceStripeTimestamp(primaryItem.current_period_start);
      const interval = primaryItem.plan?.interval;
      const intervalCount = primaryItem.plan?.interval_count ?? 1;

      if (start !== undefined && interval) {
        return addIntervalToStart(start, interval, intervalCount);
      }
    }

    const subscriptionPeriodEnd = coerceStripeTimestamp((subscription as any).current_period_end);
    if (subscriptionPeriodEnd !== undefined) {
      return subscriptionPeriodEnd;
    }

    return coerceIsoString((subscription as any).current_period_end);
  }

  if (isStripeSubscriptionSchedule(subscription)) {
    const scheduleEnd =
      coerceStripeTimestamp(subscription.current_phase?.end_date) ??
      coerceStripeTimestamp(subscription.phases?.[0]?.end_date);

    if (scheduleEnd !== undefined) {
      return scheduleEnd;
    }

    const isoEnd =
      coerceIsoString(subscription.current_phase?.end_date) ??
      coerceIsoString(subscription.phases?.[0]?.end_date);

    if (isoEnd) {
      return isoEnd;
    }
  }

  return undefined;
};

// ==========================================
// PRO PERKS HELPER FUNCTIONS
// ==========================================
const deriveSharePercentage = (perk: ProPerk): number => {
    if (!perk.commissionRate) {
      return 20;
    }

    const percentMatches = Array.from(perk.commissionRate.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
    if (percentMatches.length === 0) {
      return 20;
    }

    const numericPercents = percentMatches
      .map(match => Number.parseFloat(match[1]))
      .filter((value): value is number => Number.isFinite(value));

    if (numericPercents.length === 0) {
      return 20;
    }

    const normalizedPercents = numericPercents.map(value => {
      const rounded = Math.round(value);
      if (Number.isNaN(rounded)) {
        return 20;
      }
      return Math.min(100, Math.max(1, rounded));
    });

    return Math.max(...normalizedPercents);
  };


export async function registerRoutes(app: Express, apiPrefix: string = API_PREFIX, options?: RegisterRoutesOptions): Promise<Server> {
  // ==========================================
  // VALIDATE ENVIRONMENT & APPLY SECURITY
  // ==========================================

  // Set trust proxy securely for rate limiters
  app.set('trust proxy', (ip: string) => {
    // Trust localhost and private network ranges
    return ['127.0.0.1', '::1'].includes(ip) || ip.startsWith('10.') || ip.startsWith('192.168.');
  });

  // Validate required environment variables first
  validateEnvironment();

  // Log IPs first so downstream middleware can use req.userIP
  app.use(ipLoggingMiddleware);
  app.use(securityMiddleware);

  const sessionConfigured = app.get('sessionConfigured') === true;

  if (!sessionConfigured) {
    logger.warn('Session middleware not configured before registerRoutes; applying default session middleware');
    app.use(createSessionMiddleware());
    app.set('sessionConfigured', true);
  }

  // Initialize Passport after session middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport serialization for admin
  passport.serializeUser((user, done) => {
    done(null, (user as AuthUser).id);
  });

  passport.deserializeUser(async (id: unknown, done) => {
    try {
      if (typeof id !== 'number') {
        return done(new Error('Invalid user ID'), null);
      }
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)), null);
    }
  });

  // CSRF protection for session-based routes
  const csrfProtection: express.RequestHandler = csrf({
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'strict'
    }
  }) as unknown as express.RequestHandler;

  // CSRF error handling middleware
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof Error && (err as { code?: string }).code === 'EBADCSRFTOKEN') {
      logger.warn('CSRF token validation failed', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        hasSession: !!req.session
      });
      return res.status(403).json({
        message: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
    // If Sentry is configured, capture the error
    if (options?.sentry) {
      options.sentry.captureException(err);
    }
    next(err);
  });

  // Apply CSRF protection to sensitive routes
  // Note: JWT-based routes rely on token authentication instead of CSRF

  // Apply CSRF protection to sensitive routes
  const csrfRoutes = buildCsrfProtectedRoutes(apiPrefix);
  const route = (path: string) => prefixApiPath(path, apiPrefix);

  csrfRoutes.forEach((protectedRoute) => {
    if (protectedRoute.includes('*')) {
      // Handle wildcard routes
      const baseRoute = protectedRoute.replace('/*', '');
      app.use(baseRoute, csrfProtection);
      app.use(`${baseRoute}/*`, csrfProtection);
    } else {
      app.use(protectedRoute, csrfProtection);
    }
  });

  // CSRF token endpoint
  app.get(route('/csrf-token'), csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // ==========================================
  // AUTHENTICATION SETUP
  // ==========================================

  // Setup authentication
  setupAuth(app);
  setupAdminRoutes(app);

  // Configure social authentication
  configureSocialAuth();

  // ==========================================
  // ROUTE REGISTRATION
  // ==========================================

  // Authentication routes - handled by setupAuth() in server/auth.ts
  // app.use('/api/auth', authRoutes); // Removed - duplicate auth system

  // Upload routes
  app.use('/api/upload', uploadRoutes);

  // Media routes
  app.use('/api/media', mediaRoutes);

  // Analytics routes
  app.use('/api/analytics', analyticsRouter);

  // Referral routes
  app.use('/api/referral', referralRouter);

  // Admin communities routes are exposed under a dedicated admin namespace
  app.use('/api/admin/communities', adminCommunitiesRouter);

  // Social auth routes
  app.get('/api/auth/google', socialAuthRoutes.googleAuth);
  app.get('/api/auth/google/callback', socialAuthRoutes.googleCallback);
  app.get('/api/auth/facebook', socialAuthRoutes.facebookAuth);
  app.get('/api/auth/facebook/callback', socialAuthRoutes.facebookCallback);
  app.get('/api/auth/reddit', socialAuthRoutes.redditAuth);
  app.get('/api/auth/reddit/callback', socialAuthRoutes.redditCallback);

  // Serve uploaded files through token-protected controller
  app.use('/uploads', createLocalDownloadRouter());

  // ==========================================
  // STRIPE PAYMENT ENDPOINTS
  // ==========================================

  // Create subscription payment intent
  app.post("/api/create-subscription", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({
          message: "Payment system is not configured. Please try again later."
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { plan, amount } = req.body;

      // Validate plan and amount
      if (!plan || !amount) {
        return res.status(400).json({ message: "Plan and amount are required" });
      }

      if (plan !== 'pro' && plan !== 'pro_plus') {
        return res.status(400).json({ message: "Invalid plan selected" });
      }

      // Get or create Stripe customer
      const user = await storage.getUser(req.user.id);
      let customerId = user?.stripeCustomerId;

      if (!customerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          metadata: {
            userId: req.user.id.toString(),
            plan: plan
          }
        });
        customerId = customer.id;

        // Save customer ID to database
        await storage.updateUser(req.user.id, { stripeCustomerId: customerId });
      }

      // Create subscription with trial period
      const priceData = {
        currency: 'usd',
        product_data: {
          name: plan === 'pro_plus' ? 'ThottoPilot Pro Plus' : 'ThottoPilot Pro',
          description: plan === 'pro_plus'
            ? 'Premium content creation with advanced features'
            : 'Professional content creation and protection'
        },
        unit_amount: amount,
        recurring: {
          interval: 'month'
        }
      } as any;

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price_data: priceData
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: req.user.id.toString(),
          plan: plan
        }
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as { payment_intent?: Stripe.PaymentIntent }).payment_intent as Stripe.PaymentIntent;
      const billingPeriodEnd = resolveBillingPeriodEnd(subscription);

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        currentPeriodEnd: billingPeriodEnd
      });
    } catch (error: unknown) {
      logger.error("Subscription creation error:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({
        message: "Error creating subscription: " + (error instanceof Error ? (error as Error).message : 'Unknown error')
      });
    }
  });

  // Get subscription status
  app.get("/api/subscription-status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!stripe) {
        return res.json({ hasSubscription: false, plan: 'free' });
      }

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(req.user.id);

      if (!user?.stripeCustomerId) {
        return res.json({ hasSubscription: false, plan: 'free' });
      }

      // Get active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        if ('deleted' in subscription && subscription.deleted) {
          return res.json({ hasSubscription: false, plan: 'free' });
        }
        const plan = subscription.metadata?.plan || 'pro';
        const currentPeriodEnd = resolveBillingPeriodEnd(subscription);

        return res.json({
          hasSubscription: true,
          plan,
          subscriptionId: subscription.id,
          currentPeriodEnd
        });
      }

      return res.json({ hasSubscription: false, plan: 'free' });
    } catch (error) {
      logger.error("Subscription status error:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  const cancelSubscriptionHandler = createCancelSubscriptionHandler({
    stripe,
    storage,
    logger,
    sentry: options?.sentry ?? null,
  });

  // Cancel subscription
  app.post("/api/cancel-subscription", authenticateToken, cancelSubscriptionHandler);

  // ==========================================
  // CONTENT GENERATION ENDPOINTS
  // ==========================================

  const generateContentBreaker = new CircuitBreaker(generateContent);
  const unifiedBreaker = new CircuitBreaker(generateUnifiedAIContent);

  // Generate content with rate limiting
  app.post("/api/generate-content", generationLimiter, authenticateToken, async (req: AuthRequest, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { platform, style, theme, timing, allowsPromotion } = req.body;
    try {
      const result = await generateContentBreaker.call(
        platform || 'reddit',
        style || 'playful',
        theme || 'lingerie',
        timing,
        allowsPromotion
      );
      const normalizedPhotoInstructions = normalizePhotoInstructions(result.photoInstructions);
      const toNormalizedString = (value: string | string[] | undefined, fallback: string): string => {
        const normalized = normalizeInstructionValue(value);
        return normalized ?? fallback;
      };

      const normalizedInstructions = normalizePhotoInstructions(result.photoInstructions ?? {});
      const photoInstructions = {
        lighting: toNormalizedString(normalizedInstructions.lighting, 'Natural lighting'),
        cameraAngle: toNormalizedString(normalizedInstructions.cameraAngle, 'Eye level'),
        composition: toNormalizedString(normalizedInstructions.composition, 'Center composition'),
        styling: toNormalizedString(normalizedInstructions.styling, 'Casual styling'),
        mood: toNormalizedString(normalizedInstructions.mood, 'Confident and natural'),
        technicalSettings: toNormalizedString(normalizedInstructions.technicalSettings, 'Auto settings')
      };
      await storage.createContentGeneration({
        userId: req.user.id,
        titles: result.titles || [],
        content: result.content || '',
        photoInstructions,
        platform: platform || "reddit",
        style: style || 'playful',
        theme: theme || 'lingerie',
        createdAt: new Date()
      });
      res.json(result);
    } catch (error: unknown) {
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      next(error instanceof AppError ? error : new AppError('Failed to generate content', 500));
    }
  });

  // Unified AI generation endpoint - handles both text and image workflows
  app.post('/api/generate-unified', generationLimiter, authenticateToken, upload.single('image'), async (req: AuthRequest, res, next) => {
    try {
      interface GenerationRequestBody {
        mode: string;
        prompt: string;
        platform?: string;
        style?: string;
        theme?: string;
        includePromotion?: boolean;
        customInstructions?: string;
      }
      const body = req.body as Partial<GenerationRequestBody>;
      if (!body.mode || !body.prompt) {
        return res.status(400).json({ error: 'mode and prompt are required' });
      }
      const {
        mode,
        prompt,
        platform,
        style,
        theme,
        includePromotion,
        customInstructions
      } = body;

      if (req.user?.id) {
        const user = await storage.getUser(req.user.id);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        const userTier = user.tier || 'free';
        const dailyCount = await storage.getDailyGenerationCount(req.user.id);
        let dailyLimit = 5;
        if (userTier === 'pro') dailyLimit = 50;
        else if (userTier === 'starter') dailyLimit = 25;
        if (dailyLimit !== -1 && dailyCount >= dailyLimit) {
          return res.status(429).json({
            error: 'Daily generation limit reached',
            limit: dailyLimit,
            used: dailyCount,
            tier: userTier,
            message: `You've reached your daily limit of ${dailyLimit} generations. ${userTier === 'free' ? 'Upgrade to Pro for 50 daily generations!' : 'Your limit resets tomorrow.'}`
          });
        }
      }

      let imageBase64: string | undefined;
      if (mode === 'image' && req.file) {
        if (!validateImageFormat(req.file.originalname)) {
          return res.status(400).json({ error: 'Invalid image format. Please use JPG, PNG, or WebP.' });
        }
        imageBase64 = imageToBase64(req.file.path);
        await fs.unlink(req.file.path).catch(console.error);
      }

      const result = await unifiedBreaker.call({
        mode: (mode as 'text' | 'image') || 'text',
        prompt,
        imageBase64,
        platform: platform || 'reddit',
        style: style || 'playful',
        theme,
        includePromotion: Boolean(includePromotion),
        customInstructions
      });

      if (req.user?.id) {
        await storage.createContentGeneration({
          userId: req.user.id,
          platform: platform || 'reddit',
          style: style || 'playful',
          theme: theme || 'general',
          titles: result.titles,
          content: result.content,
          photoInstructions: result.photoInstructions,
          prompt: prompt || customInstructions,
          allowsPromotion: Boolean(includePromotion)
        });
      }

      res.json({ ...result });
    } catch (error: unknown) {
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      next(error instanceof AppError ? error : new AppError('Failed to generate content', 500));
    }
  });

  // Get user stats
  // Debug endpoint for Reddit OAuth troubleshooting (temporary)
  app.get('/api/debug/session', (req: express.Request, res) => {
    res.json({
      sessionId: req.sessionID,
      hasSession: !!req.session,
      redditState: req.session?.redditOAuthState,
      redditConnected: req.session?.redditConnected,
      cookies: req.headers.cookie ? 'present' : 'missing'
    });
  });

  app.get("/api/user-stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const generations = await storage.getGenerationsByUserId(req.user.id);
      const today = new Date();
      const todayGenerations = generations.filter((g: ContentGeneration) =>
        g.createdAt && new Date(g.createdAt).toDateString() === today.toDateString()
      );

      const stats = {
        total: generations.length,
        today: todayGenerations.length,
        thisWeek: generations.filter((g: ContentGeneration) => g.createdAt &&
          new Date(g.createdAt) > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        thisMonth: generations.filter((g: ContentGeneration) => g.createdAt &&
          new Date(g.createdAt).getMonth() === today.getMonth() &&
          new Date(g.createdAt).getFullYear() === today.getFullYear()
        ).length,
        dailyStreak: 0 // Would need more complex logic to calculate
      };
      const user = await storage.getUser(req.user.id);
      const userTier = user?.tier || 'free';

      // Calculate daily generation limits based on tier
      let dailyLimit: number = 10;
      if (userTier === 'free') {
        dailyLimit = 10;
      } else if (userTier === 'pro') {
        dailyLimit = 100;
      } else if (userTier === 'starter') {
        dailyLimit = 50;
      }

      const userStats = {
        postsCreated: stats.total,
        totalViews: 0, // Real views not tracked yet - show 0
        engagementRate: '0.0', // Real engagement not tracked yet - show 0
        streak: stats.dailyStreak || 0,
        thisWeek: stats.thisWeek,
        thisMonth: stats.thisMonth,
        dailyGenerations: {
          used: stats.today,
          limit: dailyLimit,
          remaining: dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - stats.today)
        }
      };

      res.json(userStats);
    } catch (error) {
      logger.error("User stats error:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  // Get content generation history
  app.get("/api/content-generation-history", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await storage.getGenerationsByUserId(req.user.id);

      // Limit results and format for frontend
      const formattedHistory = history.slice(0, limit).map(gen => ({
        ...gen,
        titles: Array.isArray(gen.titles) ? gen.titles :
                typeof gen.titles === 'string' ? JSON.parse(gen.titles || '[]') : []
      }));

      res.json(formattedHistory);
    } catch (error) {
      logger.error("Generation history error:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: "Failed to get generation history" });
    }
  });

  // ==========================================
  // REGISTER EXISTING ROUTE MODULES
  // ==========================================

  // Register new enterprise API routes
  registerApiRoutes(app);

  // Register Policy Routes
  registerPolicyRoutes(app);

  // Register Reddit Routes
  registerRedditRoutes(app);

  // Register Analytics Routes
  registerAnalyticsRoutes(app);

  // Register Social Media Routes
  registerSocialMediaRoutes(app);

  // Register Saved Content Routes
  registerSavedContentRoutes(app, options);

  // Register Expense Routes (Tax Tracker API)
  registerExpenseRoutes(app);

  // Register Pro Resources Routes
  registerProResourcesRoutes(app);

  // Register Caption Routes (2-pass Gemini pipeline) - MOVED UP to get routing priority
  app.use('/api/caption', captionRouter);

  // Register Dashboard Routes
  import('./routes/dashboard.js').then(({ dashboardRouter }) => {
    app.use('/api/dashboard', dashboardRouter);
  }).catch(err => {
    logger.error('Failed to load dashboard routes:', err);
    if (options?.sentry) {
      options.sentry.captureException(err);
    }
  });

  // ==========================================
  // CONTENT GENERATIONS HISTORY API
  // ==========================================

  app.post('/api/saved-content', authenticateToken, createSaveContentHandler());

  // Get user's content generation history
  app.get('/api/content-generations', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const generations = await storage.getGenerationsByUserId(req.user.id);
      res.json(generations);
    } catch (error: unknown) {
      logger.error("Failed to get content generations:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: "Failed to retrieve content history" });
    }
  });

  // Delete a content generation
  app.delete('/api/content-generations/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const generationId = parseInt(req.params.id);
      if (isNaN(generationId)) {
        return res.status(400).json({ message: "Invalid generation ID" });
      }

      // Here you would typically verify the generation belongs to the user
      // and then delete it from the database
      // For now, just return success as the storage interface doesn't have delete method
      res.json({ success: true });
    } catch (error: unknown) {
      logger.error("Failed to delete content generation:", error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: "Failed to delete content generation" });
    }
  });

  // Lead API routes (waitlist functionality)
  app.post("/api/leads", createLead);
  app.get("/api/leads/confirm", confirmLead);
  app.get('/api/admin/leads', getLeads);

  // Compliance dashboard endpoint
  app.get('/api/admin/compliance', getComplianceStatus);

  // Reddit Communities Admin Routes (temporarily disabled for compilation)
  // TODO: Implement storage methods and re-enable routes

  // Debug endpoint for Reddit OAuth session
  app.get('/api/debug/reddit-session', (req, res) => {
    res.json({
      sessionID: req.sessionID,
      redditState: (req.session as SessionWithReddit).redditOAuthState,
      hasSession: !!req.session,
      cookies: req.headers.cookie,
      sessionData: req.session
    });
  });

  // ==========================================
  // PRODUCTION API ENDPOINTS - REAL IMPLEMENTATIONS
  // ==========================================

  // DISABLED - Using MediaManager endpoint from api-routes.ts instead
  // This endpoint was conflicting with the proper implementation that uses MediaManager
  /*
  app.get('/api/media', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const images = await storage.getUserImages(userId);
      res.json(images);
    } catch (error) {
      logger.error('Failed to fetch media:', error);
      res.status(500).json({ message: 'Failed to fetch media' });
    }
  });
  */

  // DISABLED - Using MediaManager endpoint from api-routes.ts instead
  // This endpoint was conflicting with the proper implementation that uses S3/database storage
  /*
  app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const imageData = await storage.createUserImage({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: buildUploadUrl(req.file.filename),
        size: req.file.size,
        mimeType: req.file.mimetype,
        isProtected: false,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      });

      res.json(imageData);
    } catch (error) {
      logger.error('Upload failed:', error);
      res.status(500).json({ message: 'Upload failed' });
    }
  });
  */

  // DISABLED - Using MediaManager endpoint from api-routes.ts instead
  /*
  app.delete('/api/media/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const imageId = parseInt(req.params.id);
      const userId = req.user.id;

      const image = await storage.getUserImage(imageId, userId);
      if (!image) {
        return res.status(404).json({ message: 'Image not found' });
      }

      const filePath = path.join(process.cwd(), 'uploads', image.filename);
      await fs.unlink(filePath).catch(() => {});

      await storage.deleteUserImage(imageId, userId);

      res.json({ success: true, message: 'Media deleted' });
    } catch (error) {
      logger.error('Failed to delete media:', error);
      res.status(500).json({ message: 'Failed to delete media' });
    }
  });
  */

  // Storage usage endpoint - REAL
  app.get('/api/storage/usage', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const userId = req.user.id;
      const images = await storage.getUserImages(userId);

      let totalBytes = 0;
      for (const image of images) {
        totalBytes += image.size || 0;
      }

      const userTier = req.user.tier || 'free';
      const quotaBytes = {
        free: 100 * 1024 * 1024,
        starter: 500 * 1024 * 1024,
        pro: 5 * 1024 * 1024 * 1024
      }[userTier] || 100 * 1024 * 1024;

      res.json({
        usedBytes: totalBytes,
        quotaBytes: quotaBytes,
        usedPercentage: Math.round((totalBytes / quotaBytes) * 100),
        assetsCount: images.length,
        proUpgrade: {
          quotaBytes: 5 * 1024 * 1024 * 1024,
          features: ['5GB storage', 'Unlimited uploads', 'Advanced protection']
        }
      });
    } catch (error) {
      logger.error('Failed to fetch storage usage:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to fetch storage usage' });
    }
  });

  // AI generation endpoint - REAL
  app.post('/api/ai/generate', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { prompt, platforms, styleHints, variants } = req.body;

      const results = await Promise.all(
        platforms.map(async (platform: string) => {
          const generated = await generateUnifiedAIContent({
            mode: 'text',
            prompt: prompt,
            platform: platform,
            style: styleHints?.[0] || 'authentic',
            theme: 'general',
            includePromotion: false,
            customInstructions: prompt
          });

          return {
            platform,
            titles: generated.titles,
            body: generated.content,
            photoInstructions: generated.photoInstructions,
            hashtags: generated.hashtags || [],
            style: styleHints?.[0] || 'authentic',
            confidence: 0.95
          };
        })
      );

      if (req.user?.id) {
        for (const result of results) {
          await storage.createContentGeneration({
            userId: req.user.id,
            platform: result.platform,
            style: result.style,
            theme: 'general',
            titles: result.titles,
            content: result.body,
            photoInstructions: result.photoInstructions,
            prompt: prompt
          });
        }
      }

      res.json({
        content: results,
        tokensUsed: results.length * 250,
        model: 'multi-provider',
        cached: false
      });
    } catch (error) {
      logger.error('AI generation failed:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Generation failed' });
    }
  });

  // Billing payment link endpoint - REAL
  app.post('/api/billing/payment-link', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { plan, provider = 'stripe' } = req.body;
      const engines = {
        stripe: makeStripe(),
        paxum: makePaxum(),
        coinbase: makeCoinbase(),
      } as const;
      const engine = engines[provider as keyof typeof engines];
      if (!engine || !engine.enabled) {
        return res.status(503).json({ message: 'Payment system not configured' });
      }
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { url } = await engine.createCheckout({
        userId: req.user.id.toString(),
        planId: plan,
        amountCents: 0,
        returnUrl: `${process.env.APP_BASE_URL}/dashboard`,
      });
      res.json({ paymentUrl: url });
    } catch (error) {
      logger.error('Failed to generate payment link:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to generate payment link' });
    }
  });

  // User settings endpoints - REAL
  app.get('/api/user/settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const preferences = await storage.getUserPreferences(req.user.id);

      res.json(preferences || {
        theme: 'light',
        notifications: true,
        emailUpdates: true,
        autoSave: true,
        defaultPlatform: 'reddit',
        defaultStyle: 'playful',
        watermarkPosition: 'bottom-right'
      });
    } catch (error) {
      logger.error('Failed to fetch settings:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.patch('/api/user/settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const updated = await storage.updateUserPreferences(req.user.id, req.body);
      res.json({ success: true, settings: updated });
  } catch (error) {
      logger.error('Failed to update settings:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Subscription status endpoint - REAL
  app.get('/api/subscription', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(req.user.id);

      if (!user?.stripeCustomerId || !stripe) {
        return res.json({
          subscription: null,
          isPro: false,
          tier: user?.tier || 'free'
        });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        if ('deleted' in sub && sub.deleted) {
          return res.json({
            subscription: null,
            isPro: false,
            tier: user.tier || 'free'
          });
        }
        const currentPeriodEnd = resolveBillingPeriodEnd(sub);
        const nextBillDate =
          typeof currentPeriodEnd === 'number'
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : currentPeriodEnd ?? null;

        return res.json({
          subscription: {
            id: sub.id,
            status: sub.status,
            plan: sub.metadata?.plan || user.tier,
            amount: sub.items.data[0].price.unit_amount,
            nextBillDate,
            createdAt: new Date(sub.created * 1000).toISOString()
          },
          isPro: ['pro', 'starter'].includes(user.tier || ''),
          tier: user.tier || 'free'
        });
      }

      res.json({
        subscription: null,
        isPro: false,
        tier: user.tier || 'free'
      });
    } catch (error) {
      logger.error('Failed to fetch subscription:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to fetch subscription' });
    }
  });

  // Social media quick post endpoint - REAL
  app.post('/api/social-media/quick-post', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { platform, content, accountId } = req.body as {
        platform?: string;
        content?: string;
        accountId?: number | string;
      };

      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Content is required to create a social media post.' });
      }

      const normalizedContent = content.trim();

      const userAccounts = await storage.getUserSocialMediaAccounts(req.user.id);
      const activeAccounts = userAccounts.filter(account => account.isActive);

      if (activeAccounts.length === 0) {
        return res.status(400).json({
          message: 'No connected social media accounts found. Please connect an account to continue.'
        });
      }

      const hasAccountId = accountId !== undefined && accountId !== null && `${accountId}`.length > 0;
      const parsedAccountId = typeof accountId === 'string' ? Number.parseInt(accountId, 10) : accountId;
      const normalizedAccountId =
        typeof parsedAccountId === 'number' && Number.isFinite(parsedAccountId) ? parsedAccountId : undefined;

      let selectedAccount = activeAccounts.find(account => (platform ? account.platform === platform : true));

      if (hasAccountId) {
        if (normalizedAccountId === undefined) {
          return res.status(400).json({ message: 'Invalid account ID provided.' });
        }

        selectedAccount = activeAccounts.find(account => account.id === normalizedAccountId);
      }

      if (!selectedAccount) {
        return res.status(400).json({ message: 'Unable to determine the social media account for this post.' });
      }

      if (platform && selectedAccount.platform !== platform) {
        return res.status(400).json({ message: 'Selected account does not match the requested platform.' });
      }

      const resolvedPlatform = selectedAccount.platform;

      const post = await storage.createSocialMediaPost({
        userId: req.user.id,
        platform: resolvedPlatform,
        content: normalizedContent,
        accountId: selectedAccount.id,
        status: 'draft'
      });

      res.json({
        success: true,
        postId: post.id,
        message: 'Content saved successfully'
      });
    } catch (error) {
      logger.error('Failed to post content:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to post content' });
    }
  });

  // Social media posts history - REAL
  app.get('/api/social-media/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const posts = await storage.getUserSocialMediaPosts(req.user.id, {
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        platform: req.query.platform as string,
        status: req.query.status as string
      });

      res.json(posts);
    } catch (error) {
      logger.error('Failed to fetch posts:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to fetch posts' });
    }
  });

  // Image protection endpoint
  app.post('/api/protect-image/:imageId', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const imageId = Number.parseInt(req.params.imageId, 10);
      if (Number.isNaN(imageId)) return res.status(400).json({ message: 'Invalid image id' });
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Authentication required' });
      const { protectionLevel } = req.body as { protectionLevel?: keyof typeof protectionPresets };
      const image = await storage.getUserImage(imageId, userId);
      if (!image) return res.status(404).json({ message: 'Image not found' });

      const level = protectionLevel && protectionPresets[protectionLevel] ? protectionLevel : 'standard';
      const inputPath = path.join(process.cwd(), image.url.startsWith('/') ? image.url.slice(1) : image.url);
      const protectedName = `protected_${Date.now()}_${image.filename}`;
      const outputPath = path.join(process.cwd(), 'uploads', protectedName);
      await applyImageShieldProtection(inputPath, outputPath, level as 'light' | 'standard' | 'heavy', false);
      const protectedUrl = buildUploadUrl(protectedName);
      await storage.updateUserImage(imageId, userId, { url: protectedUrl, isProtected: true, protectionLevel: level });

      res.json({ success: true, protectedUrl, message: 'Image protected successfully' });
    } catch (error: unknown) {
      logger.error('Failed to protect image:', error);
      if (options?.sentry) {
        options.sentry.captureException(error);
      }
      res.status(500).json({ message: 'Failed to protect image' });
    }
  });

  // Debug endpoint for environment variables
  app.get('/api/debug/env', (req, res) => {
    res.json({
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasAdminPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
      adminEmailLength: process.env.ADMIN_EMAIL?.length || 0,
      nodeEnv: process.env.NODE_ENV,
      // Don't send actual values for security!
    });
  });

  // ==========================================
  // ERROR HANDLER (MUST BE LAST)
  // ==========================================

  // Handle 404s for API routes specifically
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API endpoint not found: ${req.path}` });
  });

  // Apply error handling middleware last
  app.use(errorHandler);

  // Final catch-all for any remaining requests (ensures SPA routing works)
  app.get('*', (req, res, next) => {
    // Skip if it's an API, auth, webhook, or assets route
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/webhook/') || req.path.startsWith('/assets/')) {
      return next();
    }

    // For SPA, always serve index.html for non-asset requests
    import('url').then(({ fileURLToPath }) => {
      import('path').then((path) => {
        import('fs').then((fs) => {
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          const clientPath = path.join(__dirname, '..', 'client');

          if (fs.existsSync(path.join(clientPath, 'index.html'))) {
            res.sendFile(path.join(clientPath, 'index.html'));
          } else {
            res.status(404).send('Client build not found');
          }
        }).catch(next);
      }).catch(next);
    }).catch(next);
  });

  const httpServer = createServer(app);
  return httpServer;
}