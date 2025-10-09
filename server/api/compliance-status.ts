
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../admin-routes.js';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
/**
 * Compliance telemetry endpoint for the admin dashboard.
 * Currently returns mocked data while the moderation ingestion pipeline is developed.
 * 
 * Backend teams should replace this with real Reddit moderation event data
 * when the pipeline is ready.
 */

export interface SubredditRemoval {
  id: string;
  removedAt: string;
  reason: string;
  actionTaken?: string;
}

export interface SubredditComplianceStatus {
  name: string;
  shadowbanned: boolean;
  verificationStatus: 'pending' | 'review' | 'verified';
  nextPostTime: string;
  recentRemovals: SubredditRemoval[];
}

/**
 * Builds a compliance snapshot for the dashboard.
 * This centralizes the telemetry structure so both frontend and backend
 * can reference the same data contract.
 */
function buildComplianceSnapshot(): SubredditComplianceStatus[] {
  return [
    {
      name: 'CreatorSupport',
      shadowbanned: false,
      verificationStatus: 'verified',
      nextPostTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      recentRemovals: [
        {
          id: 'CS-2051',
          removedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Automod: Affiliate link outside allowed domains',
          actionTaken: 'Auto-removed'
        },
        {
          id: 'CS-2049',
          removedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Manual: Low-effort promotion',
          actionTaken: 'Warning issued'
        }
      ]
    },
    {
      name: 'GrowthPlaybook', 
      shadowbanned: true,
      verificationStatus: 'review',
      nextPostTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      recentRemovals: [
        {
          id: 'GP-1189',
          removedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          reason: 'Manual: Moderator removal - off topic'
        },
        {
          id: 'GP-1187',
          removedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          reason: 'Automod: Prohibited service offering',
          actionTaken: 'Escalated to mods'
        }
      ]
    }
  ];
}

export async function getComplianceStatus(req: Request, res: Response) {
  try {
    // Future: Replace with real moderation data from the ingestion pipeline
    // const complianceData = await db
    //   .select()
    //   .from(moderationEvents)
    //   .orderBy(desc(moderationEvents.removedAt));

    const mockData = buildComplianceSnapshot();
    
    res.json({
      status: 'success',
      data: mockData,
      metadata: {
        lastUpdated: new Date().toISOString(),
        isLiveData: false, // Set to true when real pipeline is connected
        totalSubreddits: mockData.length
      }
    });
  } catch (error) {
    logger.error(...formatLogArgs('Compliance status error:', error));
    res.status(500).json({ 
      error: 'Failed to fetch compliance status',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}

export const complianceStatusRouter = Router();

complianceStatusRouter.get(
  '/',
  authenticateToken(true) as unknown as RequestHandler,
  requireAdmin as unknown as RequestHandler,
  getComplianceStatus
);
