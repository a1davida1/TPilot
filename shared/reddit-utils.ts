import type { LegacyRedditCommunityRuleSet, RedditCommunityRuleSet } from './schema';

// Helper function to normalize legacy rules to structured rules
export const normalizeRulesToStructured = (legacyRules: LegacyRedditCommunityRuleSet | null | undefined): RedditCommunityRuleSet | null => {
  if (!legacyRules) return null;

  return {
    eligibility: {
      minKarma: legacyRules.minKarma ?? null,
      minAccountAgeDays: legacyRules.minAccountAgeDays ?? legacyRules.minAccountAge ?? null,
      verificationRequired: legacyRules.verificationRequired ?? false,
      requiresApproval: legacyRules.requiresApproval ?? false,
    },
    content: {
      sellingPolicy: legacyRules.sellingAllowed,
      watermarksAllowed: legacyRules.watermarksAllowed ?? null,
      promotionalLinks: legacyRules.promotionalLinksAllowed ?? null,
      requiresOriginalContent: legacyRules.requiresOriginalContent ?? false,
      nsfwRequired: legacyRules.nsfwRequired ?? false,
      titleGuidelines: legacyRules.titleRules ?? [],
      contentGuidelines: legacyRules.contentRules ?? [],
      linkRestrictions: [],
      bannedContent: legacyRules.bannedContent ?? [],
      formattingRequirements: legacyRules.formattingRequirements ?? [],
    },
    posting: {
      maxPostsPerDay: legacyRules.maxPostsPerDay ?? null,
      cooldownHours: legacyRules.cooldownHours ?? null,
    },
    notes: legacyRules.notes ?? null,
  };
};
