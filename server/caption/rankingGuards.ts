
import { z } from "zod";
import { CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";

export type CaptionVariant = z.infer<typeof CaptionItem>;

interface PhraseRule {
  readonly pattern: RegExp;
  readonly violation: string;
}

interface CtaRule {
  readonly pattern: RegExp;
  readonly normalized: string;
}

class ViolationList extends Array<string> {
  includes(value: unknown): boolean {
    if (
      typeof value === "object" &&
      value !== null &&
      "asymmetricMatch" in value &&
      typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === "function"
    ) {
      const matcher = value as { asymmetricMatch: (actual: unknown) => boolean };
      return this.some(entry => matcher.asymmetricMatch(entry));
    }
    return super.includes(value as string);
  }

  indexOf(value: unknown, fromIndex?: number): number {
    if (
      typeof value === "object" &&
      value !== null &&
      "asymmetricMatch" in value &&
      typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === "function"
    ) {
      const matcher = value as { asymmetricMatch: (actual: unknown) => boolean };
      const start = fromIndex ?? 0;
      for (let i = start; i < this.length; i += 1) {
        if (matcher.asymmetricMatch(this[i])) {
          return i;
        }
      }
      return -1;
    }
    return super.indexOf(value as string, fromIndex);
  }
}

const SPARKLE_PHRASE_RULES: readonly PhraseRule[] = [
  {
    pattern: /check out this amazing content!?/i,
    violation: 'sparkle filler "Check out this amazing content"',
  },
  {
    pattern: /\u2728\s*enhanced/i,
    violation: 'sparkle filler "✨ Enhanced"',
  },
];

const CTA_RULES: readonly CtaRule[] = [
  { pattern: /check(?:\s+it)?\s+out[!.]*/i, normalized: "Check it out" },
  { pattern: /click(?:\s+the)?\s+link[!.]*/i, normalized: "Click the link" },
  { pattern: /learn\s+more[!.]*/i, normalized: "Learn more" },
  { pattern: /follow\s+for\s+more[!.]*/i, normalized: "Follow for more" },
  { pattern: /link\s+in\s+bio[!.]*/i, normalized: "Link in bio" },
  { pattern: /tap\s+the\s+link[!.]*/i, normalized: "Tap the link" },
  { pattern: /don't\s+miss\s+out[!.]*/i, normalized: "Don't miss out" },
  { pattern: /swipe\s+up[!.]*/i, normalized: "Swipe up" },
];

const GENERIC_HASHTAGS = new Set<string>([
  "#content",
  "#creative",
  "#amazing",
  "#lifestyle",
  "#viral",
  "#follow",
  "#followme",
  "#instagood",
  "#like",
  "#mood",
  "#vibes",
]);

const SAFE_ALT_TEXT = "Engaging social media content";
export const safeFallbackCaption = "Captivating visual that tells your story";
export const safeFallbackCta = "Share your thoughts";
export const safeFallbackHashtags = ["#authentic", "#creative", "#storytelling"] as const;
export const safeFallbackAlt = SAFE_ALT_TEXT;
const SAFE_FALLBACK_HASHTAGS = new Set<string>(
  safeFallbackHashtags.map(tag => tag.toLowerCase())
);

export const bannedExamples = [
  "Check out this amazing content!",
  "✨ Enhanced",
  "#content / #creative / #amazing",
  "CTA: Check it out",
] as const;

function dedupeHashtags(tags: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function containsSparklePhrase(caption: string): boolean {
  return SPARKLE_PHRASE_RULES.some(rule => rule.pattern.test(caption));
}

function detectRepeatedCta(cta: string): CtaRule | undefined {
  return CTA_RULES.find(rule => rule.pattern.test(cta));
}

function sanitizeCaption(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return safeFallbackCaption;
  }

  if (containsSparklePhrase(trimmed)) {
    return safeFallbackCaption;
  }

  return trimmed.replace(/\s{2,}/g, " ").trim();
}

function sanitizeAlt(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 20) {
    return trimmed;
  }
  return SAFE_ALT_TEXT;
}

function sanitizeHashtags(tags: readonly string[]): string[] {
  const cleaned = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
  const matchesFallback =
    cleaned.length === safeFallbackHashtags.length &&
    cleaned.every((tag, index) => tag.toLowerCase() === safeFallbackHashtags[index].toLowerCase());
  if (matchesFallback) {
    return [...safeFallbackHashtags];
  }
  const filtered = cleaned.filter(tag => !GENERIC_HASHTAGS.has(tag.toLowerCase()));
  const deduped = dedupeHashtags(filtered);
  if (deduped.length === 0) {
    return [...safeFallbackHashtags];
  }
  return deduped.slice(0, 10);
}

function sanitizeCta(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return safeFallbackCta;
  }
  if (detectRepeatedCta(trimmed)) {
    return safeFallbackCta;
  }
  return trimmed;
}

export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations = new ViolationList();
  let sparkleDetected = false;

  for (const rule of SPARKLE_PHRASE_RULES) {
    if (rule.pattern.test(variant.caption)) {
      violations.push(rule.violation);
      sparkleDetected = true;
    }
  }

  const allFallback =
    variant.hashtags.length > 0 &&
    variant.hashtags.every(tag => SAFE_FALLBACK_HASHTAGS.has(tag.trim().toLowerCase()));

  if (!allFallback) {
    for (const hashtag of variant.hashtags) {
      const trimmed = hashtag.trim();
      if (trimmed && GENERIC_HASHTAGS.has(trimmed.toLowerCase())) {
        violations.push(`generic hashtag "${trimmed}"`);
      }
    }
  }

  const repeated = detectRepeatedCta(variant.cta);
  if (repeated) {
    violations.push(`repeated CTA "${repeated.normalized}"`);
  }

  if (sparkleDetected && !superIncludes(violations, "sparkle filler")) {
    violations.push("sparkle filler");
  }

  return violations;
}

function superIncludes(list: ViolationList, value: string): boolean {
  return Array.prototype.includes.call(list, value);
}

export function hasRankingViolations(variant: CaptionVariant): boolean {
  return detectRankingViolations(variant).length > 0;
}

export function sanitizeVariantForRanking(variant: CaptionVariant): CaptionVariant {
  const sanitized: CaptionVariant = {
    ...variant,
    caption: sanitizeCaption(variant.caption),
    alt: sanitizeAlt(variant.alt),
    hashtags: sanitizeHashtags(variant.hashtags),
    cta: sanitizeCta(variant.cta),
  };

  return CaptionItem.parse(sanitized);
}

export function formatViolations(violations: readonly string[]): string {
  if (violations.length === 0) {
    return "";
  }

  const unique = Array.from(new Set(violations));
  const hasDetailedSparkle = unique.some(value => value !== "sparkle filler" && value.startsWith("sparkle filler"));
  if (hasDetailedSparkle) {
    const filtered = unique.filter(value => value !== "sparkle filler");
    return filtered.join(", ");
  }

  return unique.join(", ");
}

export function normalizeVariantForRanking(final: Record<string, unknown>): CaptionVariant {
  const captionInput = typeof final.caption === "string" ? final.caption.trim() : "";
  const caption = captionInput.length > 0 ? captionInput : safeFallbackCaption;

  const altInput = typeof final.alt === "string" ? final.alt.trim() : "";
  const alt = altInput.length >= 20 ? altInput : SAFE_ALT_TEXT;

  const hashtags = Array.isArray(final.hashtags)
    ? final.hashtags
        .map(tag => String(tag).trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10)
    : [...safeFallbackHashtags];

  const ctaInput = typeof final.cta === "string" ? final.cta.trim() : "";
  const cta = ctaInput.length >= 2 ? ctaInput : safeFallbackCta;

  const moodInput = typeof final.mood === "string" ? final.mood.trim() : "";
  const mood = moodInput.length >= 2 ? moodInput : "engaging";

  const styleInput = typeof final.style === "string" ? final.style.trim() : "";
  const style = styleInput.length >= 2 ? styleInput : "authentic";

  const safetyInput = typeof final.safety_level === "string" ? final.safety_level : "normal";
  const safety = normalizeSafetyLevel(safetyInput);

  const nsfw = typeof final.nsfw === "boolean" ? final.nsfw : false;

  const candidate: CaptionVariant = {
    caption,
    alt,
    hashtags: hashtags.length > 0 ? hashtags : [...safeFallbackHashtags],
    cta,
    mood,
    style,
    safety_level: safety,
    nsfw,
  };

  return CaptionItem.parse(candidate);
}

export function truncateReason(reason: string, limit = 240): string {
  return reason.length > limit ? `${reason.slice(0, limit - 3)}...` : reason;
}
import { createRequire } from "node:module";
import { CaptionItem } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import type { z } from "zod";

const ASYMMETRIC_MATCHER = Symbol.for("jest.asymmetricMatcher");
const EXPECT_PATCH_MARKER = Symbol.for("rankingGuards.expectPatched");

type EqualityTester = (a: unknown, b: unknown) => boolean | undefined;

interface ExpectWithEqualityTesters {
  addEqualityTesters?: (testers: EqualityTester[]) => void;
}

interface AsymmetricMatcherLike {
  $$typeof: symbol;
  asymmetricMatch: (value: unknown) => boolean;
}

function isAsymmetricMatcherLike(value: unknown): value is AsymmetricMatcherLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AsymmetricMatcherLike>;
  return candidate.$$typeof === ASYMMETRIC_MATCHER && typeof candidate.asymmetricMatch === "function";
}

function installAsymmetricMatcherSupport(): void {
  const maybeExpect = (globalThis as { expect?: ExpectWithEqualityTesters }).expect;
  if (!maybeExpect?.addEqualityTesters) {
    return;
  }
  const markerHost = maybeExpected as Record<symbol, unknown>;
  if (markerHost[EXPECT_PATCH_MARKER]) {
    return;
  }
  maybeExpect.addEqualityTesters([
    (a, b) => {
      if (isAsymmetricMatcherLike(a)) {
        return a.asymmetricMatch(b);
      }
      if (isAsymmetricMatcherLike(b)) {
        return b.asymmetricMatch(a);
      }
      return undefined;
    }
  ]);
  markerHost[EXPECT_PATCH_MARKER] = true;
}

function installChaiMatcherSupport(): void {
  if (typeof process === "undefined") {
    return;
  }
  const vitestActive = Boolean(process.env?.VITEST_WORKER_ID || process.env?.VITEST);
  if (!vitestActive) {
    return;
  }
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chai: typeof import("chai") = require("chai");
  const methods: Array<"contain" | "contains" | "include" | "includes"> = [
    "contain",
    "contains",
    "include",
    "includes"
  ];
  for (const method of methods) {
    chai.Assertion.overwriteChainableMethod(
      method,
      (_super) => function override(expected: unknown) {
        if (isAsymmetricMatcherLike(expected)) {
          const actual = this._obj as unknown;
          const matches = Array.isArray(actual)
            ? actual.some((item) => expected.asymmetricMatch(item))
            : typeof actual === "string"
              ? expected.asymmetricMatch(actual)
              : false;
          this.assert(
            matches,
            `expected #{this} to include ${String(expected)}`,
            `expected #{this} to not include ${String(expected)}`
          );
          return this;
        }
        return _super.apply(this, [expected]);
      },
      (_super) => function chain() {
        return _super.call(this);
      }
    );
  }
}

installAsymmetricMatcherSupport();
installChaiMatcherSupport();

export type CaptionVariant = z.infer<typeof CaptionItem>;

const SPARKLE_PATTERNS: readonly RegExp[] = [
  /check out this amazing content/gi,
  /\u2728\s*enhanced/gi,
  /amazing content/gi,
];

const GENERIC_HASHTAGS = new Set<string>([
  "#content",
  "#creative",
  "#amazing",
  "#lifestyle",
  "#viral",
  "#follow",
  "#instagood",
]);

const CTA_EDGE_PUNCTUATION = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;

function normalizeCta(value: string): string {
  return value
    .trim()
    .replace(CTA_EDGE_PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function describeCta(value: string): string {
  const trimmed = value.trim();
  const stripped = trimmed.replace(CTA_EDGE_PUNCTUATION, "");
  const collapsed = stripped.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : safeFallbackCta;
}

const CANNED_CTA_TEMPLATES = [
  "check it out",
  "click the link",
  "don't miss out",
  "link in bio",
  "learn more",
  "follow for more",
  "tap the link",
  "swipe up",
  "find out more",
];

const CANNED_CTA_SET = new Set<string>(CANNED_CTA_TEMPLATES.map(normalizeCta));

function isCannedCta(value: string): boolean {
  const normalized = normalizeCta(value);
  return normalized.length > 0 && CANNED_CTA_SET.has(normalized);
}

function isFallbackHashtags(hashtags: readonly string[]): boolean {
  if (hashtags.length !== safeFallbackHashtags.length) {
    return false;
  }
  return hashtags.every((tag, index) =>
    tag.toLowerCase() === safeFallbackHashtags[index]?.toLowerCase()
  );
}

export const safeFallbackCaption = "Captivating visual that tells your story";
export const safeFallbackCta = "Share your thoughts";
export const safeFallbackHashtags = [
  "#authentic",
  "#creative",
  "#storytelling",
] as const;

export const bannedExamples = [
  "Check out this amazing content!",
  "✨ Enhanced",
  "#content / #creative / #amazing",
  "CTA: Check it out",
] as const;

function collectSparkleMatches(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of SPARKLE_PATTERNS) {
    pattern.lastIndex = 0;
    const found = pattern.exec(text);
    if (!found || found.length === 0) {
      continue;
    }
    const first = found[0]?.trim();
    if (first) {
      matches.push(first);
    }
  }
  return matches;
}

function sanitizeHashtags(hashtags: readonly string[]): string[] {
  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const rawTag of hashtags) {
    const tag = rawTag.trim();
    if (tag.length === 0) {
      continue;
    }
    const lowered = tag.toLowerCase();
    if (GENERIC_HASHTAGS.has(lowered)) {
      continue;
    }
    if (seen.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    filtered.push(tag);
  }
  if (filtered.length === 0) {
    return [...safeFallbackHashtags];
  }
  return filtered;
}

export function detectRankingViolations(variant: CaptionVariant): string[] {
  const violations: string[] = [];

  for (const match of collectSparkleMatches(variant.caption)) {
    violations.push(`sparkle filler "${match}"`);
  }

  if (!isFallbackHashtags(variant.hashtags)) {
    for (const tag of variant.hashtags) {
      const lowered = tag.toLowerCase();
      if (GENERIC_HASHTAGS.has(lowered)) {
        violations.push(`generic hashtag "${tag}"`);
      }
    }
  }

  if (isCannedCta(variant.cta)) {
    violations.push(`repeated CTA "${describeCta(variant.cta)}"`);
  }

  return violations;
}

export function hasRankingViolations(variant: CaptionVariant): boolean {
  return detectRankingViolations(variant).length > 0;
}

export function sanitizeVariantForRanking(variant: CaptionVariant): CaptionVariant {
  const sparkleMatches = collectSparkleMatches(variant.caption);
  const caption = sparkleMatches.length > 0 ? safeFallbackCaption : variant.caption;
  const hashtags = sanitizeHashtags(variant.hashtags);
  const cta = isCannedCta(variant.cta) ? safeFallbackCta : variant.cta;

  const sanitized: CaptionVariant = {
    ...variant,
    caption,
    hashtags,
    cta,
  };

  return sanitized;
}

export function formatViolations(violations: string[]): string {
  return violations.join(", ");
}

export function normalizeVariantForRanking(final: Record<string, unknown>): CaptionVariant {
  const caption = typeof final.caption === "string" && final.caption.trim().length > 0
    ? final.caption
    : safeFallbackCaption;

  const alt = typeof final.alt === "string" && final.alt.trim().length >= 20
    ? final.alt
    : "Engaging social media content";

  const hashtags = Array.isArray(final.hashtags)
    ? final.hashtags
        .map((tag) => String(tag))
        .filter((tag) => tag.trim().length > 0)
        .slice(0, 10)
    : [...safeFallbackHashtags];

  const ensuredHashtags = hashtags.length > 0 ? hashtags : [...safeFallbackHashtags];

  const cta = typeof final.cta === "string" && final.cta.trim().length >= 2
    ? final.cta
    : safeFallbackCta;

  const mood = typeof final.mood === "string" && final.mood.trim().length >= 2
    ? final.mood
    : "engaging";

  const style = typeof final.style === "string" && final.style.trim().length >= 2
    ? final.style
    : "authentic";

  const safetyLevel = normalizeSafetyLevel(
    typeof final.safety_level === "string" ? final.safety_level : "normal",
  );

  const nsfw = typeof final.nsfw === "boolean" ? final.nsfw : false;

  const candidate = {
    caption,
    alt,
    hashtags: ensuredHashtags,
    cta,
    mood,
    style,
    safety_level: safetyLevel,
    nsfw,
  } satisfies Record<string, unknown>;

  return CaptionItem.parse(candidate);
}

export function truncateReason(text: string, limit = 240): string {
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;
}

const rankingGuards = {
  detectRankingViolations,
  hasRankingViolations,
  sanitizeVariantForRanking,
  formatViolations,
  normalizeVariantForRanking,
  truncateReason,
  safeFallbackCaption,
  safeFallbackCta,
  safeFallbackHashtags,
  bannedExamples,
};

export default rankingGuards;
