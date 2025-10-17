/**
 * Content Suggestions API
 * AI-powered content recommendations based on user's top posts
 */

import { Router } from 'express';
import { authenticateToken as requireAuth } from '../middleware/auth.js';
import {
  generateContentSuggestions,
  getTopPerformingPosts,
  analyzeContentPatterns
} from '../lib/ai-content-advisor.js';
import { logger } from '../bootstrap/logger.js';
import { z } from 'zod';

const router = Router();

// Request validation
const contentSuggestionsSchema = z.object({
  subreddit: z.string().min(1).max(100),
  userId: z.coerce.number().optional()
});

const topPostsSchema = z.object({
  subreddit: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).optional()
});

/**
 * POST /api/intelligence/suggest-content
 * 
 * Generate AI-powered content suggestions
 * 
 * Body:
 * - subreddit: string (required)
 * - userId: number (optional, defaults to authenticated user)
 * 
 * Returns:
 * - titleSuggestions: AI-generated title ideas
 * - themeRecommendations: What's working for the user
 * - styleTips: Actionable advice
 * - optimalPosting: When to post next
 * - patterns: Analyzed patterns from top posts
 */
router.post('/suggest-content', requireAuth, async (req, res) => {
  try {
    const validation = contentSuggestionsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { subreddit } = validation.data;
    const userId = validation.data.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required'
      });
    }

    logger.info('Generating content suggestions', { userId, subreddit });

    const suggestions = await generateContentSuggestions(userId, subreddit);

    return res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    logger.error('Failed to generate content suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      body: req.body
    });

    return res.status(500).json({
      error: 'Failed to generate suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/intelligence/top-posts
 * 
 * Get user's top performing posts
 * 
 * Query params:
 * - subreddit: string (required)
 * - limit: number (optional, default 10, max 50)
 * 
 * Returns:
 * - posts: Array of top posts with metrics
 */
router.get('/top-posts', requireAuth, async (req, res) => {
  try {
    const validation = topPostsSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { subreddit, limit = 10 } = validation.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const posts = await getTopPerformingPosts(userId, subreddit, limit);

    return res.json({
      success: true,
      count: posts.length,
      data: posts
    });

  } catch (error) {
    logger.error('Failed to fetch top posts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to fetch top posts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/intelligence/content-patterns
 * 
 * Analyze content patterns from user's posts
 * 
 * Query params:
 * - subreddit: string (required)
 * 
 * Returns:
 * - patterns: Analyzed patterns (common words, emojis, best times, etc.)
 */
router.get('/content-patterns', requireAuth, async (req, res) => {
  try {
    const { subreddit } = req.query;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const posts = await getTopPerformingPosts(userId, subreddit, 20);
    const patterns = analyzeContentPatterns(posts);

    return res.json({
      success: true,
      sampleSize: posts.length,
      data: patterns
    });

  } catch (error) {
    logger.error('Failed to analyze content patterns', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to analyze patterns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/intelligence/suggest-titles
 * 
 * Generate AI title suggestions quickly (without full analysis)
 * 
 * Body:
 * - subreddit: string (required)
 * - context: string (optional, additional context)
 * - count: number (optional, default 5, max 10)
 * 
 * Returns:
 * - suggestions: Array of title suggestions
 */
router.post('/suggest-titles', requireAuth, async (req, res) => {
  try {
    const { subreddit, count = 5 } = req.body;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    if (count < 1 || count > 10) {
      return res.status(400).json({
        error: 'Count must be between 1 and 10'
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Get quick analysis
    const posts = await getTopPerformingPosts(userId, subreddit, 10);
    const patterns = analyzeContentPatterns(posts);

    // Generate suggestions (this will be fast since we don't need full analysis)
    const { generateTitleSuggestions } = await import('../lib/ai-content-advisor.js');
    const suggestions = await generateTitleSuggestions(patterns, subreddit, count);

    return res.json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });

  } catch (error) {
    logger.error('Failed to generate title suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      body: req.body
    });

    return res.status(500).json({
      error: 'Failed to generate titles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
