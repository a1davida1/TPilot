import type { Express, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from 'express-session';
import path from 'path';
import connectPgSimple from 'connect-pg-simple';
import * as connectRedis from 'connect-redis';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Security and middleware
import { validateEnvironment, securityMiddleware, ipLoggingMiddleware, errorHandler, logger, generationLimiter } from "./middleware/security.js";
import { authenticateToken } from "./middleware/auth.js";

// Route modules
import { authRoutes } from "./routes/auth.js";
import { uploadRoutes } from "./routes/upload.js";
import { registerExpenseRoutes } from "./expense-routes.js";

// Core imports
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { setupAdminRoutes } from "./admin-routes.js";
import { configureSocialAuth, socialAuthRoutes } from "./social-auth-config.js";
import { visitorAnalytics } from "./visitor-analytics.js";
// Analytics request type
interface AnalyticsRequest extends express.Request {
  sessionID: string;
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
import { redditCommunitiesDatabase, getRecommendationsForUser, getCommunityInsights } from "./reddit-communities.js";
import { getAvailablePerks, getPerksByCategory, generateReferralCode, getSignupInstructions } from "./pro-perks.js";

// API route modules
import { registerApiRoutes } from "./api-routes.js";
import { registerPolicyRoutes } from "./policy-routes.js";
import { registerRedditRoutes } from "./reddit-routes.js";
import { registerAnalyticsRoutes } from "./analytics-routes.js";
import { createLead, confirmLead } from "./api/leads.js";
import { getLeads } from "./api/admin-leads.js";
import { captionRouter } from "./routes/caption.js";
import { registerSocialMediaRoutes } from "./social-media-routes.js";

// Schema imports
import { insertContentGenerationSchema, insertUserImageSchema } from "@shared/schema";

// Core dependencies
import multer from 'multer';
import fs from 'fs/promises';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Get secure environment variables (no fallbacks)
const SESSION_SECRET = process.env.SESSION_SECRET!;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

// Auth request interface
interface AuthRequest extends express.Request {
  user?: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
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
  
  // Apply security middleware
  app.use(securityMiddleware);
  
  // Apply IP logging middleware
  app.use(ipLoggingMiddleware);

  // Session configuration (MUST BE BEFORE AUTH ROUTES)
  let store: session.Store | undefined;

  if (IS_PRODUCTION) {
    if (REDIS_URL) {
      const RedisStore = (connectRedis as any)(session);
      const redisClient = new Redis(REDIS_URL);
      store = new RedisStore({ client: redisClient });
    } else if (DATABASE_URL) {
      const PgStore = connectPgSimple(session);
      store = new PgStore({
        pool: new Pool({ connectionString: DATABASE_URL })
      });
    } else {
      logger.warn('No REDIS_URL or DATABASE_URL set in production; using MemoryStore.');
    }
  }

  app.use(session({
    store,
    secret: SESSION_SECRET,
    resave: true, // Changed to true for OAuth state persistence
    saveUninitialized: true, // Required for OAuth flows
    cookie: {
      secure: false, // Always false for development OAuth to work
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // Allows OAuth redirects
    },
    name: 'thottopilot.sid', // Custom session name
    rolling: true // Refresh session on activity
  }));

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
  
  // Authentication routes
  // app.use('/api/auth', authRoutes); // COMMENTED OUT - Using setupAuth(app) instead to avoid conflicts
  
  // Upload routes
  app.use('/api/upload', uploadRoutes);
  
  // Social auth routes
  app.get('/api/auth/google', socialAuthRoutes.googleAuth);
  app.get('/api/auth/google/callback', socialAuthRoutes.googleCallback);
  app.get('/api/auth/facebook', socialAuthRoutes.facebookAuth);
  app.get('/api/auth/facebook/callback', socialAuthRoutes.facebookCallback);
  app.get('/api/auth/reddit', socialAuthRoutes.redditAuth);
  app.get('/api/auth/reddit/callback', socialAuthRoutes.redditCallback);

  // Serve uploaded files securely
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ==========================================
  // CONTENT GENERATION ENDPOINTS
  // ==========================================
  
  // Generate content with rate limiting
  app.post("/api/generate-content", generationLimiter, authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { platform, style, theme, timing, allowsPromotion } = req.body;
      const result = await generateContent(
        platform || 'reddit',
        style || 'playful',
        theme || 'lingerie',
        timing,
        allowsPromotion
      );
      
      // Save to database
      // Transform photoInstructions to match database schema
      const photoInstructions = {
        lighting: Array.isArray(result.photoInstructions.lighting) 
          ? result.photoInstructions.lighting[0] 
          : result.photoInstructions.lighting || 'Natural lighting',
        cameraAngle: Array.isArray(result.photoInstructions.angles) 
          ? result.photoInstructions.angles[0] 
          : (result.photoInstructions as any).cameraAngle || 'Eye level',
        composition: Array.isArray(result.photoInstructions.composition) 
          ? result.photoInstructions.composition[0] 
          : result.photoInstructions.composition || 'Center composition',
        styling: Array.isArray(result.photoInstructions.styling) 
          ? result.photoInstructions.styling[0] 
          : result.photoInstructions.styling || 'Casual styling',
        mood: (result.photoInstructions as any).mood || 'Confident and natural',
        technicalSettings: Array.isArray(result.photoInstructions.technical) 
          ? result.photoInstructions.technical[0] 
          : (result.photoInstructions as any).technicalSettings || 'Auto settings'
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
    } catch (error) {
      logger.error("Content generation error:", error);
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  // Get user stats
  // Debug endpoint for Reddit OAuth troubleshooting (temporary)
  app.get('/api/debug/session', (req: any, res) => {
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
      const todayGenerations = generations.filter(g => 
        g.createdAt && new Date(g.createdAt).toDateString() === today.toDateString()
      );
      
      const stats = {
        total: generations.length,
        today: todayGenerations.length,
        thisWeek: generations.filter(g => g.createdAt && 
          new Date(g.createdAt) > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        thisMonth: generations.filter(g => g.createdAt && 
          new Date(g.createdAt).getMonth() === today.getMonth() &&
          new Date(g.createdAt).getFullYear() === today.getFullYear()
        ).length,
        dailyStreak: 0 // Would need more complex logic to calculate
      };
      const user = await storage.getUser(req.user.id);
      const userTier = user?.tier || 'free';

      // Calculate daily generation limits based on tier
      let dailyLimit;
      if (userTier === 'free') {
        dailyLimit = 10;
      } else if (userTier === 'pro') {
        dailyLimit = 100;
      } else if (userTier === 'premium') {
        dailyLimit = -1; // Unlimited
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

  // Register Expense Routes (Tax Tracker API)
  registerExpenseRoutes(app);

  // Register Caption Routes (2-pass Gemini pipeline)
  app.use('/api/caption', captionRouter);

  // Lead API routes (waitlist functionality)
  app.post("/api/leads", createLead);
  app.get("/api/leads/confirm", confirmLead);
  app.get("/api/admin/leads", getLeads);

  // Debug endpoint for Reddit OAuth session
  app.get('/api/debug/reddit-session', (req, res) => {
    res.json({
      sessionID: req.sessionID,
      redditState: (req.session as any).redditOAuthState,
      hasSession: !!req.session,
      cookies: req.headers.cookie,
      sessionData: req.session
    });
  });

  // ==========================================
  // ERROR HANDLER (MUST BE LAST)
  // ==========================================
  
  // Apply error handling middleware last
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}