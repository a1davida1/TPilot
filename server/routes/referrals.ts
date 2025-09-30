import { Router as createRouter } from 'express';
import { z } from 'zod';
import { ReferralManager } from '../lib/referral-system.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';

export const referralRouter = createRouter();

const applyReferralSchema = z.object({
  referralCode: z
    .string({
      required_error: 'Referral code is required',
      invalid_type_error: 'Referral code must be a string',
    })
    .trim()
    .min(1, 'Referral code is required'),
  applicant: z
    .object({
      email: z
        .string({ required_error: 'Applicant email is required' })
        .trim()
        .min(1, 'Applicant email is required')
        .email('Applicant email is invalid')
        .transform((value) => value.toLowerCase()),
      temporaryUserId: z
        .string()
        .trim()
        .min(1, 'Temporary user ID cannot be empty')
        .optional(),
    }, { required_error: 'Applicant information is required' })
    .strict({ message: 'Applicant information is invalid' }),
});

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

  } catch (_error) {
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

  } catch (_error) {
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
referralRouter.post('/apply', async (req, res) => {
  try {
    const parseResult = applyReferralSchema.safeParse(req.body);
    if (!parseResult.success) {
      const [firstIssue] = parseResult.error.issues;
      const errorMessage = firstIssue?.message ?? 'Invalid referral request';
      logger.warn('Invalid referral apply payload', {
        error: errorMessage,
        issues: parseResult.error.issues,
      });
      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }

    const { referralCode, applicant } = parseResult.data;
    const normalizedCode = referralCode.toUpperCase();
    const sanitizedApplicant = {
      email: applicant.email,
      ...(applicant.temporaryUserId ? { temporaryUserId: applicant.temporaryUserId } : {}),
    };

    logger.info('Applying referral code', {
      referralCode: normalizedCode,
      applicant: {
        email: sanitizedApplicant.email,
        hasTemporaryId: Boolean(sanitizedApplicant.temporaryUserId),
      },
    });

    const result = await ReferralManager.applyReferralCode(sanitizedApplicant, normalizedCode);

    if (result.success) {
      const status = result.pending ? 'recorded' : 'linked';
      logger.info('Referral code processed', {
        referralCode: normalizedCode,
        referrerId: result.referrerId,
        status,
      });

      return res.json({
        success: true,
        status,
        referrerId: result.referrerId,
      });
    }

    logger.warn('Failed to apply referral code', {
      referralCode: normalizedCode,
      error: result.error,
    });

    return res.status(400).json({
      success: false,
      error: result.error || 'Failed to apply referral code',
    });

  } catch (_error) {
    logger.error('Error applying referral code', {
      error: error instanceof Error ? error.message : String(error),
      referralCode: req.body?.referralCode
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error while applying referral code' 
    });
  }
});

export default referralRouter;