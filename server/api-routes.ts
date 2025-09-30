import type { Express, Response } from "express";
import { db } from "./db.js";
import { storage } from "./storage.js";
import { AiService } from "./lib/ai-service.js";
import { generateEnhancedContent } from "./services/enhanced-ai-service.js";
import { AppError, CircuitBreaker } from "./lib/errors.js";
import { MediaManager } from "./lib/media.js";
import { CCBillProcessor } from "./lib/billing.js";
import { PolicyLinter } from "./lib/policyLinter.js";
import { PostScheduler } from "./lib/scheduling.js";
import { addJob, QUEUE_NAMES } from "./lib/queue/index.js";
import { getErrorMessage } from "./utils/error.js";
import { RedditManager } from "./lib/reddit.js";
import { postJobs, subscriptions, mediaAssets, creatorAccounts, users, userSamples } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import multer from "multer";
import type { Request, NextFunction } from 'express';
import { authenticateToken, type AuthRequest } from './middleware/auth.js';
import { z, ZodError } from "zod";
import { API_PREFIX } from './lib/api-prefix.js';
import { mountMetrics } from './observability/metrics.js';

type AiHistoryDependencies = {
  getUserHistory?: (userId: number, limit?: number) => Promise<unknown[]>;
};

export function createAiHistoryHandler(
  dependencies: AiHistoryDependencies = {}
) {
  const { getUserHistory = AiService.getUserHistory } = dependencies;

  return async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(500).json({ error: 'Authenticated user context missing' });
      }

      const limitQuery = Array.isArray(req.query.limit)
        ? req.query.limit[0]
        : req.query.limit;
      const parsedLimit = typeof limitQuery === 'string'
        ? Number.parseInt(limitQuery, 10)
        : undefined;
      const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0
        ? parsedLimit
        : 20;

      const history = await getUserHistory(userId, limit);
      res.json(history);
    } catch (error: unknown) {
      console.error('Failed to get AI history:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  };
}

interface PostingJobPayload {
  userId: number;
  postJobId: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal: string;
  mediaKey?: string;
}

// Create a proper User type alias from the schema
type UserType = typeof users.$inferSelect;

// Augment Express namespace to add user property
declare global {
  namespace Express {
    interface Request {
      user?: UserType;
    }
  }
}


// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export function registerApiRoutes(app: Express, apiPrefix: string = API_PREFIX) {

  mountMetrics(app, apiPrefix);

  const aiServiceBreaker = new CircuitBreaker(AiService.generateContent);
  const enhancedContentBreaker = new CircuitBreaker(generateEnhancedContent);

  // AI Content Generation
  app.post('/api/ai/generate', authenticateToken, async (req: Request, res, next: NextFunction) => {
    try {
      const schema = z.object({
        prompt: z.string().optional(),
        platforms: z.array(z.string()).min(1),
        styleHints: z.array(z.string()).optional(),
        variants: z.number().min(1).max(5).default(1),
      });
      const data: z.infer<typeof schema> = schema.parse(req.body);
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const result = await aiServiceBreaker.call({
        ...data,
        platforms: data.platforms || [],
        userId: req.user.id,
      });
      res.json(result);
    } catch (error: unknown) {
      // Handle Zod validation errors specifically
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error instanceof AppError ? error : new AppError('AI generation failed', 500));
    }
  });

  // Enhanced AI Content Generation
  app.post('/api/ai/enhanced', authenticateToken, async (req: Request, res, next: NextFunction) => {
    try {
      const schema = z.object({
        mode: z.enum(['text', 'image', 'hybrid']).default('text'),
        prompt: z.string().optional(),
        imageBase64: z.string().optional(),
        platform: z.enum(['reddit', 'twitter', 'instagram', 'tiktok', 'onlyfans']),
        style: z.enum(['playful', 'mysterious', 'bold', 'elegant', 'confident', 'authentic', 'sassy', 'professional']),
        theme: z.string().optional(),
        tone: z.enum(['casual', 'formal', 'flirty', 'friendly', 'provocative']).optional(),
        contentType: z.enum(['teasing', 'promotional', 'engagement', 'lifestyle', 'announcement', 'educational']).optional(),
        includePromotion: z.boolean().optional(),
        promotionLevel: z.enum(['none', 'subtle', 'moderate', 'direct']).optional(),
        targetAudience: z.enum(['general', 'fans', 'potential-subscribers', 'pro-tier']).optional(),
        customInstructions: z.string().optional(),
        subreddit: z.string().optional(),
        niche: z.string().optional(),
        personalBrand: z.string().optional(),
      });
      const data: z.infer<typeof schema> = schema.parse(req.body);
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const result = await enhancedContentBreaker.call({
        ...data,
        mode: data.mode || 'text',
        platform: data.platform || 'reddit',
        style: data.style || 'authentic',
        userId: String(req.user.id),
      });
      res.json(result);
    } catch (error: unknown) {
      // Handle Zod validation errors specifically
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error instanceof AppError ? error : new AppError('Enhanced AI generation failed', 500));
    }
  });

  // Media Upload
  app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req: Request, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const applyWatermark = req.body.watermark === 'true';

      const result = await MediaManager.uploadFile(req.file.buffer, {
        userId,
        filename: req.file.originalname,
        visibility: 'private',
        applyWatermark,
      });

      res.json(result);
    } catch (error: unknown) {
      console.error('Media upload failed:', error);
      const message = error instanceof Error ? (error as Error).message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // Get User Media
  app.get('/api/media', authenticateToken, async (req: Request, res) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const assets = await MediaManager.getUserAssets(userId, limit);
      res.json(assets);
    } catch (error: unknown) {
      console.error('Failed to get media:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Delete Media
  app.delete('/api/media/:id', authenticateToken, async (req: Request, res) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;
      const mediaId = parseInt(req.params.id);

      const success = await MediaManager.deleteAsset(mediaId, userId);

      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Media not found' });
      }
    } catch (error: unknown) {
      console.error('Failed to delete media:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Policy Linting
  app.post('/api/content/lint', async (req, res) => {
    try {
      const schema = z.object({
        subreddit: z.string(),
        title: z.string(),
        body: z.string(),
        hasImage: z.boolean().default(false),
      });

      const data = schema.parse(req.body);
      const linter = await PolicyLinter.forSubreddit(data.subreddit);
      const result = await linter.lintPost(data.title, data.body, data.hasImage);

      res.json(result);
    } catch (error: unknown) {
      console.error('Content linting failed:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Schedule Post
  app.post('/api/posts/schedule', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        subreddit: z.string(),
        title: z.string(),
        body: z.string(),
        mediaKey: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
      });

      const data = schema.parse(req.body);
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;

      // Schedule the post
      const scheduledAt = data.scheduledAt 
        ? new Date(data.scheduledAt)
        : await PostScheduler.chooseSendTime(data.subreddit);

      // Create post job
      const [postJob] = await db.insert(postJobs).values({
        userId,
        subreddit: data.subreddit,
        titleFinal: data.title,
        bodyFinal: data.body,
        mediaKey: data.mediaKey,
        scheduledAt,
      }).returning();

      // Add to queue
      const delayUntilSend = Math.max(0, scheduledAt.getTime() - Date.now());

      await addJob<PostingJobPayload>(QUEUE_NAMES.POST, {
        userId,
        postJobId: postJob.id,
        subreddit: data.subreddit,
        titleFinal: data.title,
        bodyFinal: data.body,
        mediaKey: data.mediaKey,
      }, {
        delay: delayUntilSend,
      });

      res.json({ 
        success: true, 
        postJobId: postJob.id,
        scheduledAt: scheduledAt.toISOString(),
      });
    } catch (error: unknown) {
      console.error('Failed to schedule post:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Get Scheduled Posts
  app.get('/api/posts/scheduled', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const jobs = await db
        .select()
        .from(postJobs)
        .where(eq(postJobs.userId, userId))
        .orderBy(desc(postJobs.scheduledAt))
        .limit(50);

      res.json(jobs);
    } catch (error: unknown) {
      console.error('Failed to get scheduled posts:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Billing - Generate Payment Link
  app.post('/api/billing/payment-link', async (req, res) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;
      const plan = req.body.plan || 'pro';

      const formData = CCBillProcessor.generateFormData(userId, plan);
      const paymentUrl = CCBillProcessor.generateFormUrl(formData);

      res.json({ 
        paymentUrl,
        formData: {
          plan,
          price: formData.formPrice,
          period: formData.formPeriod,
        }
      });
    } catch (error: unknown) {
      console.error('Failed to generate payment link:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Billing - Webhook
  app.post('/api/billing/webhook', async (req, res) => {
    try {
      const result = await CCBillProcessor.handleWebhook(req.body);

      if (result.success) {
        res.status(200).json({ message: 'Webhook processed' });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: unknown) {
      console.error('Webhook processing failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get User Subscription
  app.get('/api/subscription', authenticateToken, async (req: Request, res) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;

      // Check if user is admin first - only check verified admin status
      if (user.isAdmin || user.tier === 'admin' || user.role === 'admin') {
        return res.json({
          subscription: { plan: 'admin' },
          isPro: true,
          tier: 'admin',
        });
      }

      const subscription = await CCBillProcessor.getUserSubscription(userId);
      const isPro = await CCBillProcessor.isUserPro(userId);

      res.json({ 
        subscription,
        isPro,
        tier: isPro ? 'pro' : 'free',
      });
    } catch (error: unknown) {
      console.error('Failed to get subscription:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Storage Usage
  app.get('/api/storage/usage', authenticateToken, async (req: Request, res) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = user.id;

      const usage = await MediaManager.getUserStorageUsage(userId);
      res.json(usage);
    } catch (error: unknown) {
      console.error('Failed to get storage usage:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // User profile preferences
  app.get('/api/user/profile', authenticateToken, async (req: Request, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const prefs = await storage.getUserPreferences(req.user.id);
    res.json(prefs?.contentPreferences || {});
  });

  app.put('/api/user/profile', authenticateToken, async (req: Request, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const preferenceSchema = z.object({
      contentPreferences: z.object({
        toneOfVoice: z.string().optional(),
        contentStyle: z.string().optional(),
        personalBrand: z.string().optional(),
        contentLength: z.string().optional(),
        includeEmojis: z.boolean().optional(),
        promotionLevel: z.string().optional()
      })
    });
    const body = preferenceSchema.parse({
      contentPreferences: {
        toneOfVoice: req.body.toneOfVoice,
        contentStyle: req.body.contentStyle,
        personalBrand: req.body.personalBrand,
        contentLength: req.body.contentLength,
        includeEmojis: req.body.includeEmojis,
        promotionLevel: req.body.promotionLevel
      }
    });
    await storage.updateUserPreferences(req.user.id, { userId: req.user.id, ...body });
    res.json(req.body);
  });

  // AI Generation History
  app.get('/api/ai/history', authenticateToken, createAiHistoryHandler());

}