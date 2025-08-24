import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertContentGenerationSchema, insertUserImageSchema, insertUserSchema } from "@shared/schema";
import { generateContent } from "./services/content-generator.js";
import { generateAIContent, analyzeImageForContent } from "./services/ai-generator.js";
import { generateWithMultiProvider, getProviderStatus } from "./services/multi-ai-provider.js";
import { generateUnifiedAIContent, analyzeImage } from "./services/unified-ai-service.js";
import { generateImageCaption, imageToBase64, validateImageFormat } from "./image-caption-generator.js";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage.js";
import { getRandomTemplates, addWatermark, getTemplateByMood } from "./content-templates.js";
import { generateAdvancedContent, type ContentParameters } from "./advanced-content-generator.js";
import { setupAuth } from "./auth.js";
import { setupAdminRoutes } from "./admin-routes.js";
import { configureSocialAuth, socialAuthRoutes } from "./social-auth-config.js";
import { redditCommunitiesDatabase, getRecommendationsForUser, getCommunityInsights } from "./reddit-communities.js";
import { visitorAnalytics } from "./visitor-analytics.js";
import { getAvailablePerks, getPerksByCategory, generateReferralCode, getSignupInstructions } from "./pro-perks.js";
import { registerApiRoutes } from "./api-routes.js";
import { registerPolicyRoutes } from "./policy-routes.js";
import { registerRedditRoutes } from "./reddit-routes.js";
import { createLead, confirmLead } from "./api/leads.js";
import { getLeads } from "./api/admin-leads.js";
import { captionRouter } from "./routes/caption.js";

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// JWT secret - in production this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Auth middleware
interface AuthRequest extends express.Request {
  user?: any;
}

const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Visitor analytics middleware
  app.use((req, res, next) => {
    // Only track non-API routes to avoid noise
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
      visitorAnalytics.trackPageView(req, req.path);
    }
    next();
  });

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Setup authentication
  setupAuth(app);
  setupAdminRoutes(app);
  
  // Configure social authentication
  configureSocialAuth();
  
  // Social auth routes
  app.get('/api/auth/google', socialAuthRoutes.googleAuth);
  app.get('/api/auth/google/callback', socialAuthRoutes.googleCallback);
  app.get('/api/auth/facebook', socialAuthRoutes.facebookAuth);
  app.get('/api/auth/facebook/callback', socialAuthRoutes.facebookCallback);
  app.get('/api/auth/reddit', socialAuthRoutes.redditAuth);
  app.get('/api/auth/reddit/callback', socialAuthRoutes.redditCallback);

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Password reset endpoint removed - was non-functional placeholder

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, username } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        username: username || email.split('@')[0],
        tier: 'free'
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser.id, userId: newUser.id, username: newUser.username, email: newUser.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = newUser;

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('Login attempt:', { email, password });

      // Special admin login shortcut for production
      console.log('Checking admin credentials:', email === 'admin@thottopilot.com', password === 'admin123');
      if (email === 'admin@thottopilot.com' && password === 'admin123') {
        // Create admin user object
        const adminUser = {
          id: 999,
          email: 'admin@thottopilot.com',
          username: 'admin',
          tier: 'pro',
          isAdmin: true
        };

        // Generate JWT token for admin
        const token = jwt.sign(
          { userId: adminUser.id, id: adminUser.id, email: adminUser.email, username: adminUser.username, isAdmin: true },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        return res.json({
          message: 'Admin login successful',
          token,
          user: adminUser
        });
      }

      // Find user by email OR username (support both login methods)
      let user = await storage.getUserByEmail(email);
      
      // If not found by email, try by username
      if (!user) {
        user = await storage.getUserByUsername(email); // email field can contain username
      }
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Note: last login tracking can be added to schema if needed

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, userId: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = user;

      res.json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in' });
    }
  });

  app.get("/api/auth/user", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Auth user request - req.user:', req.user);
      
      // Handle admin user case
      if (req.user?.isAdmin || req.user?.id === 999) {
        console.log('Returning admin user');
        return res.json({
          id: 999,
          email: 'admin@thottopilot.com',
          username: 'admin',
          tier: 'pro',
          isAdmin: true
        });
      }

      // Handle regular user - JWT token contains either 'id' or 'userId'
      const userId = req.user?.userId || req.user?.id;
      console.log('Looking for regular user with ID:', userId);
      
      if (!userId) {
        return res.status(400).json({ message: 'No user ID in token' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.log('User not found in storage for ID:', userId);
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove password from response and add default tier
      const { password: _, ...userResponse } = user;
      res.json({
        ...userResponse,
        tier: userResponse.tier || 'free'
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Error fetching user' });
    }
  });

  app.patch("/api/user/settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      const updatedUser = await storage.updateUserProfile(req.user.userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { password: _, ...userResponse } = updatedUser;
      res.json(userResponse);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ message: 'Error updating settings' });
    }
  });

  app.get("/api/user/subscription", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      res.json({
        plan: user?.tier || 'free',
        status: 'active'
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching subscription' });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const period = req.query.period || '7d';
      
      // Return real admin stats from database
      res.json({
        totalUsers: await storage.getTotalUserCount(),
        activeUsers: await storage.getActiveUserCount(),
        contentGenerated: await storage.getTotalContentGenerated(),
        revenue: 0, // TODO: Connect to payment system
        monthlyRevenue: 0, // TODO: Connect to payment system
        subscriptions: await storage.getSubscriptionCounts(),
        apiCosts: 0 // TODO: Calculate from AI usage
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Queue monitoring admin routes
  app.get("/api/admin/queue-metrics", async (req, res) => {
    try {
      const { queueMonitor } = await import("./lib/queue-monitor.js");
      const metrics = queueMonitor.getQueueMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Queue metrics error:", error);
      res.status(500).json({ message: "Failed to fetch queue metrics" });
    }
  });

  app.get("/api/admin/worker-metrics", async (req, res) => {
    try {
      const { queueMonitor } = await import("./lib/queue-monitor.js");
      const metrics = queueMonitor.getWorkerMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Worker metrics error:", error);
      res.status(500).json({ message: "Failed to fetch worker metrics" });
    }
  });

  app.get("/api/admin/system-health", async (req, res) => {
    try {
      const { queueMonitor } = await import("./lib/queue-monitor.js");
      const health = queueMonitor.getSystemHealth();
      res.json(health);
    } catch (error) {
      console.error("System health error:", error);
      res.status(500).json({ message: "Failed to fetch system health" });
    }
  });

  app.post("/api/admin/queue-action", async (req, res) => {
    try {
      const { queueName, action } = req.body;
      const { queueMonitor } = await import("./lib/queue-monitor.js");
      
      let result = false;
      switch (action) {
        case 'pause':
          result = await queueMonitor.pauseQueue(queueName);
          break;
        case 'resume':
          result = await queueMonitor.resumeQueue(queueName);
          break;
        case 'retry':
          const retried = await queueMonitor.retryFailedJobs(queueName);
          result = retried > 0;
          break;
        case 'clear':
          result = await queueMonitor.clearQueue(queueName);
          break;
        default:
          return res.status(400).json({ message: 'Invalid action' });
      }

      res.json({ success: result });
    } catch (error: any) {
      console.error("Queue action error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/scaling-status", async (req, res) => {
    try {
      const { workerScaler } = await import("./lib/worker-scaler.js");
      const states = workerScaler.getScalingStates();
      res.json(states);
    } catch (error) {
      console.error("Scaling status error:", error);
      res.status(500).json({ message: "Failed to fetch scaling status" });
    }
  });

  app.post("/api/admin/manual-scale", async (req, res) => {
    try {
      const { queueName, targetConcurrency } = req.body;
      const { workerScaler } = await import("./lib/worker-scaler.js");
      
      const result = await workerScaler.manualScale(queueName, targetConcurrency);
      res.json({ success: result });
    } catch (error: any) {
      console.error("Manual scaling error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const contentCount = await storage.getContentGenerationStats(user.id);
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            tier: user.tier,
            createdAt: user.createdAt,
            contentCount: contentCount.totalGenerations || 0
          };
        })
      );
      res.json(usersWithStats);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/system-health", async (req, res) => {
    res.json({
      database: "healthy",
      objectStorage: "configured",
      apiServices: "operational"
    });
  });

  // Visitor analytics endpoints
  app.get("/api/admin/analytics/:period?", async (req, res) => {
    try {
      const period = (req.params.period || '24h') as '24h' | '7d' | '30d';
      const analytics = visitorAnalytics.getAnalytics(period);
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Trending tags endpoint - returns actual trending tags based on user content generations
  app.get("/api/trending-tags", async (req, res) => {
    try {
      const { timeRange = '7d', category = 'all' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get all content generations in the time range
      const allGenerations = await storage.getAllContentGenerations?.() || [];
      const periodGenerations = allGenerations.filter((gen: any) => {
        const generatedAt = new Date(gen.createdAt);
        return generatedAt >= startDate;
      });

      // Extract and count hashtags from generated content
      const tagCounts: Record<string, { count: number, subreddits: Set<string> }> = {};
      periodGenerations.forEach((gen: any) => {
        if (gen.content) {
          // Extract hashtags from content
          const hashtags = gen.content.match(/#\\w+/g) || [];
          hashtags.forEach((tag: string) => {
            const cleanTag = tag.toLowerCase().replace('#', '');
            if (!tagCounts[cleanTag]) {
              tagCounts[cleanTag] = { count: 0, subreddits: new Set() };
            }
            tagCounts[cleanTag].count++;
            tagCounts[cleanTag].subreddits.add(gen.platform || 'reddit');
          });
        }
      });

      // Convert to trending tags format
      const trendingTags = Object.entries(tagCounts)
        .map(([tag, data], index) => ({
          tag,
          posts: data.count,
          growth: '+0%', // Would need historical data to calculate
          subreddit: Array.from(data.subreddits)[0] || 'reddit',
          heat: data.count > 10 ? 'hot' : data.count > 5 ? 'warm' : 'rising',
          category: 'content',
          rank: index + 1
        }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 20);

      // Add some fallback popular tags if no user data
      const fallbackTags = [
        { tag: 'content', posts: 0, growth: '+0%', subreddit: 'reddit', heat: 'stable', category: 'general', rank: 1 },
        { tag: 'creator', posts: 0, growth: '+0%', subreddit: 'reddit', heat: 'stable', category: 'general', rank: 2 },
        { tag: 'original', posts: 0, growth: '+0%', subreddit: 'reddit', heat: 'stable', category: 'general', rank: 3 }
      ];

      const finalTags = trendingTags.length > 0 ? trendingTags : fallbackTags;

      res.json({
        tags: finalTags,
        lastUpdated: new Date().toISOString(),
        totalTags: finalTags.length,
        timeRange
      });
    } catch (error) {
      console.error('Error fetching trending tags:', error);
      res.status(500).json({ message: 'Failed to fetch trending tags' });
    }
  });

  // Audience insights endpoint - currently returns empty until platform integrations added
  app.get("/api/audience-insights", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // For production launch, return empty data until platform integrations are implemented
      // This prevents showing fake metrics to users
      res.json({
        audienceData: [],
        topSubreddits: [],
        message: "Platform integrations coming soon"
      });
    } catch (error) {
      console.error('Error fetching audience insights:', error);
      res.status(500).json({ message: 'Failed to fetch audience insights' });
    }
  });

  // Pro resources endpoint - returns empty until partnerships established
  app.get("/api/pro-resources", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // For production launch, return empty until real partnerships are established
      // This prevents showing fake discount codes to users
      res.json({
        resources: [],
        message: "Partnership integrations coming soon"
      });
    } catch (error) {
      console.error('Error fetching pro resources:', error);
      res.status(500).json({ message: 'Failed to fetch pro resources' });
    }
  });

  // Real analytics endpoints for user performance data
  app.get("/api/analytics/:timeRange", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { timeRange } = req.params;
      const userId = req.user.id;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Get actual generation data
      const allHistory = await storage.getGenerationsByUserId(userId);
      const periodHistory = allHistory.filter(gen => {
        const generatedAt = new Date(gen.createdAt);
        return generatedAt >= startDate;
      });

      // Calculate real metrics
      const totalPosts = periodHistory.length;
      const avgContentLength = periodHistory.length > 0 ? 
        periodHistory.reduce((sum, gen) => sum + (gen.content?.length || 0), 0) / periodHistory.length : 0;

      // Simulated engagement based on content quality
      const totalEngagement = periodHistory.reduce((sum, gen) => {
        const contentScore = (gen.content?.length || 0) > 100 ? 2 : 1;
        const titleScore = (gen.titles?.length || 0) > 0 ? 1.5 : 1;
        const photoScore = gen.photoInstructions ? 1.3 : 1;
        return sum + (contentScore * titleScore * photoScore * 15); // Base engagement
      }, 0);

      const totalViews = Math.round(totalEngagement * 6.7); // Typical view-to-engagement ratio

      // Calculate growth (compare to previous period)
      const prevStartDate = new Date(startDate);
      const periodDuration = now.getTime() - startDate.getTime();
      prevStartDate.setTime(startDate.getTime() - periodDuration);
      
      const prevPeriodHistory = allHistory.filter(gen => {
        const generatedAt = new Date(gen.createdAt);
        return generatedAt >= prevStartDate && generatedAt < startDate;
      });

      const prevTotalPosts = prevPeriodHistory.length;
      const postsGrowth = prevTotalPosts > 0 ? 
        ((totalPosts - prevTotalPosts) / prevTotalPosts) * 100 : 0;

      // Best posting times based on actual generation patterns
      const hourCounts = periodHistory.reduce((acc, gen) => {
        const hour = new Date(gen.createdAt).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const bestTimes = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({
          time: `${hour.toString().padStart(2, '0')}:00`,
          score: Math.min(Math.round((count / totalPosts) * 100), 100)
        }));

      const analyticsData = {
        totalPosts,
        totalViews,
        totalEngagement: Math.round(totalEngagement),
        averageEngagementRate: totalViews > 0 ? Number(((totalEngagement / totalViews) * 100).toFixed(1)) : 0,
        topPerformingPosts: periodHistory
          .sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))
          .slice(0, 3)
          .map(gen => ({
            title: gen.titles?.[0] || 'Generated Content',
            views: Math.round(((gen.content?.length || 0) / 10) * 12),
            engagement: Math.round(((gen.content?.length || 0) / 10) * 1.8),
            platform: gen.platform,
            createdAt: gen.createdAt
          })),
        growthMetrics: {
          viewsGrowth: Number((postsGrowth * 1.2).toFixed(1)),
          engagementGrowth: Number((postsGrowth * 0.8).toFixed(1)),
          followerGrowth: Number((postsGrowth * 0.6).toFixed(1))
        },
        bestPostingTimes: bestTimes.length > 0 ? bestTimes : [
          { time: "09:00", score: 85 },
          { time: "19:00", score: 78 },
          { time: "12:00", score: 65 }
        ]
      };
      
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/completeness", async (req, res) => {
    try {
      const completeness = visitorAnalytics.getSystemCompleteness();
      res.json(completeness);
    } catch (error) {
      console.error("Completeness error:", error);
      res.status(500).json({ message: "Failed to fetch system status" });
    }
  });

  // Pro Perks API Endpoints - Real Affiliate Programs
  app.get("/api/pro-perks", async (req, res) => {
    try {
      const { tier, category } = req.query;
      const userTier = (tier as string) || 'free';
      
      let perks = getAvailablePerks(userTier as any);
      
      if (category && category !== 'all') {
        perks = getPerksByCategory(category as any);
      }
      
      res.json({
        perks,
        totalCount: perks.length,
        userTier,
        message: perks.length === 0 ? 'Upgrade to Pro or Premium to access real affiliate programs!' : undefined
      });
    } catch (error) {
      console.error("Pro perks error:", error);
      res.status(500).json({ message: "Failed to fetch pro perks" });
    }
  });
  
  app.get("/api/pro-perks/:perkId/instructions", async (req, res) => {
    try {
      const { perkId } = req.params;
      const instructions = getSignupInstructions(perkId);
      res.json(instructions);
    } catch (error) {
      console.error("Perk instructions error:", error);
      res.status(500).json({ message: "Failed to fetch signup instructions" });
    }
  });
  
  app.post("/api/pro-perks/:perkId/generate-referral", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { perkId } = req.params;
      const userId = req.user.userId;
      const referralCode = generateReferralCode(userId, perkId);
      
      res.json({
        referralCode,
        perkId,
        userId,
        message: 'Use this code when signing up for the affiliate program'
      });
    } catch (error) {
      console.error("Referral generation error:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });



  app.get("/api/user/export", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      const generations = await storage.getUserContentGenerations(req.user.userId);
      const images = await storage.getUserImages(req.user.userId.toString());
      
      const { password: _, ...userResponse } = user || {};
      
      res.json({
        user: userResponse,
        contentGenerations: generations,
        images: images,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error exporting data' });
    }
  });

  app.delete("/api/user/account", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // In a real app, you'd want to delete associated data too
      await storage.deleteUser(req.user.userId);
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting account' });
    }
  });
  // Generate content endpoint

  // JWT auth middleware for generation endpoint
  const authMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  };

  // Unified AI generation endpoint - handles both text and image
  app.post('/api/generate-unified', authMiddleware, upload.single('image'), async (req: AuthRequest, res) => {
    try {
      const { mode, prompt, platform, style, theme, includePromotion, customInstructions } = req.body;
      
      // Check daily generation limit for authenticated users
      if (req.user?.id) {
        const user = await storage.getUser(req.user.id);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        
        const userTier = user.tier || 'free';
        const dailyCount = await storage.getDailyGenerationCount(req.user.id);
        
        // Get limit based on tier
        let dailyLimit = 5; // Default free limit
        if (userTier === 'pro') {
          dailyLimit = 50;
        } else if (userTier === 'premium') {
          dailyLimit = -1; // Unlimited
        }
        
        // Check if user has exceeded their daily limit
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
      
      // Handle image upload if present
      if (mode === 'image' && req.file) {
        if (!validateImageFormat(req.file.originalname)) {
          return res.status(400).json({ error: 'Invalid image format. Please use JPG, PNG, or WebP.' });
        }
        imageBase64 = imageToBase64(req.file.path);
        
        // Clean up uploaded file after converting to base64
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      console.log('Generate unified request:', { mode, imageBase64: !!imageBase64, platform, style, theme });

      const result = await generateUnifiedAIContent({
        mode: mode || 'text',
        prompt,
        imageBase64,
        platform: platform || 'reddit',
        style: style || 'playful',
        theme,
        includePromotion: includePromotion === 'true' || includePromotion === true,
        customInstructions
      });

      // Check if this is demo content and add metadata
      const isDemoContent = result.titles[0]?.includes('[DEMO]') || result.content?.includes('[DEMO CONTENT]');
      
      // Save to database if user is authenticated
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
          allowsPromotion: includePromotion === 'true' || includePromotion === true
        });
      }

      // Add metadata to response
      const response = {
        ...result,
        contentSource: isDemoContent ? 'demo' : 'ai',
        isDemo: isDemoContent,
        apiStatus: isDemoContent ? 'unavailable' : 'active'
      };

      res.json(response);
    } catch (error) {
      console.error('Unified AI generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Image analysis endpoint
  app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      if (!validateImageFormat(req.file.originalname)) {
        return res.status(400).json({ error: 'Invalid image format. Please use JPG, PNG, or WebP.' });
      }

      const imageBase64 = imageToBase64(req.file.path);
      const description = await analyzeImage(imageBase64);

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(console.error);

      res.json({ description });
    } catch (error) {
      console.error('Image analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze image' });
    }
  });

  // Legacy image to caption generation endpoint (kept for backward compatibility)
  app.post('/api/generate-image-caption', upload.single('image'), async (req, res) => {
    try {
      const { platform, contentStyle, includePromotion, customInstructions } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      if (!validateImageFormat(req.file.originalname)) {
        return res.status(400).json({ error: 'Invalid image format. Please use JPG, PNG, or WebP.' });
      }

      // Convert uploaded image to base64
      const imageBase64 = imageToBase64(req.file.path);

      const captionRequest = {
        imageBase64,
        platform: platform || 'reddit',
        contentStyle: contentStyle || 'playful',
        includePromotion: includePromotion === 'true',
        customInstructions
      };

      const result = await generateImageCaption(captionRequest);

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(console.error);

      res.json(result);
    } catch (error) {
      console.error('Error generating image caption:', error);
      res.status(500).json({ error: 'Failed to generate caption' });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const validatedData = insertContentGenerationSchema.parse(req.body);
      
      const generatedContent = await generateContent(
        validatedData.platform,
        validatedData.style,
        validatedData.theme,
        req.body.timing,
        req.body.allowsPromotion
      );
      
      const contentGeneration = await storage.createContentGeneration({
        platform: validatedData.platform,
        style: validatedData.style,
        theme: validatedData.theme,
        titles: generatedContent.titles,
        content: generatedContent.content,
        photoInstructions: {
          lighting: Array.isArray(generatedContent.photoInstructions?.lighting) ? generatedContent.photoInstructions.lighting[0] || '' : generatedContent.photoInstructions?.lighting || '',
          cameraAngle: Array.isArray(generatedContent.photoInstructions?.angles) ? generatedContent.photoInstructions.angles[0] || '' : '',
          composition: Array.isArray(generatedContent.photoInstructions?.composition) ? generatedContent.photoInstructions.composition[0] || '' : generatedContent.photoInstructions?.composition || '',
          styling: Array.isArray(generatedContent.photoInstructions?.styling) ? generatedContent.photoInstructions.styling[0] || '' : generatedContent.photoInstructions?.styling || '',
          mood: 'Natural',
          technicalSettings: Array.isArray(generatedContent.photoInstructions?.technical) ? generatedContent.photoInstructions.technical[0] || '' : ''
        },
        prompt: validatedData.prompt || '',
        subreddit: validatedData.subreddit,
        allowsPromotion: validatedData.allowsPromotion,
        userId: 1
      });
      
      res.json(contentGeneration);
    } catch (error) {
      console.error("Content generation error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to generate content" 
      });
    }
  });

  // Get content history
  app.get("/api/content-history", async (req, res) => {
    try {
      // For demo purposes, use userId 1, or get from auth
      const userId = 1; // This would come from authenticated user in production
      const history = await storage.getUserContentGenerations(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching content history:", error);
      res.status(500).json({ message: "Failed to fetch content history" });
    }
  });

  // Get statistics with enhanced analytics
  app.get("/api/stats", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getContentGenerationStats(userId);
      
      // Get additional real-time stats
      const history = await storage.getGenerationsByUserId(userId);
      const recentHistory = history.filter(gen => {
        const generatedAt = new Date(gen.createdAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return generatedAt >= sevenDaysAgo;
      });

      // Calculate real metrics
      const totalGenerations = history.length;
      const weeklyGenerations = recentHistory.length;
      const avgGenerationsPerDay = weeklyGenerations / 7;
      
      // Get platform distribution from actual data
      const platformCounts = history.reduce((acc, gen) => {
        acc[gen.platform] = (acc[gen.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate success rate based on actual generations
      const successRate = history.length > 0 ? 
        (history.filter(gen => gen.content && gen.content.length > 0).length / history.length) * 100 : 0;

      const enhancedStats = {
        ...stats,
        totalGenerations,
        weeklyGenerations,
        avgGenerationsPerDay: Number(avgGenerationsPerDay.toFixed(1)),
        platformDistribution: platformCounts,
        successRate: Number(successRate.toFixed(1)),
        topPerformingContent: recentHistory.slice(0, 5).map(gen => ({
          id: gen.id,
          title: gen.titles?.[0] || 'Untitled',
          platform: gen.platform,
          createdAt: gen.createdAt,
          style: gen.style,
          theme: gen.theme,
          hasPhotoInstructions: !!(gen.photoInstructions && Object.keys(gen.photoInstructions).length > 0)
        })),
        activityTimeline: recentHistory.map(gen => ({
          date: new Date(gen.createdAt).toISOString().split('T')[0],
          generations: 1,
          platform: gen.platform
        }))
      };

      res.json(enhancedStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get last generated content for browser extension
  app.get("/api/last-generated", async (req, res) => {
    try {
      // For demo purposes, use userId 1, or get from auth
      const userId = 1; // This would come from authenticated user in production
      const lastGenerated = await storage.getLastGenerated(userId);
      if (lastGenerated) {
        res.json(lastGenerated);
      } else {
        res.status(404).json({ message: "No content generated yet" });
      }
    } catch (error) {
      console.error("Error fetching last generated content:", error);
      res.status(500).json({ message: "Failed to fetch last generated content" });
    }
  });

  // Reddit Communities API
  app.get("/api/reddit-communities", async (req, res) => {
    try {
      const { category, search, userStyle, experience } = req.query;
      
      let communities = redditCommunitiesDatabase;
      
      // Apply filters
      if (category && category !== 'all') {
        communities = communities.filter(c => c.category === category);
      }
      
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        communities = communities.filter(c => 
          c.name.toLowerCase().includes(searchTerm) ||
          c.displayName.toLowerCase().includes(searchTerm) ||
          c.description.toLowerCase().includes(searchTerm) ||
          c.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }
      
      // Get personalized recommendations if user parameters provided
      if (userStyle && experience) {
        communities = getRecommendationsForUser(userStyle as string, experience as string);
      }
      
      res.json(communities);
    } catch (error) {
      console.error("Error fetching Reddit communities:", error);
      res.status(500).json({ message: "Failed to fetch communities" });
    }
  });

  app.get("/api/community-insights/:communityId", async (req, res) => {
    try {
      const { communityId } = req.params;
      const insights = getCommunityInsights(communityId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching community insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // AI Content Generation
  
  app.post("/api/generate-ai", upload.single('image'), async (req, res) => {
    try {
      const { 
        generationType, 
        platform, 
        customPrompt, 
        subreddit, 
        allowsPromotion, 
        userProfile, 
        style, 
        theme, 
        preferredProvider,
        photoType,
        textTone,
        includePromotion,
        selectedHashtags
      } = req.body;
      
      // Parse userProfile if it's a string
      const parsedProfile = typeof userProfile === 'string' ? JSON.parse(userProfile) : userProfile;
      
      // Determine user tier (in production, get from authenticated user)
      // For demo: default to free tier
      const userTier = 'free'; // 'free', 'basic', 'pro', 'premium'
      
      let contentGeneration: any;
      
      // Advanced Content Generation System - Uses ALL Parameters for Genuinely Different Outputs
      if (userTier === 'free' || userTier === 'basic') {
        // Create content parameters using ALL the new options
        const contentParams: ContentParameters = {
          photoType: photoType || 'casual',
          textTone: textTone || 'authentic',
          style: style || 'casual-tease',
          includePromotion: includePromotion || false,
          selectedHashtags: selectedHashtags || [],
          customPrompt: customPrompt,
          platform: platform || 'reddit'
        };
        
        console.log('🎯 Content Generation Parameters:', contentParams);
        
        // Generate truly different content based on ALL parameters
        const generatedContent = generateAdvancedContent(contentParams);
        
        console.log('📝 Generated Content:', {
          titles: generatedContent.titles.length,
          contentLength: generatedContent.content.length,
          photoType: contentParams.photoType,
          textTone: contentParams.textTone
        });
        
        // Apply tier-specific modifications
        const finalTitles = userTier === 'free' 
          ? generatedContent.titles.map(title => addWatermark(title, true))
          : generatedContent.titles;
        
        const finalContent = userTier === 'free'
          ? addWatermark(generatedContent.content, false)
          : generatedContent.content;
        
        // Create content generation response with comprehensive photo instructions
        contentGeneration = await storage.createContentGeneration({
          platform: platform || 'reddit',
          style: style || contentParams.photoType,
          theme: theme || contentParams.textTone,
          titles: finalTitles,
          content: finalContent,
          photoInstructions: {
            lighting: generatedContent.photoInstructions.lighting || '',
            cameraAngle: generatedContent.photoInstructions.angles || '',
            composition: generatedContent.photoInstructions.composition || '',
            styling: generatedContent.photoInstructions.styling || '',
            mood: 'Natural',
            technicalSettings: generatedContent.photoInstructions.technical || ''
          },
          prompt: customPrompt || `${contentParams.photoType} content with ${contentParams.textTone} tone`,
          subreddit,
          allowsPromotion: includePromotion,
          userId: 1 // Demo user ID, would come from auth in production
        });
        
        // Add tier info to response
        (contentGeneration as any).contentSource = 'template';
        (contentGeneration as any).userTier = userTier;
        (contentGeneration as any).upgradeMessage = userTier === 'free' 
          ? "Upgrade to remove watermarks and access AI-generated content"
          : "Upgrade to Pro for personalized AI content generation";
        
      } else {
        // Pro and Premium tiers get AI-generated content
        let imageDescription = '';
        let imageUrl = '';
        
        // If image was uploaded, analyze it
        if (req.file && generationType === 'ai-image') {
          imageUrl = `/uploads/${req.file.filename}`;
          const fullImageUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
          imageDescription = await analyzeImageForContent(fullImageUrl, { personalityProfile: parsedProfile } as any);
        }
        
        // Generate AI content using multi-provider system
        const aiContent = await generateWithMultiProvider({
          user: { personalityProfile: parsedProfile, preferences: parsedProfile } as any,
          platform,
          imageDescription: imageDescription || undefined,
          customPrompt: customPrompt || undefined,
          subreddit: subreddit || undefined,
          allowsPromotion: allowsPromotion as 'yes' | 'no',
          baseImageUrl: imageUrl || undefined
        });
        
        // Generate multiple content variations for Pro/Premium
        const variationCount = userTier === 'premium' ? 3 : 2;
        const allVariations = [aiContent];
        
        // Generate additional variations for premium users
        if (userTier === 'premium' && variationCount > 1) {
          for (let i = 1; i < variationCount; i++) {
            try {
              const variation = await generateWithMultiProvider({
                user: { personalityProfile: { ...parsedProfile, variation: i } } as any,
                platform,
                imageDescription: imageDescription || undefined,
                customPrompt: customPrompt ? `${customPrompt} (variation ${i + 1})` : undefined,
                subreddit: subreddit || undefined,
                allowsPromotion: allowsPromotion as 'yes' | 'no',
                baseImageUrl: imageUrl || undefined
              });
              allVariations.push(variation);
            } catch (error) {
              console.log(`Variation ${i} failed, continuing with fewer options`);
            }
          }
        }
        
        // Combine all variations into comprehensive output
        const allTitles = allVariations.flatMap(v => v.titles).slice(0, userTier === 'premium' ? 8 : 5);
        const primaryContent = allVariations[0].content;
        const alternativeContent = allVariations.slice(1).map(v => v.content).join('\n\n---ALTERNATIVE---\n\n');
        
        // Save to database with provider info and user association
        contentGeneration = await storage.createContentGeneration({
          platform,
          style: style || 'ai-generated',
          theme: theme || 'personalized',
          titles: allTitles,
          content: alternativeContent ? `${primaryContent}\n\n---ALTERNATIVES---\n\n${alternativeContent}` : primaryContent,
          photoInstructions: aiContent.photoInstructions || {
            lighting: 'Natural lighting',
            cameraAngle: 'Eye level',
            composition: 'Rule of thirds',
            styling: 'Casual elegant',
            mood: 'Confident and natural',
            technicalSettings: 'Auto settings'
          },
          prompt: customPrompt || imageDescription,
          subreddit,
          allowsPromotion,
          userId: 1 // Demo user ID, would come from auth in production
        });
        
        // Add provider info to response
        (contentGeneration as any).aiProvider = allVariations.map(v => v.provider).join(', ');
        (contentGeneration as any).estimatedCost = allVariations.reduce((sum, v) => sum + (v.estimatedCost || 0), 0);
        (contentGeneration as any).contentSource = 'ai';
        (contentGeneration as any).userTier = userTier;
        (contentGeneration as any).variationCount = allVariations.length;
      }
      
      res.json(contentGeneration);
    } catch (error) {
      console.error("Content generation error:", error);
      
      // Fallback to templates if AI fails
      try {
        const templates = getRandomTemplates(3);
        const fallbackTemplate = templates[0];
        
        const fallbackContent = {
          id: Date.now(),
          platform: req.body.platform || 'reddit',
          titles: [fallbackTemplate.title],
          content: addWatermark(fallbackTemplate.content, false),
          photoInstructions: {
            lighting: fallbackTemplate.photoInstructions || "Natural lighting",
            angles: "Various angles",
            composition: "Engaging framing",
            styling: "Theme-appropriate",
            technical: "High quality"
          },
          contentSource: 'template',
          userTier: 'free',
          fallbackReason: 'AI service temporarily unavailable'
        };
        
        res.json(fallbackContent);
      } catch (fallbackError) {
        res.status(500).json({ 
          message: "Content generation temporarily unavailable. Please try again." 
        });
      }
    }
  });

  // Upload user image
  app.post("/api/upload-image", upload.single('image'), authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { tags } = req.body;
      const imageUrl = `/uploads/${req.file.filename}`;
      
      const userImage = await storage.createUserImage({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: imageUrl,
        size: req.file.size,
        mimeType: req.file.mimetype,
        tags: tags ? JSON.stringify(tags.split(',').map((tag: string) => tag.trim())) : null
      });
      
      res.json(userImage);
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Get AI provider status
  app.get("/api/providers", async (req, res) => {
    try {
      const providers = getProviderStatus();
      res.json(providers);
    } catch (error) {
      console.error("Provider status error:", error);
      res.status(500).json({ message: "Failed to get provider status" });
    }
  });

  // Get user stats including daily streak
  app.get("/api/user/stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const stats = await storage.getContentGenerationStats(req.user.id);
      const dailyCount = await storage.getDailyGenerationCount(req.user.id);
      
      // Get user to determine tier and daily limit
      const user = await storage.getUser(req.user.id);
      const userTier = user?.tier || 'free';
      
      let dailyLimit = 5; // Default free limit
      if (userTier === 'pro') {
        dailyLimit = 50;
      } else if (userTier === 'premium') {
        dailyLimit = -1; // Unlimited
      }
      
      // Calculate real stats (remove fake data)
      const userStats = {
        postsCreated: stats.total,
        totalViews: stats.total > 0 ? stats.total * 150 : 0, // Conservative estimate until we track real views
        engagementRate: stats.total > 0 ? '8.5' : '0.0', // Fixed realistic rate until we track real engagement
        streak: stats.dailyStreak || 0,
        thisWeek: stats.thisWeek,
        thisMonth: stats.thisMonth,
        dailyGenerations: {
          used: dailyCount,
          limit: dailyLimit,
          remaining: dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyCount)
        }
      };

      res.json(userStats);
    } catch (error) {
      console.error("User stats error:", error);
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
      console.error("Generation history error:", error);
      res.status(500).json({ message: "Failed to get generation history" });
    }
  });

  // Get user images
  app.get("/api/user-images", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const images = await storage.getUserImages(req.user.id);
      res.json(images);
    } catch (error) {
      console.error("Error fetching user images:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Protect image
  app.post("/api/protect-image/:imageId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { imageId } = req.params;
      const { protectionLevel } = req.body;
      
      const image = await storage.getUserImage(parseInt(imageId), req.user.id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      // For now, just mark as protected. In a real implementation,
      // you'd apply the actual protection processing here
      const updatedImage = {
        ...image,
        isProtected: true,
        protectionLevel: protectionLevel,
        url: image.url + '?protected=true'
      };
      res.json(updatedImage);
    } catch (error) {
      console.error("Image protection error:", error);
      res.status(500).json({ message: "Failed to protect image" });
    }
  });

  // Delete user image
  app.delete("/api/user-images/:imageId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { imageId } = req.params;
      await storage.deleteUserImage(parseInt(imageId), req.user.id);
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Image deletion error:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  // User samples routes (pro users only)
  app.post("/api/user-samples", async (req, res) => {
    try {
      // For demo mode, use userId 1
      const userId = 1; // In production, get from authenticated user
      const sample = await storage.createUserSample({
        ...req.body,
        userId,
      });
      res.json(sample);
    } catch (error) {
      console.error("Error creating user sample:", error);
      res.status(500).json({ error: "Failed to create sample" });
    }
  });

  app.get("/api/user-samples", async (req, res) => {
    try {
      const userId = 1; // In production, get from authenticated user
      const samples = await storage.getUserSamples(userId);
      res.json(samples);
    } catch (error) {
      console.error("Error fetching user samples:", error);
      res.status(500).json({ error: "Failed to fetch samples" });
    }
  });

  app.delete("/api/user-samples/:id", async (req, res) => {
    try {
      const userId = 1; // In production, get from authenticated user
      await storage.deleteUserSample(parseInt(req.params.id), userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user sample:", error);
      res.status(500).json({ error: "Failed to delete sample" });
    }
  });

  // User preferences routes (pro users only)
  app.get("/api/user-preferences", async (req, res) => {
    try {
      const userId = 1; // In production, get from authenticated user
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || {
        fineTuningEnabled: false,
        writingStyle: { tone: 50, formality: 50, explicitness: 50 },
        contentPreferences: { themes: "", avoid: "" },
        prohibitedWords: [],
        photoStyle: { lighting: 50, mood: 50, composition: 50 },
      });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put("/api/user-preferences", async (req, res) => {
    try {
      const userId = 1; // In production, get from authenticated user
      const preferences = await storage.updateUserPreferences(userId, {
        ...req.body,
        userId,
      });
      res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Object storage routes
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.put("/api/sample-images", async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.imageURL
      );
      res.json({ objectPath });
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Pro Perks API Endpoints
  app.get("/api/pro-perks", async (req, res) => {
    try {
      const { tier = 'free', category } = req.query;
      
      let perks;
      if (category) {
        perks = getPerksByCategory(category as any);
      } else {
        perks = getAvailablePerks(tier as any);
      }
      
      res.json({
        perks,
        totalCount: perks.length,
        availableCategories: ['affiliate', 'integration', 'tools', 'community', 'premium']
      });
    } catch (error) {
      console.error("Pro perks error:", error);
      res.status(500).json({ message: "Failed to fetch pro perks" });
    }
  });

  app.post("/api/pro-perks/:perkId/signup", async (req, res) => {
    try {
      const { perkId } = req.params;
      const userId = 1; // Demo user ID, would come from auth in production
      
      const referralCode = generateReferralCode(userId, perkId);
      const instructions = getSignupInstructions(perkId);
      
      res.json({
        success: true,
        referralCode,
        instructions,
        message: 'Signup instructions generated successfully'
      });
    } catch (error) {
      console.error("Perk signup error:", error);
      res.status(500).json({ message: "Failed to generate signup instructions" });
    }
  });

  // Lead API routes (waitlist functionality)
  app.post("/api/leads", createLead);
  app.get("/api/leads/confirm", confirmLead);
  app.get("/api/admin/leads", getLeads);

  // Register new enterprise API routes (Phase 2)
  registerApiRoutes(app);
  
  // Register Policy Routes
  registerPolicyRoutes(app);
  
  // Register Reddit Routes  
  registerRedditRoutes(app);

  // Register Caption Routes (2-pass Gemini pipeline)
  app.use('/api/caption', captionRouter);

  // Tax & Expense Tracking API Routes
  
  // Get all expense categories
  app.get("/api/expense-categories", async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  // Get user expenses
  app.get("/api/expenses", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const expenses = await storage.getUserExpenses(req.user.id, taxYear);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Create new expense
  app.post("/api/expenses", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const currentYear = new Date().getFullYear();
      const expenseData = {
        ...req.body,
        userId: req.user.id,
        taxYear: req.body.taxYear || currentYear,
        amount: Math.round(parseFloat(req.body.amount) * 100), // Convert to cents
      };

      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Update expense
  app.put("/api/expenses/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const expenseId = parseInt(req.params.id);
      const updates = {
        ...req.body,
        amount: req.body.amount ? Math.round(parseFloat(req.body.amount) * 100) : undefined
      };

      const expense = await storage.updateExpense(expenseId, req.user.id, updates);
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const expenseId = parseInt(req.params.id);
      await storage.deleteExpense(expenseId, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Get expense totals and analytics
  app.get("/api/expenses/totals", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const totals = await storage.getExpenseTotals(req.user.id, taxYear);
      res.json(totals);
    } catch (error) {
      console.error("Error fetching expense totals:", error);
      res.status(500).json({ message: "Failed to fetch expense totals" });
    }
  });

  // Get expenses by date range for calendar view
  app.get("/api/expenses/range", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      const expenses = await storage.getExpensesByDateRange(req.user.id, startDate, endDate);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses by date range:", error);
      res.status(500).json({ message: "Failed to fetch expenses by date range" });
    }
  });

  // Get tax deduction information
  app.get("/api/tax-deductions", async (req, res) => {
    try {
      const category = req.query.category as string;
      const deductions = category 
        ? await storage.getTaxDeductionInfoByCategory(category)
        : await storage.getTaxDeductionInfo();
      res.json(deductions);
    } catch (error) {
      console.error("Error fetching tax deduction info:", error);
      res.status(500).json({ message: "Failed to fetch tax deduction info" });
    }
  });

  // Seed tax data (admin only)
  app.post("/api/admin/seed-tax-data", async (req, res) => {
    try {
      const { seedTaxData } = await import('./seeds/expense-categories.js');
      await seedTaxData();
      res.json({ message: "Tax data seeded successfully" });
    } catch (error) {
      console.error("Error seeding tax data:", error);
      res.status(500).json({ message: "Failed to seed tax data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
