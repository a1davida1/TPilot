import { z } from "zod";

// ==========================================
// CANONICAL GROWTH TREND ENUM SYSTEM
// ==========================================

/**
 * Canonical growth trend values used across the entire application
 * These values standardize growth trend representation
 */
export const GROWTH_TRENDS = ['up', 'stable', 'down'] as const;

export type GrowthTrend = typeof GROWTH_TRENDS[number];

/**
 * Zod schema for growth trend validation
 */
export const growthTrendSchema = z.enum(GROWTH_TRENDS).nullable();

/**
 * Human-readable labels for growth trend values
 * Used in UI components for display purposes
 */
export const GROWTH_TREND_LABELS: Record<GrowthTrend, string> = {
  up: 'Growing',
  stable: 'Stable',
  down: 'Declining'
} as const;

/**
 * Helper function to get human-readable label for a growth trend
 */
export function getGrowthTrendLabel(trend: GrowthTrend | null | undefined): string {
  if (!trend) return 'Unknown';
  return GROWTH_TREND_LABELS[trend];
}

/**
 * Helper function to validate if a value is a valid growth trend
 */
export function isValidGrowthTrend(value: unknown): value is GrowthTrend {
  return typeof value === 'string' && GROWTH_TRENDS.includes(value as GrowthTrend);
}