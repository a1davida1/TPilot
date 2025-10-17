/**
 * Schedule optimizer
 * Suggests optimal posting times based on subreddit activity and historical performance
 */

import { getUserSubredditMetrics, getGlobalSubredditMetrics, detectPeakHours } from './analytics-service.js';

export interface OptimalTimeSlot {
  timestamp: Date;
  dayOfWeek: string;
  hourOfDay: number;
  timezone: string;
  score: number;
  reason: string;
  estimatedEngagement: {
    upvotes: number;
    comments: number;
  };
}

export interface ScheduleRequest {
  subreddit: string;
  userId?: number;
  timezone?: string;
  daysAhead?: number;
}

/**
 * Peak activity hours are now dynamically detected from postMetrics data
 * via detectPeakHours() in analytics-service.ts
 * 
 * This provides personalized recommendations based on:
 * - User's historical performance by hour
 * - Global subreddit trends
 * - Statistical significance (confidence scores)
 */

// Day-of-week multipliers (1.0 = average)
const DAY_MULTIPLIERS: Record<number, number> = {
  0: 0.9,  // Sunday
  1: 0.85, // Monday
  2: 0.9,  // Tuesday
  3: 0.95, // Wednesday
  4: 1.0,  // Thursday
  5: 1.1,  // Friday
  6: 1.05  // Saturday
};

/**
 * Get optimal posting time suggestions
 */
export async function getOptimalPostingTimes(
  request: ScheduleRequest
): Promise<OptimalTimeSlot[]> {
  const {
    subreddit,
    userId,
    timezone = 'America/New_York', // Default to EST
    daysAhead = 7
  } = request;

  const slots: OptimalTimeSlot[] = [];
  const now = new Date();

  // Get dynamic peak hours from actual data
  const peakHoursAnalysis = await detectPeakHours(subreddit, userId);
  const peakHours = peakHoursAnalysis.peakHours;

  // Get historical performance from real data
  const historicalMetrics = userId
    ? await getUserSubredditMetrics(userId, subreddit)
    : await getGlobalSubredditMetrics(subreddit);

  // Generate time slots for next N days
  for (let day = 0; day < daysAhead; day++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + day);

    for (const hour of peakHours) {
      const slotTime = new Date(targetDate);
      slotTime.setHours(hour, 0, 0, 0);

      // Skip past times
      if (slotTime <= now) continue;

      const dayOfWeek = slotTime.getDay();
      const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek] ?? 1.0;

      // Calculate score based on:
      // - Peak hour match (1.0 if peak, 0.6 if not)
      // - Day of week multiplier
      // - Historical performance
      const isPeakHour = peakHours.includes(hour);
      const peakMultiplier = isPeakHour ? 1.0 : 0.6;

      const baseScore = 100 * peakMultiplier * dayMultiplier;
      const score = baseScore * (historicalMetrics.successRate ?? 0.75);

      const estimatedUpvotes = Math.floor(
        (historicalMetrics.avgUpvotes ?? 200) * peakMultiplier * dayMultiplier
      );

      slots.push({
        timestamp: slotTime,
        dayOfWeek: getDayName(dayOfWeek),
        hourOfDay: hour,
        timezone,
        score,
        reason: generateReason(isPeakHour, dayOfWeek, hour),
        estimatedEngagement: {
          upvotes: estimatedUpvotes,
          comments: Math.floor(estimatedUpvotes * 0.08)
        }
      });
    }
  }

  // Sort by score descending
  slots.sort((a, b) => b.score - a.score);

  // Return top 10 slots
  return slots.slice(0, 10);
}

/**
 * Analytics functions moved to analytics-service.ts
 * - getUserSubredditMetrics(): Real DB queries with caching
 * - getGlobalSubredditMetrics(): Platform-wide benchmarks
 * - detectPeakHours(): Dynamic peak hour detection
 * 
 * All functions query postMetrics and reddit_post_outcomes tables
 * with Redis caching (1-6 hour TTLs)
 */

function getDayName(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] ?? 'Unknown';
}

function generateReason(isPeakHour: boolean, dayOfWeek: number, hour: number): string {
  if (isPeakHour && dayOfWeek >= 5) {
    return `Peak weekend hour (${formatHour(hour)})`;
  }
  if (isPeakHour) {
    return `Peak activity hour (${formatHour(hour)})`;
  }
  if (dayOfWeek >= 5) {
    return `Weekend posting (${formatHour(hour)})`;
  }
  return `Good weekday slot (${formatHour(hour)})`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/**
 * Get next optimal posting time (single recommendation)
 */
export async function getNextOptimalTime(
  request: ScheduleRequest
): Promise<OptimalTimeSlot | null> {
  const slots = await getOptimalPostingTimes(request);
  return slots[0] ?? null;
}

/**
 * Check if a proposed time is within optimal window (using real data)
 */
export async function isOptimalTime(
  subreddit: string,
  proposedTime: Date,
  userId?: number
): Promise<{ isOptimal: boolean; score: number; reason: string }> {
  const hour = proposedTime.getHours();
  
  // Get dynamic peak hours from analytics
  const peakHoursAnalysis = await detectPeakHours(subreddit, userId);
  const peakHours = peakHoursAnalysis.peakHours;

  const isPeak = peakHours.includes(hour);
  const dayOfWeek = proposedTime.getDay();
  const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek] ?? 1.0;

  const score = isPeak ? dayMultiplier * 100 : dayMultiplier * 60;

  return {
    isOptimal: isPeak && score >= 80,
    score,
    reason: isPeak
      ? `Peak hour for r/${subreddit} (based on ${peakHoursAnalysis.sampleSize} posts)`
      : `Consider posting at ${peakHours.map(formatHour).join(', ')} for better engagement`
  };
}
