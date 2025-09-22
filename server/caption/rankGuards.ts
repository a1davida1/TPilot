// Ranking guards utilities for detecting and sanitizing sparkle-filler content
import { variantContainsBannedWord, replaceBannedWords, containsBannedWord } from "./bannedWords";

export const HUMAN_CTA = "What do you think?";

const CTA_EDGE_PUNCTUATION = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;

function normalizeCTA(value: string): string {
  return value
    .trim()
    .replace(CTA_EDGE_PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Banned sparkle-filler phrases that should be detected and replaced
const BANNED_PHRASES = [
  /Check out this amazing content/i,
  /✨ Enhanced/i,
  /Amazing content/i,
  /Check it out/i,
  /Click the link/i,
  /Don't miss out/i,
  /You won't believe/i,
  /This is incredible/i,
  /Must see/i,
  /Absolutely stunning/i,
  /✨/,  // Any sparkle emojis
  /🌟/,  // Star emojis
  /⭐/   // Star emojis
];

// Generic hashtags that indicate low-quality content
const GENERIC_HASHTAGS = new Set([
  "#content", "#creative", "#amazing", "#lifestyle",
  "#follow", "#like", "#share", "#viral", "#trending",
  "#awesome", "#incredible", "#mustfollow", "#epic",
  "#mood", "#vibes"
]);

// Canned CTA templates that should be avoided
const RAW_CANNED_CTAS = [
  "Check it out", "Click the link", "Don't miss out",
  "Link in comments", "See more", "Find out more",
  "Click here", "Tap the link", "Visit my page",
  "Link in bio", "Link in bio!", "Link in bio!!", "Link in bio!!!",
  "Link in bio.", "Link in bio...", "Link in bio?",
  "Link in bio for more!", "Link in bio for more", "Link in bio for more!!",
  "Learn more", "Follow for more", "Link in profile",
  "Link in page", "Swipe up", "Check my bio"
];

const CANNED_CTAS = new Set(RAW_CANNED_CTAS.map(normalizeCTA));

function isCannedCTA(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizeCTA(value);
  if (!normalized) return false;
  return CANNED_CTAS.has(normalized);
}

export function fallbackHashtags(platform?: string): string[] {
  switch (platform) {
    case "instagram":
      return ["#behindthescenes", "#handcrafted", "#maker", "#creator"];
    case "tiktok":
      return ["#niche", "#authentic"];
    case "x":
      return ["#thoughts"];
    case "reddit":
      return ["community insights"]; // Reddit descriptive labels instead of hashtags
    default:
      return ["#thoughts"];
  }
}

export interface Violation {
  type: "banned_phrase" | "generic_hashtag" | "canned_cta" | "banned_word";
  content: string;
  field: "caption" | "hashtags" | "cta";
}

export function detectVariantViolations(variant: any): Violation[] {
  const violations: Violation[] = [];

  // Check for banned words first
  if (variantContainsBannedWord(variant)) {
    violations.push({
      type: "banned_word",
      content: variant.caption || "",
      field: "caption"
    });
  }

  // Check caption for banned phrases
  if (typeof variant.caption === "string") {
    for (const regex of BANNED_PHRASES) {
      if (regex.test(variant.caption)) {
        violations.push({
          type: "banned_phrase",
          content: variant.caption,
          field: "caption"
        });
        break; // One violation per field is enough
      }
    }
  }

  // Check hashtags for generic content
  if (Array.isArray(variant.hashtags)) {
    const genericFound = variant.hashtags.some((tag: any) => 
      typeof tag === "string" && GENERIC_HASHTAGS.has(tag.toLowerCase())
    );
    if (genericFound) {
      violations.push({
        type: "generic_hashtag",
        content: variant.hashtags.join(" "),
        field: "hashtags"
      });
    }
  }

  // Check CTA for canned templates
  if (isCannedCTA(variant.cta)) {
    violations.push({
      type: "canned_cta",
      content: String(variant.cta),
      field: "cta"
    });
  }

  return violations;
}

export function buildRerankHint(violations: Violation[]): string {
  const hints: string[] = [];

  for (const violation of violations) {
    switch (violation.type) {
      case "banned_phrase":
        hints.push("avoid sparkle-filler phrases like 'Check out this amazing content'");
        break;
      case "generic_hashtag":
        hints.push("use specific, authentic hashtags instead of generic ones like #content #creative #amazing");
        break;
      case "canned_cta":
        hints.push("create unique calls-to-action instead of templates like 'Check it out'");
        break;
      case "banned_word":
        hints.push("avoid banned words (ai, ai-generated, content)");
        break;
    }
  }

  return hints.length > 0 
    ? `Previous selection had issues: ${hints.join(", ")}. Choose options with authentic, human-sounding content.`
    : "";
}

export function formatViolationSummary(violations: Violation[]): string {
  if (violations.length === 0) return "";

  const summaries: string[] = [];
  
  for (const violation of violations) {
    switch (violation.type) {
      case "banned_phrase":
        summaries.push("sanitized sparkle-filler caption");
        break;
      case "banned_word":
        summaries.push("removed banned words");
        break;
      case "generic_hashtag":
        summaries.push("replaced generic hashtags");
        break;
      case "canned_cta":
        summaries.push("upgraded canned CTA");
        break;
    }
  }

  return `Sanitized: ${summaries.join(", ")}`;
}

export function sanitizeFinalVariant(variant: any, platform?: string): any {
  const sanitized = { ...variant };

  // Sanitize caption for banned words first
  if (typeof sanitized.caption === "string") {
    if (containsBannedWord(sanitized.caption)) {
      sanitized.caption = replaceBannedWords(sanitized.caption);
      if (!sanitized.caption || sanitized.caption.trim().length === 0) {
        sanitized.caption = "Sharing something I'm genuinely proud of.";
      }
    }
  }

  // Sanitize caption if it contains banned phrases  
  if (typeof sanitized.caption === "string") {
    for (const regex of BANNED_PHRASES) {
      if (regex.test(sanitized.caption)) {
        sanitized.caption = "Sharing something I'm genuinely proud of.";
        break;
      }
    }
  }

  // Sanitize CTA - check if it's canned after normalization
  if (isCannedCTA(sanitized.cta)) {
    sanitized.cta = HUMAN_CTA;
  }
  
  // Sanitize CTA for banned words
  if (typeof sanitized.cta === "string") {
    if (containsBannedWord(sanitized.cta)) {
      sanitized.cta = replaceBannedWords(sanitized.cta);
      if (!sanitized.cta || sanitized.cta.trim().length === 0) {
        sanitized.cta = HUMAN_CTA;
      }
    }
  }

  // Sanitize alt text for banned words and ensure it's always present
  if (typeof sanitized.alt === "string") {
    if (containsBannedWord(sanitized.alt)) {
      sanitized.alt = replaceBannedWords(sanitized.alt);
      if (!sanitized.alt || sanitized.alt.trim().length < 20) {
        sanitized.alt = "Descriptive photo for the post";
      }
    }
  } else if (!sanitized.alt) {
    // Ensure alt is always present, even if not originally provided
    sanitized.alt = "Descriptive photo for the post";
  }

  // Enhanced hashtag sanitization with platform-specific rules
  if (Array.isArray(sanitized.hashtags)) {
    // Filter out banned words and generic hashtags
    let cleanedHashtags = sanitized.hashtags
      .filter((tag: any) => typeof tag === "string" && !containsBannedWord(tag))
      .filter((tag: any) => !GENERIC_HASHTAGS.has(tag.toLowerCase()));
    
    // Reddit special case: strip leading # from descriptive labels
    if (platform === 'reddit') {
      cleanedHashtags = cleanedHashtags.map((tag: string) => 
        tag.startsWith('#') ? tag.substring(1) : tag
      );
    }
    
    // Apply platform-specific hashtag limits after cleaning
    if (platform === 'x' && cleanedHashtags.length > 3) {
      cleanedHashtags = cleanedHashtags.slice(0, 3);
    } else if (platform === 'reddit' && cleanedHashtags.length > 1) {
      cleanedHashtags = cleanedHashtags.slice(0, 1);
    }
    // Instagram and TikTok: no limit enforced
    
    // Enforce minimum requirements or fall back
    const fallback = fallbackHashtags(platform);
    const minRequired = platform === 'reddit' ? 1 : 1; // At least 1 hashtag or label
    
    if (cleanedHashtags.length < minRequired) {
      sanitized.hashtags = fallback;
    } else {
      sanitized.hashtags = cleanedHashtags;
    }
  } else {
    // No hashtags provided, use fallback
    sanitized.hashtags = fallbackHashtags(platform);
  }

  return sanitized;
}