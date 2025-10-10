import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { dashboardService } from '../services/dashboard-service';
import { logger } from '../bootstrap/logger';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for the authenticated user
 */
router.get('/stats', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const isAdmin = Boolean(req.user.isAdmin || req.user.role === 'admin');
    
    // Get stats based on user role
    const stats = isAdmin 
      ? await dashboardService.getAdminDashboardStats()
      : await dashboardService.getDashboardStats(req.user.id);

    logger.info(`Dashboard stats retrieved for user ${req.user.id}`, {
      userId: req.user.id,
      isAdmin,
      stats: {
        postsToday: stats.postsToday,
        engagementRate: stats.engagementRate,
        takedownsFound: stats.takedownsFound,
        estimatedTaxSavings: stats.estimatedTaxSavings,
      }
    });

    res.json(stats);
  } catch (error) {
    logger.error('Error retrieving dashboard stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    });
    
    res.status(500).json({ 
      message: 'Failed to retrieve dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

/**
 * GET /api/dashboard/activity  
 * Get recent activity/media for the authenticated user
 */
router.get('/activity', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const isAdmin = Boolean(req.user.isAdmin || req.user.role === 'admin');
    
    // Get activity based on user role
    const activity = isAdmin
      ? await dashboardService.getAdminDashboardActivity()
      : await dashboardService.getDashboardActivity(req.user.id);

    logger.info(`Dashboard activity retrieved for user ${req.user.id}`, {
      userId: req.user.id,
      isAdmin,
      mediaCount: activity.recentMedia.length,
    });

    res.json(activity);
  } catch (error) {
    logger.error('Error retrieving dashboard activity', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    });
    
    res.status(500).json({ 
      message: 'Failed to retrieve dashboard activity',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export { router as dashboardRouter };