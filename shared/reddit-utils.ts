import type { LegacyRedditCommunityRuleSet, RedditCommunityRuleSet } from './schema';

const summarizeLegacyNotes = (notes: unknown): string | null => {
  if (notes == null) {
    return null;
  }

  if (typeof notes === 'string') {
    const trimmed = notes.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(notes)) {
    const parts = notes
      .map(entry => {
        if (entry == null) {
          return null;
        }

        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          return trimmed.length > 0 ? trimmed : null;
        }

        try {
          const serialized = JSON.stringify(entry);
          return serialized === 'null' ? null : serialized;
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  if (typeof notes === 'object') {
    try {
      const serialized = JSON.stringify(notes);
      return serialized === '{}' ? null : serialized;
    } catch {
      return null;
    }
  }

  try {
    return JSON.stringify(notes);
  } catch {
    return null;
  }
};

// Helper function to normalize legacy rules to structured rules
export const normalizeRulesToStructured = (
  legacyRules: LegacyRedditCommunityRuleSet | null | undefined
): RedditCommunityRuleSet | null => {
  if (!legacyRules) {
    return null;
  }

  const rawNotes: unknown =
    typeof legacyRules === 'object' && legacyRules !== null
      ? (legacyRules as { notes?: unknown }).notes
      : undefined;

  return {
    eligibility: {
      minKarma: legacyRules.minKarma ?? null,
      minAccountAgeDays: legacyRules.minAccountAgeDays ?? legacyRules.minAccountAge ?? null,
      verificationRequired:
        legacyRules.verificationRequired ?? (legacyRules as { verification?: boolean }).verification ?? false,
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
    notes: summarizeLegacyNotes(rawNotes),
  };
};
