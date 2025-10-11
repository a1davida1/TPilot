import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { db } from '../db.js';
import { feedback } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

const router = Router();

// Feedback submission schema
const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'general', 'praise']),
  message: z.string().min(1).max(1000),
  url: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * POST /api/feedback
 * Submit user feedback (bug report, feature request, etc)
 */
router.post('/', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const { type, message, url, userAgent } = feedbackSchema.parse(req.body);
    
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;
    const username = req.user?.username || 'Anonymous';
    
    // Store feedback in database
    const [newFeedback] = await db.insert(feedback).values({
      userId,
      type,
      message,
      pageUrl: url,
      userAgent,
      status: 'pending'
    }).returning({ id: feedback.id });
    
    logger.info('Feedback submitted', { 
      feedbackId: newFeedback.id, 
      type, 
      userId,
      url 
    });
    
    // For now, just log that feedback was received
    logger.info('New feedback received - email notification skipped', {
      feedbackId: newFeedback.id,
      type,
      username,
      adminEmail: process.env.ADMIN_EMAIL || 'not configured'
    });
    
    res.json({
      success: true,
      feedbackId: newFeedback.id,
      message: 'Thank you for your feedback! We\'ll review it shortly.'
    });
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid feedback data',
        details: error.errors
      });
    }
    
    logger.error('Failed to submit feedback', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      message: 'Please try again or email support@thottopilot.com'
    });
  }
});

/**
 * GET /api/feedback/my-feedback
 * Get user's submitted feedback
 */
router.get('/my-feedback', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userFeedback = await db
      .select({
        id: feedback.id,
        type: feedback.type,
        message: feedback.message,
        status: feedback.status,
        adminNotes: feedback.adminNotes,
        createdAt: feedback.createdAt,
        resolvedAt: feedback.resolvedAt
      })
      .from(feedback)
      .where(eq(feedback.userId, req.user.id))
      .orderBy(desc(feedback.createdAt))
      .limit(20);
    
    res.json({
      feedback: userFeedback,
      count: userFeedback.length
    });
    
  } catch (error: any) {
    logger.error('Failed to fetch user feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve feedback' });
  }
});

/**
 * GET /api/feedback/stats
 * Get feedback statistics (public)
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Get feedback counts by type
    const stats = await db
      .select({
        type: feedback.type,
        count: sql<number>`count(*)::int`,
        resolved: sql<number>`count(case when status = 'resolved' then 1 end)::int`
      })
      .from(feedback)
      .groupBy(feedback.type);
    
    // Get total counts
    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
        resolved: sql<number>`count(case when status = 'resolved' then 1 end)::int`,
        avgResponseTime: sql<number>`avg(extract(epoch from (resolved_at - created_at)))`
      })
      .from(feedback);
    
    res.json({
      byType: stats,
      totals: {
        ...totals,
        avgResponseTime: totals.avgResponseTime 
          ? Math.round(totals.avgResponseTime / 3600) + ' hours'
          : null
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Failed to fetch feedback stats', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * GET /api/feedback/admin
 * Admin: Get all feedback with filters
 */
router.get('/admin', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { 
      status = 'all',
      type = 'all',
      limit = 50,
      offset = 0
    } = req.query;
    
    // Build query conditions
    const conditions = [];
    if (status !== 'all') {
      conditions.push(eq(feedback.status, status as string));
    }
    if (type !== 'all') {
      conditions.push(eq(feedback.type, type as string));
    }
    
    const allFeedback = await db
      .select()
      .from(feedback)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(feedback.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));
    
    res.json({
      feedback: allFeedback,
      count: allFeedback.length,
      offset: Number(offset),
      limit: Number(limit)
    });
    
  } catch (error: any) {
    logger.error('Failed to fetch admin feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve feedback' });
  }
});

/**
 * PUT /api/feedback/:id/resolve
 * Admin: Mark feedback as resolved
 */
router.put('/:id/resolve', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const feedbackId = parseInt(req.params.id);
    const { adminNotes, priority } = req.body;
    
    const [updated] = await db
      .update(feedback)
      .set({
        status: 'resolved',
        adminNotes,
        priority,
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
        updatedAt: new Date()
      })
      .where(eq(feedback.id, feedbackId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    logger.info('Feedback resolved', { 
      feedbackId,
      resolvedBy: req.user.username 
    });
    
    res.json({
      success: true,
      feedback: updated
    });
    
  } catch (error: any) {
    logger.error('Failed to resolve feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
});

/**
 * DELETE /api/feedback/:id
 * Admin: Delete feedback
 */
router.delete('/:id', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const feedbackId = parseInt(req.params.id);
    
    const [deleted] = await db
      .delete(feedback)
      .where(eq(feedback.id, feedbackId))
      .returning({ id: feedback.id });
    
    if (!deleted) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    logger.info('Feedback deleted', { 
      feedbackId,
      deletedBy: req.user.username 
    });
    
    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
    
  } catch (error: any) {
    logger.error('Failed to delete feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

/**
 * GET /api/feedback/recent
 * Get recent feedback activity (for dashboard)
 */
router.get('/recent', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentFeedback = await db
      .select({
        id: feedback.id,
        type: feedback.type,
        message: sql<string>`left(message, 100)`,
        status: feedback.status,
        createdAt: feedback.createdAt
      })
      .from(feedback)
      .where(gte(feedback.createdAt, oneDayAgo))
      .orderBy(desc(feedback.createdAt))
      .limit(10);
    
    res.json({
      feedback: recentFeedback,
      count: recentFeedback.length,
      period: '24h'
    });
    
  } catch (error: any) {
    logger.error('Failed to fetch recent feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve recent feedback' });
  }
});

export { router as feedbackRouter };
