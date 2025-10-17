/**
 * Badge Calculator
 * Calculates and awards achievement badges for caption performance
 */

import { pool } from '../db.js';
import { logger } from '../bootstrap/logger.js';

export interface Badge {
  type: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  progress?: number; // 0-100
  requirement?: string;
}

export const BADGE_DEFINITIONS = {
  quick_decider: {
    name: 'Quick Decider',
    description: 'Average choice time under 5 seconds',
    icon: '⚡',
    requirement: 'avg_choice_time_ms < 5000'
  },
  perfectionist: {
    name: 'Perfectionist',
    description: 'Edit rate over 60%',
    icon: '✏️',
    requirement: 'edit_rate > 0.6'
  },
  viral_writer: {
    name: 'Viral Writer',
    description: '3+ captions with over 500 upvotes',
    icon: '🔥',
    requirement: 'viral_posts >= 3'
  },
  superstar: {
    name: 'Superstar',
    description: 'One caption with 1000+ upvotes',
    icon: '⭐',
    requirement: 'best_upvotes > 1000'
  },
  style_chameleon: {
    name: 'Style Chameleon',
    description: 'Use both styles equally (45-55% split)',
    icon: '🎨',
    requirement: 'style_balance >= 0.45 AND style_balance <= 0.55'
  },
  sharp_shooter: {
    name: 'Sharp Shooter',
    description: 'Consistent style preference (80%+ win rate)',
    icon: '🎯',
    requirement: 'max_style_rate >= 0.8'
  },
  prolific_poster: {
    name: 'Prolific Poster',
    description: '50+ posts with captions',
    icon: '📝',
    requirement: 'total_posts >= 50'
  },
  oracle: {
    name: 'Oracle',
    description: '80%+ prediction accuracy (min 10 predictions)',
    icon: '🔮',
    requirement: 'prediction_accuracy >= 0.8 AND total_predictions >= 10'
  }
};

/**
 * Calculate which badges a user has earned
 */
export async function calculateBadges(userId: number): Promise<Badge[]> {
  try {
    // Get user stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT cc.choice_id) as total_choices,
        AVG(cc.time_to_choice_ms) as avg_choice_time_ms,
        SUM(CASE WHEN cc.edited THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(cc.choice_id), 0) as edit_rate,
        MAX(pm.upvotes) as best_upvotes,
        COUNT(DISTINCT CASE WHEN pm.upvotes > 500 THEN p.post_id END) as viral_posts,
        COUNT(DISTINCT p.post_id) as total_posts
      FROM caption_pairs cp
      LEFT JOIN caption_choices cc ON cp.pair_id = cc.pair_id
      LEFT JOIN posts p ON cc.chosen_caption_id = p.caption_id
      LEFT JOIN post_metrics pm ON p.post_id = pm.post_id AND pm.measured_at_hours = 24
      WHERE cp.creator_id = $1
    `, [userId]);

    // Get style balance
    const styleResult = await pool.query(`
      SELECT 
        c.style,
        COUNT(*) as count
      FROM caption_pairs cp
      JOIN caption_choices cc ON cp.pair_id = cc.pair_id
      JOIN captions c ON cc.chosen_caption_id = c.caption_id
      WHERE cp.creator_id = $1
      GROUP BY c.style
    `, [userId]);

    // Get prediction accuracy
    const predictionResult = await pool.query(`
      SELECT 
        COUNT(*) as total_predictions,
        SUM(CASE WHEN was_correct = TRUE THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) as accuracy
      FROM caption_predictions
      WHERE user_id = $1 AND was_correct IS NOT NULL
    `, [userId]);

    const stats = statsResult.rows[0];
    const styleStats = styleResult.rows;
    const predictionStats = predictionResult.rows[0];

    // Calculate style balance
    let styleBalance = 0.5;
    let maxStyleRate = 0;
    if (styleStats.length > 0) {
      const total = styleStats.reduce((sum, s) => sum + parseInt(s.count), 0);
      const flirtyCount = styleStats.find(s => s.style === 'flirty')?.count || 0;
      styleBalance = flirtyCount / total;
      maxStyleRate = Math.max(...styleStats.map(s => parseInt(s.count) / total));
    }

    // Get already earned badges
    const earnedResult = await pool.query(
      `SELECT badge_type FROM user_badges WHERE user_id = $1`,
      [userId]
    );
    const earnedBadges = new Set(earnedResult.rows.map(r => r.badge_type));

    // Calculate badges
    const badges: Badge[] = [];

    // Quick Decider
    badges.push({
      type: 'quick_decider',
      ...BADGE_DEFINITIONS.quick_decider,
      earned: stats.avg_choice_time_ms < 5000 || earnedBadges.has('quick_decider'),
      progress: Math.min(100, (5000 / (stats.avg_choice_time_ms || 5000)) * 100)
    });

    // Perfectionist
    badges.push({
      type: 'perfectionist',
      ...BADGE_DEFINITIONS.perfectionist,
      earned: stats.edit_rate > 0.6 || earnedBadges.has('perfectionist'),
      progress: Math.min(100, (stats.edit_rate / 0.6) * 100)
    });

    // Viral Writer
    badges.push({
      type: 'viral_writer',
      ...BADGE_DEFINITIONS.viral_writer,
      earned: stats.viral_posts >= 3 || earnedBadges.has('viral_writer'),
      progress: Math.min(100, (stats.viral_posts / 3) * 100)
    });

    // Superstar
    badges.push({
      type: 'superstar',
      ...BADGE_DEFINITIONS.superstar,
      earned: stats.best_upvotes > 1000 || earnedBadges.has('superstar'),
      progress: Math.min(100, (stats.best_upvotes / 1000) * 100)
    });

    // Style Chameleon
    const isChameleon = styleBalance >= 0.45 && styleBalance <= 0.55;
    badges.push({
      type: 'style_chameleon',
      ...BADGE_DEFINITIONS.style_chameleon,
      earned: isChameleon || earnedBadges.has('style_chameleon'),
      progress: 100 - Math.abs(styleBalance - 0.5) * 200 // Distance from 50%
    });

    // Sharp Shooter
    badges.push({
      type: 'sharp_shooter',
      ...BADGE_DEFINITIONS.sharp_shooter,
      earned: maxStyleRate >= 0.8 || earnedBadges.has('sharp_shooter'),
      progress: Math.min(100, (maxStyleRate / 0.8) * 100)
    });

    // Prolific Poster
    badges.push({
      type: 'prolific_poster',
      ...BADGE_DEFINITIONS.prolific_poster,
      earned: stats.total_posts >= 50 || earnedBadges.has('prolific_poster'),
      progress: Math.min(100, (stats.total_posts / 50) * 100)
    });

    // Oracle
    const isOracle = predictionStats.accuracy >= 0.8 && predictionStats.total_predictions >= 10;
    badges.push({
      type: 'oracle',
      ...BADGE_DEFINITIONS.oracle,
      earned: isOracle || earnedBadges.has('oracle'),
      progress: Math.min(100, (predictionStats.accuracy || 0) * 100)
    });

    return badges;

  } catch (error) {
    logger.error('Error calculating badges:', error);
    return [];
  }
}

/**
 * Award a badge to a user
 */
export async function awardBadge(userId: number, badgeType: string): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO user_badges (user_id, badge_type, earned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, badge_type) DO NOTHING`,
      [userId, badgeType]
    );

    logger.info(`🏆 Awarded badge "${badgeType}" to user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error awarding badge:', error);
    return false;
  }
}

/**
 * Check and auto-award newly earned badges
 */
export async function checkAndAwardBadges(userId: number): Promise<string[]> {
  const badges = await calculateBadges(userId);
  const newlyAwarded: string[] = [];

  for (const badge of badges) {
    if (badge.earned) {
      const awarded = await awardBadge(userId, badge.type);
      if (awarded) {
        newlyAwarded.push(badge.type);
      }
    }
  }

  return newlyAwarded;
}
