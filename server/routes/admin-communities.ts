import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { listCommunities, createCommunity, updateCommunity, deleteCommunity, type NormalizedRedditCommunity } from '../reddit-communities.js';
import { insertRedditCommunitySchema, type User } from '@shared/schema';

const router = express.Router();

// Auth request interface
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

// Admin role check middleware
function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Apply authentication and admin checks to all routes
router.use(authenticateToken as express.RequestHandler);
router.use(requireAdmin as express.RequestHandler);

// GET /api/admin/communities - List all communities
router.get('/', async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const communities = await listCommunities();
    
    // Shape response to match AdminCommunity contract
    const adminCommunities = communities.map((community: NormalizedRedditCommunity) => ({
      id: community.id,
      name: community.name,
      displayName: community.displayName,
      description: community.description,
      category: community.category,
      members: community.members,
      verificationRequired: community.verificationRequired,
      promotionAllowed: community.promotionAllowed,
      rules: community.rules, // Already normalized RedditCommunityRuleSet
      engagementRate: community.engagementRate,
      postingLimits: community.postingLimits,
      averageUpvotes: community.averageUpvotes,
      modActivity: community.modActivity,
      tags: community.tags,
      successProbability: community.successProbability,
      competitionLevel: community.competitionLevel,
      growthTrend: community.growthTrend,
      bestPostingTimes: community.bestPostingTimes
    }));

    res.json({
      success: true,
      data: adminCommunities
    });
  } catch (error) {
    console.error('Failed to list communities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load communities'
    });
  }
});

// POST /api/admin/communities - Create new community
router.post('/', async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    // Validate request body with Zod schema
    const validatedData = insertRedditCommunitySchema.parse(req.body);
    const community = await createCommunity(validatedData);
    
    const adminCommunity = {
      id: community.id,
      name: community.name,
      displayName: community.displayName,
      description: community.description,
      category: community.category,
      members: community.members,
      verificationRequired: community.verificationRequired,
      promotionAllowed: community.promotionAllowed,
      rules: community.rules, // Already normalized RedditCommunityRuleSet
      engagementRate: community.engagementRate,
      postingLimits: community.postingLimits,
      averageUpvotes: community.averageUpvotes,
      modActivity: community.modActivity,
      tags: community.tags,
      successProbability: community.successProbability,
      competitionLevel: community.competitionLevel,
      growthTrend: community.growthTrend,
      bestPostingTimes: community.bestPostingTimes
    };

    res.status(201).json({
      success: true,
      data: adminCommunity
    });
  } catch (error) {
    console.error('Failed to create community:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create community'
    });
  }
});

// PUT /api/admin/communities/:id - Update community
router.put('/:id', async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    // Validate request body with partial Zod schema
    const validatedData = insertRedditCommunitySchema.partial().parse(req.body);
    const community = await updateCommunity(id, validatedData);
    
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }
    
    const adminCommunity = {
      id: community.id,
      name: community.name,
      displayName: community.displayName,
      description: community.description,
      category: community.category,
      members: community.members,
      verificationRequired: community.verificationRequired,
      promotionAllowed: community.promotionAllowed,
      rules: community.rules, // Already normalized RedditCommunityRuleSet
      engagementRate: community.engagementRate,
      postingLimits: community.postingLimits,
      averageUpvotes: community.averageUpvotes,
      modActivity: community.modActivity,
      tags: community.tags,
      successProbability: community.successProbability,
      competitionLevel: community.competitionLevel,
      growthTrend: community.growthTrend,
      bestPostingTimes: community.bestPostingTimes
    };

    res.json({
      success: true,
      data: adminCommunity
    });
  } catch (error) {
    console.error('Failed to update community:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update community'
    });
  }
});

// DELETE /api/admin/communities/:id - Delete community
router.delete('/:id', async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    
    // Check if community exists before deletion
    const communities = await listCommunities();
    const existingCommunity = communities.find(c => c.id === id);
    
    if (!existingCommunity) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }
    
    await deleteCommunity(id);
    
    res.json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete community'
    });
  }
});

export { router as adminCommunitiesRouter };