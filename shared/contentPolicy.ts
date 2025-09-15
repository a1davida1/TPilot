import hateTerms from './contentModeration/hateTerms';

interface AllowedContent {
  nsfw: boolean;
  suggestive: boolean;
  explicit: boolean;
  nudity: boolean;
  sexualContent: boolean;
  categories: string[];
}

interface BlockedContent {
  illegal: boolean;
  underage: boolean;
  nonConsensual: boolean;
  revenge: boolean;
  deepfake: boolean;
  violence: boolean;
  selfHarm: boolean;
  animalAbuse: boolean;
  terrorism: boolean;
  spam: boolean;
  malware: boolean;
  phishing: boolean;
  urlShorteners: boolean;
}

interface ValidationRules {
  checkForBlockedContent: boolean;
  blockNSFW: boolean;
  enforceRateLimit: boolean;
  dailyPostLimit: Record<string, number>;
  preventDuplicates: boolean;
  duplicateTimeWindow: number;
}

interface AIGenerationSettings {
  allowNSFWGeneration: boolean;
  safetyLevels: Record<string, { allowed: boolean; emoji: string }>;
  platformStyles: Record<string, { allowExplicit: boolean; defaultEmoji: string; hashtagStyle: string }>;
}

interface PlatformRules {
  requireAgeVerification: boolean;
  minimumAge: number;
  requireContentWarnings: boolean;
  autoWatermark: boolean;
  watermarkText: string;
  dmcaProtection: boolean;
  allowTips: boolean;
  allowSubscriptions: boolean;
  allowPPV: boolean;
}

interface ModerationSettings {
  autoModerate: boolean;
  checkForSpam: boolean;
  checkForHate: boolean;
  checkForScams: boolean;
  checkForNSFW: boolean;
  spamThreshold: number;
  hateThreshold: number;
  requireManualReview: string[];
}

interface ContentPolicy {
  platformType: string;
  allowedContent: AllowedContent;
  blockedContent: BlockedContent;
  validation: ValidationRules;
  aiGeneration: AIGenerationSettings;
  platformRules: PlatformRules;
  moderation: ModerationSettings;
}

interface CategorizationResult {
  isNSFW: boolean;
  isSuggestive: boolean;
  isExplicit: boolean;
  hasViolations: boolean;
  violations: string[];
}

export const CONTENT_POLICY: ContentPolicy = {
  platformType: "adult_content_creation",
  allowedContent: {
    nsfw: true,
    suggestive: true,
    explicit: true,
    nudity: true,
    sexualContent: true,
    categories: ["adult", "nsfw", "suggestive", "explicit"]
  },
  blockedContent: {
    illegal: true,
    underage: true,
    nonConsensual: true,
    revenge: true,
    deepfake: true,
    violence: true,
    selfHarm: true,
    animalAbuse: true,
    terrorism: true,
    spam: true,
    malware: true,
    phishing: true,
    urlShorteners: true
  },
  validation: {
    checkForBlockedContent: true,
    blockNSFW: false, // Allow NSFW content
    enforceRateLimit: true,
    dailyPostLimit: {
      "reddit": 10,
      "twitter": 20,
      "default": 5
    },
    preventDuplicates: true,
    duplicateTimeWindow: 24 * 60 * 60 * 1000 // 24 hours
  },
  aiGeneration: {
    allowNSFWGeneration: true,
    safetyLevels: {
      "safe": { allowed: true, emoji: "😊" },
      "suggestive": { allowed: true, emoji: "😘" },
      "explicit": { allowed: true, emoji: "🔥" }
    },
    platformStyles: {
      "reddit": { allowExplicit: true, defaultEmoji: "🔥", hashtagStyle: "minimal" },
      "twitter": { allowExplicit: false, defaultEmoji: "😘", hashtagStyle: "hashtag" }
    }
  },
  platformRules: {
    requireAgeVerification: true,
    minimumAge: 18,
    requireContentWarnings: true,
    autoWatermark: true,
    watermarkText: "Protected by ThottoPilot™",
    dmcaProtection: true,
    allowTips: true,
    allowSubscriptions: true,
    allowPPV: true
  },
  moderation: {
    autoModerate: true,
    checkForSpam: true,
    checkForHate: true,
    checkForScams: true,
    checkForNSFW: false, // Don't block NSFW
    spamThreshold: 0.7,
    hateThreshold: 0.8,
    requireManualReview: ["violence", "underage", "nonConsensual"]
  }
};

export function categorizeContent(content: string) {
  const lower = content.toLowerCase();

  return {
    isNSFW: checkNSFW(lower),
    isSuggestive: checkSuggestive(lower),
    isExplicit: checkExplicit(lower),
    hasViolations: checkViolations(lower),
    violations: getViolations(lower)
  } as CategorizationResult;
}

function checkNSFW(content: string): boolean {
  const nsfwTerms = ['nude', 'naked', 'topless', 'sexy', 'hot', 'adult'];
  return nsfwTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(content));
}

function checkSuggestive(content: string): boolean {
  const suggestiveTerms = ['tease', 'peek', 'preview', 'exclusive', 'spicy'];
  return suggestiveTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(content));
}

function checkExplicit(content: string): boolean {
  const explicitTerms = ['xxx', 'explicit', 'uncensored', 'full'];
  return explicitTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(content));
}

function checkViolations(content: string): boolean {
  return getViolations(content).length > 0;
}

function getViolations(content: string): string[] {
  const violations: string[] = [];

  // Check for spam indicators (common URL shorteners)
  if (/\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl)\b/.test(content)) {
    violations.push('url_shortener');
  }

  // Check for potential scams
  if (content.includes('get rich quick') || content.includes('guaranteed money')) {
    violations.push('potential_scam');
  }

  // Check for hate speech
  if (hateTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(content))) {
    violations.push('hate_speech');
  }

  // NOTE: We do NOT add violations for NSFW/adult content
  return violations;
}