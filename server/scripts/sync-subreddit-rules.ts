#!/usr/bin/env tsx

import { db } from '../db.js';
import { subredditRules, redditCommunities, createDefaultRules } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import type { RuleSpec, RuleSpecBase } from '../lib/policy-linter.js';
import type { RedditCommunityRuleSet } from '@shared/schema';

// Reddit API configuration
const REDDIT_USER_AGENT = 'ThottoPilot/1.0 (Subreddit rules sync)';

interface RedditRule {
  kind: string;
  short_name: string;
  description?: string;
  description_html?: string;
  priority?: number;
}

interface RedditAboutRulesResponse {
  rules?: RedditRule[];
  site_rules?: RedditRule[];
}

interface RedditWikiResponse {
  kind: string;
  data?: {
    content_md?: string;
    content_html?: string;
  };
}

/**
 * Fetches subreddit rules from Reddit's /about/rules endpoint
 */
async function fetchAboutRules(subreddit: string): Promise<RedditRule[]> {
  const url = `https://www.reddit.com/r/${subreddit}/about/rules.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch rules for r/${subreddit}: ${response.status}`);
      return [];
    }

    const data: RedditAboutRulesResponse = await response.json();
    return data.rules || [];
  } catch (error) {
    console.error(`Error fetching rules for r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Fetches subreddit wiki rules from Reddit's /wiki/rules endpoint
 */
async function fetchWikiRules(subreddit: string): Promise<string> {
  const url = `https://www.reddit.com/r/${subreddit}/wiki/rules.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch wiki rules for r/${subreddit}: ${response.status}`);
      return '';
    }

    const data: RedditWikiResponse = await response.json();
    return data.data?.content_md || '';
  } catch (error) {
    console.error(`Error fetching wiki rules for r/${subreddit}:`, error);
    return '';
  }
}

/**
 * Parse Reddit rules and wiki content into structured RuleSpec
 */
function parseRulesToSpec(rules: RedditRule[], wikiContent: string): RuleSpecBase {
  const spec: RuleSpecBase = {
    bannedWords: [],
    titleRegexes: [],
    bodyRegexes: [],
    requiredTags: [],
    wikiNotes: [],
  };

  // Parse structured rules from /about/rules
  for (const rule of rules) {
    const description = rule.description || '';
    const shortName = rule.short_name.toLowerCase();

    // Extract banned words from rule descriptions
    if (shortName.includes('banned') || shortName.includes('prohibited') || shortName.includes('forbidden')) {
      const bannedMatches = description.match(/(?:banned|prohibited|forbidden|not allowed?)[:\s]+([^.!?\n]+)/gi);
      if (bannedMatches) {
        for (const match of bannedMatches) {
          const words = match.replace(/^(?:banned|prohibited|forbidden|not allowed?)[:\s]+/i, '')
            .split(/[,;]/)
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 2);
          spec.bannedWords!.push(...words);
        }
      }
    }

    // Detect link policies
    if (shortName.includes('link') || shortName.includes('promotion') || shortName.includes('spam')) {
      if (description.toLowerCase().includes('no link') || description.toLowerCase().includes('no promotion')) {
        spec.linkPolicy = 'no-link';
      } else if (description.toLowerCase().includes('one link') || description.toLowerCase().includes('single link')) {
        spec.linkPolicy = 'one-link';
      } else {
        spec.linkPolicy = 'ok';
      }
    }

    // Detect flair requirements
    if (shortName.includes('flair') || shortName.includes('tag')) {
      if (description.toLowerCase().includes('required') || description.toLowerCase().includes('must')) {
        spec.flairRequired = true;
      }
    }

    // Extract required tags
    const tagMatches = description.match(/\[([^\]]+)\]/g);
    if (tagMatches) {
      spec.requiredTags!.push(...tagMatches);
    }

    // Extract length limits
    const titleLengthMatch = description.match(/title.{0,20}(?:maximum|max|limit).{0,10}(\d+)/i);
    if (titleLengthMatch) {
      spec.maxTitleLength = parseInt(titleLengthMatch[1], 10);
    }

    const bodyLengthMatch = description.match(/(?:body|post|content).{0,20}(?:maximum|max|limit).{0,10}(\d+)/i);
    if (bodyLengthMatch) {
      spec.maxBodyLength = parseInt(bodyLengthMatch[1], 10);
    }
  }

  // Parse wiki content for additional rules
  if (wikiContent) {
    const wikiLines = wikiContent.split('\n').filter(line => line.trim());
    
    // Extract wiki notes for manual review (case insensitive)
    spec.wikiNotes = wikiLines
      .filter(line => {
        const lower = line.toLowerCase();
        return lower.includes('karma') || lower.includes('account age') || lower.includes('verification');
      })
      .slice(0, 10); // Limit to first 10 relevant lines

    // Extract karma requirements
    const karmaMatch = wikiContent.match(/(?:minimum|min|require).{0,20}(\d+).{0,10}karma/i);
    if (karmaMatch) {
      spec.manualFlags = spec.manualFlags || {};
      spec.manualFlags.minKarma = parseInt(karmaMatch[1], 10);
    }

    // Extract account age requirements
    const ageMatch = wikiContent.match(/(?:account|profile).{0,20}(\d+).{0,10}(?:days?|months?|years?)/i);
    if (ageMatch) {
      spec.manualFlags = spec.manualFlags || {};
      const unit = wikiContent.match(/(?:days?|months?|years?)/i)?.[0] || 'days';
      let days = parseInt(ageMatch[1], 10);
      if (unit.toLowerCase().includes('month')) days *= 30;
      if (unit.toLowerCase().includes('year')) days *= 365;
      spec.manualFlags.minAccountAgeDays = days;
    }

    // Detect verification requirements
    if (wikiContent.toLowerCase().includes('verification') || wikiContent.toLowerCase().includes('verified')) {
      spec.manualFlags = spec.manualFlags || {};
      spec.manualFlags.verificationRequired = true;
    }
  }

  // Clean up arrays
  spec.bannedWords = [...new Set(spec.bannedWords!.filter(w => w.length > 0))];
  spec.requiredTags = [...new Set(spec.requiredTags!.filter(t => t.length > 0))];
  spec.wikiNotes = [...new Set(spec.wikiNotes!.filter(n => n.length > 0))];

  return spec;
}

/**
 * Apply existing overrides to a new rule spec
 */
async function applyExistingOverrides(subreddit: string, newSpec: RuleSpecBase): Promise<RuleSpec> {
  try {
    const [existing] = await db
      .select()
      .from(subredditRules)
      .where(eq(subredditRules.subreddit, subreddit.toLowerCase()));

    if (existing?.rulesJson) {
      const existingSpec = existing.rulesJson as RuleSpec;
      if (existingSpec.overrides) {
        // Merge overrides with new automated base
        const mergedSpec: RuleSpec = {
          ...newSpec,
          ...existingSpec.overrides,
          source: {
            fetchedAt: new Date().toISOString(),
            aboutRulesUrl: `https://www.reddit.com/r/${subreddit}/about/rules`,
            wikiRulesUrl: `https://www.reddit.com/r/${subreddit}/wiki/rules`,
            automatedBase: newSpec,
          },
          overrides: existingSpec.overrides,
        };

        // Apply override logic
        Object.keys(existingSpec.overrides).forEach(key => {
          const overrideValue = (existingSpec.overrides as Record<string, unknown>)[key];
          if (overrideValue !== undefined && overrideValue !== null) {
            (mergedSpec as Record<string, unknown>)[key] = overrideValue;
          }
        });

        return mergedSpec;
      }
    }

    // No existing overrides, return new spec with source metadata
    return {
      ...newSpec,
      source: {
        fetchedAt: new Date().toISOString(),
        aboutRulesUrl: `https://www.reddit.com/r/${subreddit}/about/rules`,
        wikiRulesUrl: `https://www.reddit.com/r/${subreddit}/wiki/rules`,
        automatedBase: newSpec,
      },
    };
  } catch (error) {
    console.error(`Error applying overrides for r/${subreddit}:`, error);
    return {
      ...newSpec,
      source: {
        fetchedAt: new Date().toISOString(),
        aboutRulesUrl: `https://www.reddit.com/r/${subreddit}/about/rules`,
        wikiRulesUrl: `https://www.reddit.com/r/${subreddit}/wiki/rules`,
        automatedBase: newSpec,
      },
    };
  }
}

/**
 * Sync rules for a single subreddit
 */
function mapRuleSpecToCommunityRules(spec: RuleSpec): RedditCommunityRuleSet {
  const defaults = createDefaultRules();

  const sellingPolicy = (() => {
    if (spec.linkPolicy === 'no-link') return 'not_allowed';
    if (spec.linkPolicy === 'one-link') return 'limited';
    if (spec.linkPolicy === 'ok') return 'allowed';
    return 'unknown';
  })();

  return {
    eligibility: {
      minKarma: spec.manualFlags?.minKarma ?? defaults.eligibility?.minKarma ?? null,
      minAccountAgeDays: spec.manualFlags?.minAccountAgeDays ?? defaults.eligibility?.minAccountAgeDays ?? null,
      verificationRequired: spec.manualFlags?.verificationRequired ?? defaults.eligibility?.verificationRequired ?? false,
      requiresApproval: defaults.eligibility?.requiresApproval ?? false,
    },
    content: {
      sellingPolicy,
      watermarksAllowed: defaults.content?.watermarksAllowed ?? null,
      promotionalLinks: defaults.content?.promotionalLinks ?? null,
      requiresOriginalContent: spec.flairRequired ?? defaults.content?.requiresOriginalContent ?? false,
      nsfwRequired: defaults.content?.nsfwRequired ?? false,
      titleGuidelines: spec.titleRegexes?.map(regex => `Avoid pattern: ${regex}`) ?? defaults.content?.titleGuidelines ?? [],
      contentGuidelines: spec.wikiNotes ?? defaults.content?.contentGuidelines ?? [],
      linkRestrictions: spec.requiredTags ?? defaults.content?.linkRestrictions ?? [],
      bannedContent: spec.bannedWords ?? defaults.content?.bannedContent ?? [],
      formattingRequirements: defaults.content?.formattingRequirements ?? [],
    },
    posting: {
      maxPostsPerDay: defaults.posting?.maxPostsPerDay ?? null,
      cooldownHours: defaults.posting?.cooldownHours ?? null,
    },
    notes: (spec.manualFlags?.notes && spec.manualFlags.notes.length > 0)
      ? spec.manualFlags.notes.join('\n')
      : defaults.notes ?? null,
  };
}

export async function syncSubredditRules(subreddit: string): Promise<RuleSpec> {
<<<<<<< ours
  console.warn(`Syncing rules for r/${subreddit}...`);
=======
  logger.info(`Syncing rules for r/${subreddit}...`);
>>>>>>> theirs

  try {
    // Fetch rules from Reddit
    const [aboutRules, wikiContent] = await Promise.all([
      fetchAboutRules(subreddit),
      fetchWikiRules(subreddit),
    ]);

    // Parse rules into structured format
    const parsedSpec = parseRulesToSpec(aboutRules, wikiContent);

    // Apply existing overrides
    const finalSpec = await applyExistingOverrides(subreddit, parsedSpec);

    // Upsert to database
    await db
      .insert(subredditRules)
      .values({
        subreddit: subreddit.toLowerCase(),
        rulesJson: finalSpec,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subredditRules.subreddit,
        set: {
          rulesJson: finalSpec,
          updatedAt: new Date(),
        },
      });

    const communityRuleSet = mapRuleSpecToCommunityRules(finalSpec);

    await db
      .update(redditCommunities)
      .set({
        rules: communityRuleSet,
      })
      .where(eq(redditCommunities.id, subreddit.toLowerCase()));

    logger.info(`✅ Successfully synced rules for r/${subreddit}`);

    return finalSpec;
  } catch (error) {
    console.error(`❌ Failed to sync rules for r/${subreddit}:`, error);
    throw error;
  }
}

/**
 * Sync rules for all known communities
 */
async function syncAllCommunityRules(): Promise<void> {
  console.error('🔄 Starting community rules sync...');

  try {
    // Get all communities from the database
    const communities = await db.select().from(redditCommunities);
    
    console.error(`Found ${communities.length} communities to sync`);

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < communities.length; i += batchSize) {
      const batch = communities.slice(i, i + batchSize);
      
      // Process batch in parallel but with delay between batches
      await Promise.all(
        batch.map(async community => {
          try {
            await syncSubredditRules(community.name);
          } catch (error) {
            console.error(`❌ Failed to sync rules for r/${community.name} in batch:`, error);
          }
        })
      );

      // Delay between batches to respect Reddit's rate limits
      if (i + batchSize < communities.length) {
        console.error(`Processed ${i + batchSize}/${communities.length}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.error('✅ Community rules sync completed');
  } catch (error) {
    console.error('❌ Community rules sync failed:', error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Sync all communities
    await syncAllCommunityRules();
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.error(`
Usage: tsx sync-subreddit-rules.ts [subreddit_name]

Options:
  --help, -h    Show this help message
  
Examples:
  tsx sync-subreddit-rules.ts           # Sync all known communities
  tsx sync-subreddit-rules.ts gonewild  # Sync specific subreddit
    `);
  } else {
    // Sync specific subreddit
    const subreddit = args[0];
    await syncSubredditRules(subreddit);
  }

  process.exit(0);
}

// Run if called directly (ESM-compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { syncAllCommunityRules, parseRulesToSpec };