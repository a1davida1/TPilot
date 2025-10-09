/**
 * Subreddit rules cache for pre-submit validation
 * Prevents removals by checking NSFW flags, title constraints, banned words, and flair requirements
 */

export interface SubredditRule {
  subreddit: string;
  nsfwRequired?: boolean;
  bannedWords?: string[];
  titleMin?: number;
  titleMax?: number;
  requiresFlair?: boolean;
  allowedFlairs?: string[];
  notes?: string;
  updatedAt: string;
}

export const SUBREDDIT_RULES: SubredditRule[] = [
  {
    subreddit: 'SexSells',
    nsfwRequired: true,
    bannedWords: ['cashapp', 'venmo', 'paypal'],
    titleMin: 5,
    titleMax: 140,
    requiresFlair: true,
    allowedFlairs: ['Verification', 'Selling', 'Weekly Thread'],
    notes: 'https://www.reddit.com/r/SexSells/wiki/index',
    updatedAt: '2025-10-08'
  },
  {
    subreddit: 'gonewild',
    nsfwRequired: true,
    bannedWords: ['onlyfans.com', 'of.com', 'cashapp', 'venmo'],
    titleMax: 300,
    notes: 'https://www.reddit.com/r/gonewild/wiki/rules',
    updatedAt: '2025-10-08'
  },
  {
    subreddit: 'OnlyFansPromotions',
    nsfwRequired: true,
    bannedWords: ['cashapp', 'venmo', 'paypal'],
    titleMin: 10,
    titleMax: 200,
    requiresFlair: false,
    notes: 'https://www.reddit.com/r/OnlyFansPromotions/wiki/index',
    updatedAt: '2025-10-08'
  },
  {
    subreddit: 'NSFWverifiedamateurs',
    nsfwRequired: true,
    bannedWords: ['onlyfans.com', 'of.com'],
    titleMax: 250,
    requiresFlair: false,
    notes: 'https://www.reddit.com/r/NSFWverifiedamateurs/about/rules',
    updatedAt: '2025-10-08'
  }
];

export interface LintResult {
  ok: boolean;
  warnings: string[];
  rule?: SubredditRule;
}

export function lintSubmission({
  subreddit,
  title,
  nsfw,
  flair
}: {
  subreddit: string;
  title: string;
  nsfw: boolean;
  flair?: string;
}): LintResult {
  const rule = SUBREDDIT_RULES.find(
    r => r.subreddit.toLowerCase() === subreddit.toLowerCase()
  );

  if (!rule) {
    return { ok: true, warnings: [] };
  }

  const warnings: string[] = [];

  if (rule.nsfwRequired && !nsfw) {
    warnings.push('NSFW flag required for this subreddit');
  }

  if (rule.titleMin && title.length < rule.titleMin) {
    warnings.push(`Title must be at least ${rule.titleMin} characters`);
  }

  if (rule.titleMax && title.length > rule.titleMax) {
    warnings.push(`Title must be ${rule.titleMax} characters or less`);
  }

  if (rule.requiresFlair && (!flair || (rule.allowedFlairs && !rule.allowedFlairs.includes(flair)))) {
    warnings.push(
      rule.allowedFlairs 
        ? `Flair required. Allowed: ${rule.allowedFlairs.join(', ')}`
        : 'Flair required for this subreddit'
    );
  }

  if (rule.bannedWords) {
    const foundBanned = rule.bannedWords.filter(word =>
      title.toLowerCase().includes(word.toLowerCase())
    );
    if (foundBanned.length > 0) {
      warnings.push(`Title contains banned terms: ${foundBanned.join(', ')}`);
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
    rule
  };
}

export function getSubredditRule(subreddit: string): SubredditRule | undefined {
  return SUBREDDIT_RULES.find(
    r => r.subreddit.toLowerCase() === subreddit.toLowerCase()
  );
}
