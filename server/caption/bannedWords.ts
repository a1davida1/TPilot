export const BANNED_WORDS = [
  "ai",
  "ai-generated",
  "content"
] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const bannedPattern = new RegExp(`\\b(?:${BANNED_WORDS.map(escapeRegExp).join("|")})\\b`, "i");

export const BANNED_WORDS_HINT = `Avoid banned words: ${BANNED_WORDS.join(", ")}`;

export function containsBannedWord(text: unknown): boolean {
  if (typeof text !== "string" || text.trim().length === 0) return false;
  return bannedPattern.test(text);
}

export function variantContainsBannedWord(variant: {
  caption?: unknown;
  cta?: unknown;
  hashtags?: unknown;
}): boolean {
  if (!variant) return false;
  if (containsBannedWord(variant.caption)) return true;
  if (containsBannedWord(variant.cta)) return true;
  if (Array.isArray(variant.hashtags)) {
    return variant.hashtags.some(tag => containsBannedWord(tag));
  }
  return false;
}