/**
 * Reddit Rule Auto-Parser
 * Intelligently extracts rules from subreddit descriptions and sidebars
 */

import type { RedditCommunityRuleSet } from '@shared/schema';
import { logger } from '../bootstrap/logger.js';

/**
 * Extract minimum karma requirement from text
 */
function extractMinKarma(text: string): number | null {
  const lowerText = text.toLowerCase();

  // Pattern: "minimum X karma", "X+ karma required", "must have X karma"
  const patterns = [
    /(?:minimum|min|requires?|need|must have)\s+(\d+)\s*(?:\+)?\s*karma/i,
    /(\d+)\s*(?:\+)?\s*karma\s+(?:required|minimum|needed|necessary)/i,
    /karma:\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = lowerText.match(pattern);
    if (match?.[1]) {
      const karma = parseInt(match[1], 10);
      if (karma > 0 && karma < 100000) { // Sanity check
        return karma;
      }
    }
  }

  return null;
}

/**
 * Extract minimum account age in days from text
 */
function extractMinAccountAge(text: string): number | null {
  const lowerText = text.toLowerCase();

  // Pattern: "X days old", "account must be X months old", "X day minimum"
  const dayPatterns = [
    /(?:account|accounts?|must be)\s+(?:at least|minimum|min)?\s*(\d+)\s*(?:day|days)\s*(?:old)?/i,
    /(\d+)\s*(?:day|days)\s*(?:old)?\s+(?:account|minimum|required)/i,
  ];

  const monthPatterns = [
    /(?:account|accounts?|must be)\s+(?:at least|minimum|min)?\s*(\d+)\s*(?:month|months)\s*(?:old)?/i,
    /(\d+)\s*(?:month|months)\s*(?:old)?\s+(?:account|minimum|required)/i,
  ];

  const yearPatterns = [
    /(?:account|accounts?|must be)\s+(?:at least|minimum|min)?\s*(\d+)\s*(?:year|years)\s*(?:old)?/i,
    /(\d+)\s*(?:year|years)\s*(?:old)?\s+(?:account|minimum|required)/i,
  ];

  // Try days first
  for (const pattern of dayPatterns) {
    const match = lowerText.match(pattern);
    if (match?.[1]) {
      const days = parseInt(match[1], 10);
      if (days > 0 && days < 3650) { // Max 10 years
        return days;
      }
    }
  }

  // Try months
  for (const pattern of monthPatterns) {
    const match = lowerText.match(pattern);
    if (match?.[1]) {
      const months = parseInt(match[1], 10);
      if (months > 0 && months < 120) { // Max 10 years
        return months * 30; // Convert to days (approximate)
      }
    }
  }

  // Try years
  for (const pattern of yearPatterns) {
    const match = lowerText.match(pattern);
    if (match?.[1]) {
      const years = parseInt(match[1], 10);
      if (years > 0 && years < 10) {
        return years * 365; // Convert to days
      }
    }
  }

  return null;
}

/**
 * Check if verification is required
 */
function isVerificationRequired(text: string): boolean {
  const lowerText = text.toLowerCase();

  const verificationKeywords = [
    'verification required',
    'must be verified',
    'verified only',
    'verification needed',
    'must verify',
    'verification mandatory',
  ];

  return verificationKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract promotional link policy
 */
function extractPromotionalLinksPolicy(text: string): 'yes' | 'no' | 'limited' | null {
  const lowerText = text.toLowerCase();

  // Check for explicit bans
  const noBans = [
    'no onlyfans',
    'no promotional links',
    'no selling',
    'no promotion',
    'sellers banned',
    'no advertising',
    'no links',
  ];

  if (noBans.some(ban => lowerText.includes(ban))) {
    return 'no';
  }

  // Check for allowed promotions
  const yesAllowed = [
    'promotion allowed',
    'sellers welcome',
    'onlyfans allowed',
    'selling allowed',
  ];

  if (yesAllowed.some(allowed => lowerText.includes(allowed))) {
    return 'yes';
  }

  // Check for limited promotions
  const limitedKeywords = [
    'limited promotion',
    'promotion in comments only',
    'bio only',
    'watermark allowed',
  ];

  if (limitedKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'limited';
  }

  return null;
}

/**
 * Extract banned content/words
 */
function extractBannedContent(text: string): string[] {
  const lowerText = text.toLowerCase();
  const banned: string[] = [];

  // Common payment processors
  const paymentProcessors = ['cashapp', 'venmo', 'paypal', 'zelle'];
  for (const processor of paymentProcessors) {
    if (lowerText.includes(processor) && lowerText.includes('banned') || lowerText.includes('no ' + processor)) {
      banned.push(processor);
    }
  }

  // OF/Fansly variations
  const platforms = [
    { keywords: ['no onlyfans', 'no of.com', 'no of link'], value: 'onlyfans.com' },
    { keywords: ['no fansly'], value: 'fansly.com' },
  ];

  for (const platform of platforms) {
    if (platform.keywords.some(keyword => lowerText.includes(keyword))) {
      banned.push(platform.value);
    }
  }

  return banned;
}

/**
 * Auto-parse rules from subreddit description
 */
export function parseRulesFromDescription(description: string, over18: boolean = false): RedditCommunityRuleSet {
  try {
    const minKarma = extractMinKarma(description);
    const minAccountAgeDays = extractMinAccountAge(description);
    const verificationRequired = isVerificationRequired(description);
    const promotionalLinks = extractPromotionalLinksPolicy(description);
    const bannedContent = extractBannedContent(description);

    const rules: RedditCommunityRuleSet = {
      eligibility: {
        minKarma,
        minAccountAgeDays,
        verificationRequired,
        requiresApproval: false, // Can't auto-detect this
      },
      content: {
        nsfwRequired: over18, // Use subreddit's over18 flag
        promotionalLinks: promotionalLinks ?? undefined,
        watermarksAllowed: null, // Can't auto-detect reliably
        requiresOriginalContent: description.toLowerCase().includes('original content only') ||
                                  description.toLowerCase().includes('oc only'),
        titleGuidelines: [],
        contentGuidelines: [],
        linkRestrictions: bannedContent.length > 0 ? bannedContent : [],
        bannedContent,
        formattingRequirements: [],
      },
      posting: {
        maxPostsPerDay: null, // Can't auto-detect
        cooldownHours: null, // Can't auto-detect
      },
    };

    return rules;
  } catch (error) {
    logger.error('Failed to parse subreddit rules', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Return default rules on error
    return {
      eligibility: {
        minKarma: null,
        minAccountAgeDays: null,
        verificationRequired: false,
        requiresApproval: false,
      },
      content: {
        nsfwRequired: over18,
        promotionalLinks: undefined,
        watermarksAllowed: null,
        requiresOriginalContent: false,
        titleGuidelines: [],
        contentGuidelines: [],
        linkRestrictions: [],
        bannedContent: [],
        formattingRequirements: [],
      },
      posting: {
        maxPostsPerDay: null,
        cooldownHours: null,
      },
    };
  }
}

/**
 * Merge parsed rules with existing rules (existing rules take precedence)
 */
export function mergeRules(
  existing: RedditCommunityRuleSet | null,
  parsed: RedditCommunityRuleSet
): RedditCommunityRuleSet {
  if (!existing) {
    return parsed;
  }

  return {
    eligibility: {
      minKarma: existing.eligibility?.minKarma ?? parsed.eligibility?.minKarma,
      minAccountAgeDays: existing.eligibility?.minAccountAgeDays ?? parsed.eligibility?.minAccountAgeDays,
      verificationRequired: existing.eligibility?.verificationRequired ?? parsed.eligibility?.verificationRequired,
      requiresApproval: existing.eligibility?.requiresApproval ?? parsed.eligibility?.requiresApproval,
    },
    content: {
      nsfwRequired: existing.content?.nsfwRequired ?? parsed.content?.nsfwRequired,
      promotionalLinks: existing.content?.promotionalLinks ?? parsed.content?.promotionalLinks,
      watermarksAllowed: existing.content?.watermarksAllowed ?? parsed.content?.watermarksAllowed,
      requiresOriginalContent: existing.content?.requiresOriginalContent ?? parsed.content?.requiresOriginalContent,
      titleGuidelines: existing.content?.titleGuidelines ?? parsed.content?.titleGuidelines,
      contentGuidelines: existing.content?.contentGuidelines ?? parsed.content?.contentGuidelines,
      linkRestrictions: existing.content?.linkRestrictions ?? parsed.content?.linkRestrictions,
      bannedContent: existing.content?.bannedContent ?? parsed.content?.bannedContent,
      formattingRequirements: existing.content?.formattingRequirements ?? parsed.content?.formattingRequirements,
    },
    posting: {
      maxPostsPerDay: existing.posting?.maxPostsPerDay ?? parsed.posting?.maxPostsPerDay,
      cooldownHours: existing.posting?.cooldownHours ?? parsed.posting?.cooldownHours,
    },
  };
}
