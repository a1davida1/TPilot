/**
 * Subreddit recommendation engine
 * Suggests optimal subreddits based on content category, user history, and performance metrics
 */

export interface SubredditRecommendation {
  name: string;
  score: number;
  avgUpvotes: number;
  avgComments: number;
  successRate: number;
  lastPosted?: string;
  reason: string;
}

export interface RecommendationRequest {
  category: string;
  tags?: string[];
  userId?: number;
  nsfw: boolean;
  excludeSubreddits?: string[];
}

// Curated NSFW subreddit database with categories
const NSFW_SUBREDDITS = [
  { name: 'gonewild', categories: ['general', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 1.0 },
  { name: 'RealGirls', categories: ['general', 'amateur'], minKarma: 100, nsfwRequired: true, weight: 0.9 },
  { name: 'PetiteGoneWild', categories: ['petite', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'BustyPetite', categories: ['petite', 'busty'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'gonewild30plus', categories: ['mature', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'AsiansGoneWild', categories: ['asian', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'LatinasGoneWild', categories: ['latina', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'OnlyFans101', categories: ['promo', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.6 },
  { name: 'OnlyFansPromotions', categories: ['promo', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.6 },
  { name: 'Onlyfans_Promo', categories: ['promo', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.5 },
  { name: 'SexSells', categories: ['selling', 'services'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'NSFWverifiedamateurs', categories: ['amateur', 'verified'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'GoneWildSmiles', categories: ['general', 'wholesome'], minKarma: 0, nsfwRequired: true, weight: 0.6 },
  { name: 'fitgirls', categories: ['fitness', 'athletic'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'FitNakedGirls', categories: ['fitness', 'athletic'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'gothsluts', categories: ['goth', 'alt'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'altgonewild', categories: ['alt', 'tattoos'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'BigBoobsGW', categories: ['busty', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'boobs', categories: ['busty', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'Nude_Selfie', categories: ['general', 'selfie'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'LegalTeens', categories: ['teen', 'general'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'collegesluts', categories: ['college', 'amateur'], minKarma: 0, nsfwRequired: true, weight: 0.8 },
  { name: 'Nudes', categories: ['general', 'artistic'], minKarma: 0, nsfwRequired: true, weight: 0.7 },
  { name: 'lingerie', categories: ['lingerie', 'artistic'], minKarma: 0, nsfwRequired: true, weight: 0.6 },
  { name: 'GoneMild', categories: ['mild', 'teasing'], minKarma: 0, nsfwRequired: false, weight: 0.5 }
];

/**
 * Get subreddit recommendations based on content and user history
 */
export async function getSubredditRecommendations(
  request: RecommendationRequest
): Promise<SubredditRecommendation[]> {
  const { category, tags = [], userId, nsfw, excludeSubreddits = [] } = request;

  // Filter subreddits by category/tags match
  const matchingSubreddits = NSFW_SUBREDDITS.filter(sub => {
    // Skip if excluded
    if (excludeSubreddits.includes(sub.name)) return false;

    // NSFW filter
    if (nsfw && !sub.nsfwRequired) return false;

    // Category match
    const categoryMatch = sub.categories.includes(category.toLowerCase());
    const tagMatch = tags.some(tag => sub.categories.includes(tag.toLowerCase()));

    return categoryMatch || tagMatch;
  });

  // If no matches, fall back to general NSFW subreddits
  const candidateSubreddits = matchingSubreddits.length > 0
    ? matchingSubreddits
    : NSFW_SUBREDDITS.filter(sub => sub.categories.includes('general') && !excludeSubreddits.includes(sub.name));

  // Get performance metrics for each subreddit
  const recommendations = await Promise.all(
    candidateSubreddits.map(async sub => {
      const metrics = userId
        ? await getUserSubredditMetrics(userId, sub.name)
        : await getGlobalSubredditMetrics(sub.name);

      const score = calculateScore(sub.weight, metrics);

      return {
        name: sub.name,
        score,
        avgUpvotes: metrics.avgUpvotes,
        avgComments: metrics.avgComments,
        successRate: metrics.successRate,
        lastPosted: metrics.lastPosted,
        reason: generateReason(sub, metrics)
      };
    })
  );

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Return top 5
  return recommendations.slice(0, 5);
}

interface SubredditMetrics {
  avgUpvotes: number;
  avgComments: number;
  successRate: number;
  totalPosts: number;
  lastPosted?: string;
}

/**
 * Get user-specific metrics for a subreddit
 */
async function getUserSubredditMetrics(
  _userId: number,
  _subreddit: string
): Promise<SubredditMetrics> {
  // TODO: Replace with actual database query
  // This should query your post_metrics table filtered by userId and subreddit
  
  // Placeholder implementation
  return {
    avgUpvotes: Math.floor(Math.random() * 500) + 50,
    avgComments: Math.floor(Math.random() * 50) + 5,
    successRate: 0.7 + Math.random() * 0.25,
    totalPosts: Math.floor(Math.random() * 20)
  };
}

/**
 * Get global platform metrics for a subreddit
 */
async function getGlobalSubredditMetrics(
  subreddit: string
): Promise<SubredditMetrics> {
  // TODO: Replace with actual database query
  // This should aggregate metrics across all users for this subreddit
  
  // Placeholder implementation with realistic estimates
  const baseUpvotes: Record<string, number> = {
    'gonewild': 800,
    'RealGirls': 600,
    'PetiteGoneWild': 500,
    'AsiansGoneWild': 450,
    'gonewild30plus': 400,
    'OnlyFansPromotions': 150,
    'SexSells': 120
  };

  return {
    avgUpvotes: baseUpvotes[subreddit] ?? 200,
    avgComments: Math.floor((baseUpvotes[subreddit] ?? 200) * 0.08),
    successRate: 0.75,
    totalPosts: 1000,
  };
}

/**
 * Calculate recommendation score
 */
function calculateScore(
  baseWeight: number,
  metrics: SubredditMetrics
): number {
  // Weighted formula:
  // - Base weight (subreddit quality/fit)
  // - Engagement (upvotes + comments)
  // - Success rate (not removed)
  // - Recency penalty (if posted recently)

  const engagementScore = (metrics.avgUpvotes * 0.7) + (metrics.avgComments * 10);
  const recencyPenalty = metrics.lastPosted ? 0.5 : 1.0; // 50% penalty if posted recently

  return baseWeight * engagementScore * metrics.successRate * recencyPenalty;
}

/**
 * Generate human-readable reason for recommendation
 */
function generateReason(
  sub: typeof NSFW_SUBREDDITS[0],
  metrics: SubredditMetrics
): string {
  if (metrics.totalPosts === 0) {
    return `New opportunity in ${sub.categories.join('/')} niche`;
  }

  if (metrics.avgUpvotes > 500) {
    return `High engagement (avg ${metrics.avgUpvotes} upvotes)`;
  }

  if (metrics.successRate > 0.9) {
    return `${Math.round(metrics.successRate * 100)}% success rate`;
  }

  return `Good match for ${sub.categories[0]} content`;
}

/**
 * Get category from tags and content analysis
 */
export function inferCategoryFromTags(tags: string[]): string {
  const categoryMap: Record<string, string> = {
    'fitness': 'fitness',
    'athletic': 'fitness',
    'gym': 'fitness',
    'yoga': 'fitness',
    'lingerie': 'lingerie',
    'bedroom': 'general',
    'teasing': 'mild',
    'cosplay': 'cosplay',
    'asian': 'asian',
    'latina': 'latina',
    'goth': 'goth',
    'tattoos': 'alt',
    'petite': 'petite',
    'busty': 'busty',
    'mature': 'mature',
    'college': 'college'
  };

  for (const tag of tags) {
    const category = categoryMap[tag.toLowerCase()];
    if (category) return category;
  }

  return 'general';
}
