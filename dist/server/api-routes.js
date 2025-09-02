import { z } from "zod";
import { db } from "./db.js";
import { AiService } from "./lib/ai-service.js";
import { generateEnhancedContent } from "./services/enhanced-ai-service.js";
import { MediaManager } from "./lib/media.js";
import { CCBillProcessor } from "./lib/billing.js";
import { PolicyLinter } from "./lib/policyLinter.js";
import { PostScheduler } from "./lib/scheduling.js";
import { addJob } from "./lib/queue/index.js";
import { RedditManager } from "./lib/reddit.js";
import { postJobs, creatorAccounts, users } from "@shared/schema.js";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Fetch the full user object from database
        const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};
// Multer configuration for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});
export function registerApiRoutes(app) {
    // AI Content Generation
    app.post('/api/ai/generate', authenticateToken, async (req, res) => {
        try {
            const schema = z.object({
                prompt: z.string().optional(),
                platforms: z.array(z.string()).min(1),
                styleHints: z.array(z.string()).optional(),
                variants: z.number().min(1).max(5).default(1),
            });
            const data = schema.parse(req.body);
            if (!req.user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const result = await AiService.generateContent({
                userId: req.user.id,
                ...data,
            });
            res.json(result);
        }
        catch (error) {
            console.error('AI generation failed:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Enhanced AI Content Generation
    app.post('/api/ai/enhanced', authenticateToken, async (req, res) => {
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
                targetAudience: z.enum(['general', 'fans', 'potential-subscribers', 'premium-tier']).optional(),
                customInstructions: z.string().optional(),
                subreddit: z.string().optional(),
                niche: z.string().optional(),
                personalBrand: z.string().optional(),
            });
            const data = schema.parse(req.body);
            if (!req.user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const result = await generateEnhancedContent({
                ...data,
                userId: String(req.user.id),
            });
            res.json(result);
        }
        catch (error) {
            console.error('Enhanced AI generation failed:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Media Upload
    app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
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
        }
        catch (error) {
            console.error('Media upload failed:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Get User Media
    app.get('/api/media', authenticateToken, async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const limit = parseInt(req.query.limit) || 20;
            const assets = await MediaManager.getUserAssets(userId, limit);
            res.json(assets);
        }
        catch (error) {
            console.error('Failed to get media:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Delete Media
    app.delete('/api/media/:id', authenticateToken, async (req, res) => {
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
            }
            else {
                res.status(404).json({ error: 'Media not found' });
            }
        }
        catch (error) {
            console.error('Failed to delete media:', error);
            res.status(500).json({ error: error.message });
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
        }
        catch (error) {
            console.error('Content linting failed:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Schedule Post
    app.post('/api/posts/schedule', async (req, res) => {
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
            await addJob('posting', {
                userId,
                postJobId: postJob.id,
                subreddit: data.subreddit,
                titleFinal: data.title,
                bodyFinal: data.body,
                mediaKey: data.mediaKey,
            }, {
                delay: scheduledAt.getTime() - Date.now(),
            });
            res.json({
                success: true,
                postJobId: postJob.id,
                scheduledAt: scheduledAt.toISOString(),
            });
        }
        catch (error) {
            console.error('Failed to schedule post:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Get Scheduled Posts
    app.get('/api/posts/scheduled', async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const jobs = await db
                .select()
                .from(postJobs)
                .where(eq(postJobs.userId, userId))
                .orderBy(desc(postJobs.scheduledAt))
                .limit(50);
            res.json(jobs);
        }
        catch (error) {
            console.error('Failed to get scheduled posts:', error);
            res.status(500).json({ error: error.message });
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
        }
        catch (error) {
            console.error('Failed to generate payment link:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Billing - Webhook
    app.post('/api/billing/webhook', async (req, res) => {
        try {
            const result = await CCBillProcessor.handleWebhook(req.body);
            if (result.success) {
                res.status(200).json({ message: 'Webhook processed' });
            }
            else {
                res.status(400).json({ error: result.message });
            }
        }
        catch (error) {
            console.error('Webhook processing failed:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // Get User Subscription
    app.get('/api/subscription', authenticateToken, async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            // Check if user is admin first
            if (user.isAdmin || userId === 999 || user.tier === 'admin') {
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
        }
        catch (error) {
            console.error('Failed to get subscription:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Reddit Account Management
    app.get('/api/reddit/accounts', authenticateToken, async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const accounts = await db
                .select()
                .from(creatorAccounts)
                .where(eq(creatorAccounts.userId, userId));
            res.json(accounts.map(acc => ({
                id: acc.id,
                platform: acc.platform,
                handle: acc.handle,
                status: acc.status,
                createdAt: acc.createdAt,
            })));
        }
        catch (error) {
            console.error('Failed to get Reddit accounts:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Reddit Account Info
    app.get('/api/reddit/account/:accountId/info', async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const accountId = parseInt(req.params.accountId);
            const [account] = await db
                .select()
                .from(creatorAccounts)
                .where(eq(creatorAccounts.id, accountId))
                .limit(1);
            if (!account || account.userId !== userId) {
                return res.status(404).json({ error: 'Account not found' });
            }
            const reddit = new RedditManager(account.oauthToken, account.oauthRefresh, userId);
            const info = await reddit.getProfile();
            res.json(info);
        }
        catch (error) {
            console.error('Failed to get account info:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Storage Usage
    app.get('/api/storage/usage', authenticateToken, async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const usage = await MediaManager.getUserStorageUsage(userId);
            res.json(usage);
        }
        catch (error) {
            console.error('Failed to get storage usage:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // AI Generation History
    app.get('/api/ai/history', async (req, res) => {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const userId = user.id;
            const limit = parseInt(req.query.limit) || 20;
            const history = await AiService.getUserHistory(userId, limit);
            res.json(history);
        }
        catch (error) {
            console.error('Failed to get AI history:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
