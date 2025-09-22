// Ranking guards utilities for detecting and sanitizing sparkle-filler content

export const HUMAN_CTA = "What do you think?";

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
  /Absolutely stunning/i
];

// Generic hashtags that indicate low-quality content
const GENERIC_HASHTAGS = new Set([
  "#content", "#creative", "#amazing", "#lifestyle",
  "#follow", "#like", "#share", "#viral", "#trending",
  "#awesome", "#incredible", "#mustfollow", "#epic",
  "#mood", "#vibes"
]);

// Canned CTA templates that should be avoided
const CANNED_CTAS = new Set([
  "Check it out", "Click the link", "Don't miss out",
  "Link in comments", "See more", "Find out more",
  "Click here", "Tap the link", "Visit my page"
]);

export function fallbackHashtags(platform?: string): string[] {
  switch (platform) {
    case "instagram":
      return ["#behindthescenes", "#handcrafted", "#maker", "#creator"];
    case "tiktok":
      return ["#niche", "#authentic"];
    case "x":
      return ["#thoughts"];
    case "reddit":
      return []; // Reddit typically doesn't use hashtags
    default:
      return ["#thoughts"];
  }
}

export interface Violation {
  type: "banned_phrase" | "generic_hashtag" | "canned_cta";
  content: string;
  field: "caption" | "hashtags" | "cta";
}

export function detectVariantViolations(variant: any): Violation[] {
  const violations: Violation[] = [];

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
  if (typeof variant.cta === "string" && CANNED_CTAS.has(variant.cta)) {
    violations.push({
      type: "canned_cta",
      content: variant.cta,
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
      case "generic_hashtag":
        summaries.push("replaced generic hashtags");
        break;
      case "canned_cta":
        summaries.push("upgraded canned CTA");
        break;
    }
  }

  return `Ranking sanitization applied: ${summaries.join(", ")}`;
}

export function sanitizeFinalVariant(variant: any, platform?: string): any {
  const sanitized = { ...variant };

  // Sanitize caption if it contains banned phrases
  if (typeof sanitized.caption === "string") {
    let caption = sanitized.caption;
    for (const regex of BANNED_PHRASES) {
      if (regex.test(caption)) {
        caption = "Sharing something I'm genuinely proud of.";
        break;
      }
    }
    sanitized.caption = caption;
  }

  // Sanitize hashtags if they're generic
  if (Array.isArray(sanitized.hashtags)) {
    const hasGeneric = sanitized.hashtags.some((tag: any) => 
      typeof tag === "string" && GENERIC_HASHTAGS.has(tag.toLowerCase())
    );
    if (hasGeneric) {
      sanitized.hashtags = fallbackHashtags(platform);
    }
  }

  // Sanitize CTA if it's canned
  if (typeof sanitized.cta === "string" && CANNED_CTAS.has(sanitized.cta)) {
    sanitized.cta = HUMAN_CTA;
  }

  return sanitized;
}