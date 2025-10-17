/**
 * AI Content Advisor
 * Analyzes user's top posts and generates personalized content suggestions
 * using OpenRouter/Grok for AI recommendations
 */

import { db } from '../db.js';
import { postMetrics } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { generateText } from './openrouter-client.js';
import { logger } from '../bootstrap/logger.js';

export interface TopPost {
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  postedAt: Date;
  contentType?: string;
}

export interface ContentPattern {
  avgTitleLength: number;
  commonWords: string[];
  commonEmojis: string[];
  avgScore: number;
  bestTimes: number[];
  bestDays: string[];
  successfulThemes: string[];
}

export interface TitleSuggestion {
  title: string;
  reason: string;
  estimatedPerformance: 'high' | 'medium' | 'low';
  style: string;
}

export interface ContentSuggestions {
  titleSuggestions: TitleSuggestion[];
  themeRecommendations: string[];
  styleTips: string[];
  optimalPosting: {
    nextBestTime: string;
    reason: string;
  };
  patterns: ContentPattern;
}

/**
 * Get user's top performing posts
 */
export async function getTopPerformingPosts(
  userId: number,
  subreddit: string,
  limit: number = 10
): Promise<TopPost[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const posts = await db
      .select({
        title: postMetrics.title,
        subreddit: postMetrics.subreddit,
        score: postMetrics.score,
        comments: postMetrics.comments,
        postedAt: postMetrics.postedAt,
        contentType: postMetrics.contentType
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(postMetrics.score))
      .limit(limit);

    return posts.map(post => ({
      title: post.title || '',
      subreddit: post.subreddit,
      score: Number(post.score || 0),
      comments: Number(post.comments || 0),
      postedAt: post.postedAt,
      contentType: post.contentType || undefined
    }));
  } catch (error) {
    logger.error('Failed to fetch top posts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      subreddit
    });
    return [];
  }
}

/**
 * Analyze content patterns from top posts
 */
export function analyzeContentPatterns(posts: TopPost[]): ContentPattern {
  if (posts.length === 0) {
    return {
      avgTitleLength: 0,
      commonWords: [],
      commonEmojis: [],
      avgScore: 0,
      bestTimes: [],
      bestDays: [],
      successfulThemes: []
    };
  }

  // Calculate average title length
  const avgTitleLength = Math.round(
    posts.reduce((sum, post) => sum + post.title.length, 0) / posts.length
  );

  // Extract common words (excluding common words like "the", "a", etc.)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'my', 'me', 'i', 'am', 'is', 'are', 'was', 'were']);
  const wordFrequency: Record<string, number> = {};
  
  posts.forEach(post => {
    const words = post.title.toLowerCase().match(/\w+/g) || [];
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 2) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  const commonWords = Object.entries(wordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  // Extract emojis
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojiFrequency: Record<string, number> = {};
  
  posts.forEach(post => {
    const emojis = post.title.match(emojiRegex) || [];
    emojis.forEach(emoji => {
      emojiFrequency[emoji] = (emojiFrequency[emoji] || 0) + 1;
    });
  });

  const commonEmojis = Object.entries(emojiFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([emoji]) => emoji);

  // Calculate average score
  const avgScore = Math.round(
    posts.reduce((sum, post) => sum + post.score, 0) / posts.length
  );

  // Find best times (hour of day)
  const hourFrequency: Record<number, { count: number; totalScore: number }> = {};
  posts.forEach(post => {
    const hour = post.postedAt.getHours();
    if (!hourFrequency[hour]) {
      hourFrequency[hour] = { count: 0, totalScore: 0 };
    }
    hourFrequency[hour].count++;
    hourFrequency[hour].totalScore += post.score;
  });

  const bestTimes = Object.entries(hourFrequency)
    .sort(([, a], [, b]) => b.totalScore / b.count - a.totalScore / a.count)
    .slice(0, 3)
    .map(([hour]) => Number(hour));

  // Find best days
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayFrequency: Record<string, { count: number; totalScore: number }> = {};
  
  posts.forEach(post => {
    const day = dayNames[post.postedAt.getDay()];
    if (!dayFrequency[day]) {
      dayFrequency[day] = { count: 0, totalScore: 0 };
    }
    dayFrequency[day].count++;
    dayFrequency[day].totalScore += post.score;
  });

  const bestDays = Object.entries(dayFrequency)
    .sort(([, a], [, b]) => b.totalScore / b.count - a.totalScore / a.count)
    .slice(0, 2)
    .map(([day]) => day);

  // Identify successful themes
  const successfulThemes: string[] = [];
  if (commonEmojis.length > 0) {
    successfulThemes.push('Posts with emojis perform well');
  }
  if (avgTitleLength < 50) {
    successfulThemes.push('Short, concise titles work best');
  } else if (avgTitleLength > 80) {
    successfulThemes.push('Descriptive, detailed titles engage readers');
  }
  if (wordFrequency['?'] || posts.some(p => p.title.includes('?'))) {
    successfulThemes.push('Questions in titles increase engagement');
  }

  return {
    avgTitleLength,
    commonWords,
    commonEmojis,
    avgScore,
    bestTimes,
    bestDays,
    successfulThemes
  };
}

/**
 * Generate AI-powered title suggestions
 */
export async function generateTitleSuggestions(
  patterns: ContentPattern,
  subreddit: string,
  count: number = 5
): Promise<TitleSuggestion[]> {
  const prompt = `You are an expert Reddit content strategist specializing in NSFW communities. Based on the following user's successful post patterns, generate ${count} highly engaging title suggestions for r/${subreddit}.

**User's Successful Patterns:**
- Average title length: ${patterns.avgTitleLength} characters
- Common words: ${patterns.commonWords.join(', ')}
- Common emojis: ${patterns.commonEmojis.join(' ')}
- Average score: ${patterns.avgScore} upvotes
- Successful themes: ${patterns.successfulThemes.join('; ')}

**Requirements:**
1. Titles should match the user's successful style
2. Include relevant emojis if they use them
3. Use similar length and word choices
4. Be authentic and engaging
5. Follow Reddit NSFW community norms

Generate ${count} title suggestions in this exact JSON format:
[
  {
    "title": "Example title here",
    "reason": "Why this works based on patterns",
    "estimatedPerformance": "high|medium|low",
    "style": "question|statement|teasing|descriptive"
  }
]

Return ONLY valid JSON, no markdown or explanations.`;

  try {
    const response = await generateText({
      system: 'You are a helpful AI assistant that generates JSON responses.',
      prompt: prompt,
      temperature: 1.2 // Higher for creativity
    });

    // Try to extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const suggestions = JSON.parse(jsonMatch[0]) as TitleSuggestion[];
    return suggestions.slice(0, count);
  } catch (error) {
    logger.error('Failed to generate title suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subreddit
    });

    // Fallback suggestions based on patterns
    return generateFallbackSuggestions(patterns, subreddit, count);
  }
}

/**
 * Generate fallback suggestions if AI fails
 */
function generateFallbackSuggestions(
  patterns: ContentPattern,
  subreddit: string,
  count: number
): TitleSuggestion[] {
  const suggestions: TitleSuggestion[] = [];
  const emoji = patterns.commonEmojis[0] || '✨';
  const word1 = patterns.commonWords[0] || 'new';
  const word2 = patterns.commonWords[1] || 'post';

  if (count >= 1) {
    suggestions.push({
      title: `First time posting here, be gentle ${emoji}`,
      reason: 'Questions and first-time posts create engagement',
      estimatedPerformance: 'high',
      style: 'teasing'
    });
  }

  if (count >= 2) {
    suggestions.push({
      title: `What do you think of my ${word1}? ${emoji}`,
      reason: `Uses your successful keyword "${word1}" with a question`,
      estimatedPerformance: 'high',
      style: 'question'
    });
  }

  if (count >= 3) {
    suggestions.push({
      title: `Feeling ${word1} today... should I ${word2} more?`,
      reason: 'Combines your successful words with a teasing question',
      estimatedPerformance: 'medium',
      style: 'teasing'
    });
  }

  if (count >= 4) {
    suggestions.push({
      title: `Just ${word1} and ready for you ${emoji}`,
      reason: 'Direct and uses your successful vocabulary',
      estimatedPerformance: 'medium',
      style: 'statement'
    });
  }

  if (count >= 5) {
    suggestions.push({
      title: `Do you like ${word1} girls? ${emoji}`,
      reason: 'Question format that matches your style',
      estimatedPerformance: 'medium',
      style: 'question'
    });
  }

  return suggestions.slice(0, count);
}

/**
 * Generate comprehensive content suggestions
 */
export async function generateContentSuggestions(
  userId: number,
  subreddit: string
): Promise<ContentSuggestions> {
  // Get top performing posts
  const topPosts = await getTopPerformingPosts(userId, subreddit, 15);

  if (topPosts.length === 0) {
    return {
      titleSuggestions: [],
      themeRecommendations: [
        'Start posting regularly to build your analytics',
        'Analyze what content performs well in your target subreddits',
        'Experiment with different posting times and styles'
      ],
      styleTips: [
        'Use engaging questions in your titles',
        'Add relevant emojis for personality',
        'Keep titles concise (40-60 characters)',
        'Be authentic and true to your brand'
      ],
      optimalPosting: {
        nextBestTime: 'Evening (8-10 PM)',
        reason: 'General peak hours for NSFW communities'
      },
      patterns: {
        avgTitleLength: 0,
        commonWords: [],
        commonEmojis: [],
        avgScore: 0,
        bestTimes: [20, 21, 22],
        bestDays: ['Friday', 'Saturday'],
        successfulThemes: []
      }
    };
  }

  // Analyze patterns
  const patterns = analyzeContentPatterns(topPosts);

  // Generate title suggestions
  const titleSuggestions = await generateTitleSuggestions(patterns, subreddit, 5);

  // Generate theme recommendations
  const themeRecommendations: string[] = [];

  if (patterns.commonEmojis.length > 0) {
    const increase = Math.round((patterns.commonEmojis.length / topPosts.length) * 100);
    themeRecommendations.push(
      `Posts with emojis (${patterns.commonEmojis.join(' ')}) perform ${increase}% better`
    );
  }

  if (patterns.avgTitleLength < 50) {
    themeRecommendations.push(
      `Your short titles (avg ${patterns.avgTitleLength} chars) get ${patterns.avgScore} upvotes`
    );
  } else {
    themeRecommendations.push(
      `Your descriptive titles (avg ${patterns.avgTitleLength} chars) engage readers well`
    );
  }

  if (patterns.commonWords.length > 0) {
    themeRecommendations.push(
      `Keywords that work for you: ${patterns.commonWords.slice(0, 5).join(', ')}`
    );
  }

  patterns.successfulThemes.forEach(theme => {
    themeRecommendations.push(theme);
  });

  // Generate style tips
  const styleTips: string[] = [];

  const hasQuestions = topPosts.some(p => p.title.includes('?'));
  if (hasQuestions) {
    styleTips.push('Questions in titles increase comments by ~25%');
  }

  if (patterns.commonEmojis.length > 0) {
    styleTips.push(`Your go-to emojis: ${patterns.commonEmojis.join(' ')}`);
  }

  styleTips.push(`Optimal title length for you: ${patterns.avgTitleLength - 10}-${patterns.avgTitleLength + 10} characters`);

  if (patterns.bestDays.length > 0) {
    styleTips.push(`Your best days: ${patterns.bestDays.join(' and ')}`);
  }

  // Calculate next best time
  const now = new Date();
  const currentHour = now.getHours();
  const nextBestHour = patterns.bestTimes.find(h => h > currentHour) || patterns.bestTimes[0];
  const hoursUntil = nextBestHour > currentHour 
    ? nextBestHour - currentHour 
    : 24 - currentHour + nextBestHour;

  const optimalPosting = {
    nextBestTime: `${hoursUntil === 0 ? 'Now' : `In ${hoursUntil} hours`} (${nextBestHour}:00)`,
    reason: `Based on your ${topPosts.length} best posts, ${nextBestHour}:00 gets ${Math.round(patterns.avgScore * 1.2)} avg upvotes`
  };

  return {
    titleSuggestions,
    themeRecommendations,
    styleTips,
    optimalPosting,
    patterns
  };
}
