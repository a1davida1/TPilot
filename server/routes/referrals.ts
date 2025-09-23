import type { Express, Router } from 'express';
import { Router as createRouter } from 'express';
import { ReferralManager } from '../lib/referral-system.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';

export const referralRouter = createRouter();

// GET /api/referral/code - Get user's referral code
referralRouter.get('/code', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching referral code', { userId });
    
    const referralCode = await ReferralManager.getUserReferralCode(userId);
    
    logger.info('Referral code retrieved successfully', { userId, codeLength: referralCode.length });
    
    res.json({
      referralCode,
      referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${referralCode}`
    });

  } catch (error) {
    logger.error('Failed to get referral code', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve referral code' 
    });
  }
});

// GET /api/referral/summary - Get user's referral summary/stats
referralRouter.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching referral summary', { userId });
    
    const referralInfo = await ReferralManager.getReferralInfo(userId);
    
    logger.info('Referral summary retrieved successfully', { 
      userId, 
      totalReferrals: referralInfo.totalReferrals,
      totalCommission: referralInfo.totalCommission 
    });
    
    res.json(referralInfo);

  } catch (error) {
    logger.error('Failed to get referral summary', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      error: 'Failed to retrieve referral summary' 
    });
  }
});

// POST /api/referral/apply - Apply a referral code (for new user signups)
referralRouter.post('/apply', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { referralCode } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!referralCode || typeof referralCode !== 'string') {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    logger.info('Applying referral code', { userId, referralCode });
    
    const result = await ReferralManager.applyReferralCode(userId, referralCode);
    
    if (result.success) {
      logger.info('Referral code applied successfully', { 
        userId, 
        referralCode, 
        referrerId: result.referrerId 
      });
      
      res.json({ 
        success: true, 
        message: 'Referral code applied successfully',
        referrerId: result.referrerId 
      });
    } else {
      logger.warn('Failed to apply referral code', { 
        userId, 
        referralCode, 
        error: result.error 
      });
      
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Failed to apply referral code' 
      });
    }

  } catch (error) {
    logger.error('Error applying referral code', { 
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      referralCode: req.body?.referralCode 
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error while applying referral code' 
    });
  }
});

export default referralRouter;