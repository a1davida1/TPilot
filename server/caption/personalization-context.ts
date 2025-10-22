import { eq, sql } from 'drizzle-orm';

import { db } from '../db.js';
import { logger } from '../bootstrap/logger.js';
import { redditPostOutcomes, userPreferences } from '@shared/schema';

interface WritingStylePreferences {
  tone?: number | null;
  formality?: number | null;
  explicitness?: number | null;
}

interface ContentPreferences {
  themes?: string | string[] | null;
  avoid?: string | string[] | null;
}

interface CommunityOutcomeRow {
  subreddit: string | null;
  successCount: number | null;
  totalPosts: number | null;
  averageUpvotes: number | null;
}

export interface CaptionPersonalizationContext {
  promptLines: string[];
  bannedWords: string[];
}

function sanitizePromptValue(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[<>`]/g, '')
    .trim();
}

function normalizeList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === 'string' ? sanitizePromptValue(entry) : ''))
      .filter((entry): entry is string => entry.length > 0);
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[,|]/u)
      .map(part => sanitizePromptValue(part))
      .filter(part => part.length > 0);
    return parts;
  }
  return [];
}

function describeScale(value: number | null | undefined, low: string, medium: string, high: string): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  if (value < 34) {
    return low;
  }
  if (value > 66) {
    return high;
  }
  return medium;
}

function buildWritingStyleLine(writingStyle: WritingStylePreferences | undefined | null): string | undefined {
  if (!writingStyle) {
    return undefined;
  }
  const toneDescriptor = describeScale(writingStyle.tone ?? null, 'Playful tone', 'Balanced tone', 'Intense tone');
  const formalityDescriptor = describeScale(writingStyle.formality ?? null, 'Low formality', 'Semi-formal', 'Polished delivery');
  const explicitnessDescriptor = describeScale(
    writingStyle.explicitness ?? null,
    'Subtle flirting',
    'Suggestive energy',
    'Direct & bold'
  );

  const descriptors = [toneDescriptor, formalityDescriptor, explicitnessDescriptor]
    .filter((descriptor): descriptor is string => Boolean(descriptor && descriptor.length > 0));

  if (descriptors.length === 0) {
    return undefined;
  }

  return `WRITING_STYLE: ${descriptors.join(' | ')}`;
}

function buildThemesLine(preferences: ContentPreferences | undefined | null): string | undefined {
  if (!preferences) {
    return undefined;
  }
  const themes = normalizeList(preferences.themes);
  if (themes.length === 0) {
    return undefined;
  }
  return `PREFERRED_THEMES: ${themes.join(' | ')}`;
}

function buildAvoidTopicsLine(preferences: ContentPreferences | undefined | null): string | undefined {
  if (!preferences) {
    return undefined;
  }
  const avoid = normalizeList(preferences.avoid);
  if (avoid.length === 0) {
    return undefined;
  }
  return `AVOID_TOPICS: ${avoid.join(' | ')}`;
}

function normalizeSubreddit(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = sanitizePromptValue(value.toLowerCase());
  if (!trimmed) {
    return undefined;
  }
  return trimmed.startsWith('r/') ? trimmed.slice(2) : trimmed;
}

function buildCommunityLines(rows: CommunityOutcomeRow[], defaultSubreddit?: string | null): string[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    const normalizedDefault = normalizeSubreddit(defaultSubreddit ?? undefined);
    if (normalizedDefault) {
      return [`PRIMARY_COMMUNITY: r/${normalizedDefault}`];
    }
    return [];
  }

  const prepared = rows
    .map(row => {
      const subreddit = normalizeSubreddit(row.subreddit ?? undefined);
      if (!subreddit) {
        return null;
      }
      const totalPosts = typeof row.totalPosts === 'number' ? row.totalPosts : Number(row.totalPosts ?? 0);
      const successCount = typeof row.successCount === 'number' ? row.successCount : Number(row.successCount ?? 0);
      const averageUpvotes = typeof row.averageUpvotes === 'number'
        ? row.averageUpvotes
        : Number(row.averageUpvotes ?? 0);
      if (!Number.isFinite(totalPosts) || totalPosts <= 0) {
        return null;
      }
      const successRate = Math.max(0, Math.min(100, Math.round((successCount / totalPosts) * 100)));
      const upvoteLabel = averageUpvotes > 0 ? `${Math.round(averageUpvotes)} avg upvotes` : 'steady engagement';
      return {
        subreddit,
        successRate,
        totalPosts,
        upvoteLabel,
      };
    })
    .filter((entry): entry is { subreddit: string; successRate: number; totalPosts: number; upvoteLabel: string } => entry !== null);

  if (prepared.length === 0) {
    const normalizedDefault = normalizeSubreddit(defaultSubreddit ?? undefined);
    if (normalizedDefault) {
      return [`PRIMARY_COMMUNITY: r/${normalizedDefault}`];
    }
    return [];
  }

  prepared.sort((a, b) => {
    if (b.successRate !== a.successRate) {
      return b.successRate - a.successRate;
    }
    if (b.totalPosts !== a.totalPosts) {
      return b.totalPosts - a.totalPosts;
    }
    return a.subreddit.localeCompare(b.subreddit);
  });

  const topCommunities = prepared.slice(0, 3);
  const segments = topCommunities.map(entry => `r/${entry.subreddit} (${entry.successRate}% win • ${entry.upvoteLabel})`);
  return [`COMMUNITY_CONTEXT: Focus on what performs in ${segments.join(' | ')}`];
}

export async function loadCaptionPersonalizationContext(userId: number): Promise<CaptionPersonalizationContext | null> {
  if (!Number.isFinite(userId)) {
    return null;
  }

  try {
    const [preferenceRecord] = await db
      .select({
        writingStyle: userPreferences.writingStyle,
        contentPreferences: userPreferences.contentPreferences,
        prohibitedWords: userPreferences.prohibitedWords,
        defaultSubreddit: userPreferences.defaultSubreddit,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const successCountSql = sql<number>`sum(case when ${redditPostOutcomes.success} then 1 else 0 end)`;
    const totalPostsSql = sql<number>`count(*)`;
    const averageUpvotesSql = sql<number>`coalesce(avg(${redditPostOutcomes.upvotes}), 0)`;

    const communityRows = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        successCount: successCountSql,
        totalPosts: totalPostsSql,
        averageUpvotes: averageUpvotesSql,
      })
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, userId))
      .groupBy(redditPostOutcomes.subreddit)
      .limit(20);

    const promptLines: string[] = [];

    if (preferenceRecord) {
      const writingStyleLine = buildWritingStyleLine(preferenceRecord.writingStyle as WritingStylePreferences | null | undefined);
      if (writingStyleLine) {
        promptLines.push(writingStyleLine);
      }

      const themesLine = buildThemesLine(preferenceRecord.contentPreferences as ContentPreferences | null | undefined);
      if (themesLine) {
        promptLines.push(themesLine);
      }

      const avoidLine = buildAvoidTopicsLine(preferenceRecord.contentPreferences as ContentPreferences | null | undefined);
      if (avoidLine) {
        promptLines.push(avoidLine);
      }

      const communityLines = buildCommunityLines(communityRows, preferenceRecord.defaultSubreddit);
      promptLines.push(...communityLines);
    } else {
      const communityLines = buildCommunityLines(communityRows, undefined);
      promptLines.push(...communityLines);
    }

    const bannedWords = normalizeList(preferenceRecord?.prohibitedWords);
    if (bannedWords.length > 0) {
      const bannedLine = `STRICTLY_FORBIDDEN: ${bannedWords.join(' | ')}`;
      promptLines.push(bannedLine);
    }

    const uniquePromptLines = Array.from(new Set(promptLines.map(line => sanitizePromptValue(line)))).filter(
      (line): line is string => line.length > 0,
    );

    if (uniquePromptLines.length === 0 && bannedWords.length === 0) {
      return null;
    }

    return {
      promptLines: uniquePromptLines,
      bannedWords,
    };
  } catch (error) {
    logger.warn('Failed to load caption personalization context', { userId, error });
    return null;
  }
}
