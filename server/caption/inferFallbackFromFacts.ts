import { z } from "zod";

type Platform = "instagram" | "x" | "reddit" | "tiktok";

export interface FallbackInferenceInput {
  platform: Platform;
  facts?: Record<string, unknown>;
  existingCaption?: string;
  theme?: string;
  context?: string;
  includeHashtags?: boolean;
}

export interface FallbackInferenceResult {
  hashtags: string[];
  cta: string;
  alt: string;
}

const PLATFORM_HASHTAG_RULES: Record<Platform, { min: number; max: number; prefix: "#" | ""; filler: string[] }> = {
  instagram: { min: 3, max: 8, prefix: "#", filler: ["creatorspotlight", "dailyvibes", "socialstory", "behindthescenes"] },
  x: { min: 1, max: 3, prefix: "#", filler: ["trendwatch", "nowplaying", "dailyupdate"] },
  reddit: { min: 1, max: 3, prefix: "", filler: ["community insights", "open discussion", "deep dive"] },
  tiktok: { min: 2, max: 5, prefix: "#", filler: ["fypfinds", "mustwatch", "trendalert", "creatorlife"] }
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "your", "about", "into", "will", "would", "their",
  "there", "been", "were", "just", "like", "over", "make", "made", "after", "before", "while", "where", "which",
  "ever", "every", "other", "such", "very", "more", "than", "some", "only", "when", "then", "them", "they",
  "because", "across", "through", "without", "among", "between", "around", "under", "above", "within", "beyond",
  "again", "those", "these", "also", "into", "onto", "plus", "minus", "its", "it's", "ours", "yours", "hers",
  "his", "ourselves", "themselves", "myself", "yourself", "ourselves", "himself", "herself", "itself", "ours",
  "yourselves", "ourselves", "nsfw", "safe", "level", "image", "photo", "picture", "caption", "post"
]);

const KEY_EXCLUSIONS = new Set(["nsfw", "safety", "safety_level", "image", "photo", "metadata", "caption"]);

const sentenceSchema = z.string().min(1);

function sanitizePhrase(input: string): string {
  const trimmed = sentenceSchema.safeParse(input).success ? input : "";
  return trimmed
    .replace(/[#@]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}0-9\s-]/gu, " ")
    .trim();
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const sanitized = sanitizePhrase(value).toLowerCase();
    if (!sanitized || seen.has(sanitized)) continue;
    seen.add(sanitized);
    result.push(value.trim());
  }
  return result;
}

type FactValue = string | number | boolean | null | undefined | unknown[] | Record<string, unknown>;

function flattenFacts(facts?: Record<string, unknown>): string[] {
  if (!facts) return [];
  const phrases: string[] = [];
  const stack: Array<{ key?: string; value: FactValue }> = [];
  for (const [key, value] of Object.entries(facts)) {
    stack.push({ key, value: value as FactValue });
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const { key, value } = current;

    if (typeof value === "string") {
      phrases.push(value);
      if (key && !KEY_EXCLUSIONS.has(key.toLowerCase())) {
        phrases.push(key.replace(/_/g, " "));
      }
    } else if (typeof value === "number") {
      phrases.push(value.toString());
      if (key && !KEY_EXCLUSIONS.has(key.toLowerCase())) {
        phrases.push(key.replace(/_/g, " "));
      }
    } else if (typeof value === "boolean") {
      if (value && key && !KEY_EXCLUSIONS.has(key.toLowerCase())) {
        phrases.push(key.replace(/_/g, " "));
      }
    } else if (Array.isArray(value)) {
      value.forEach(item => stack.push({ key, value: item as FactValue }));
    } else if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value as Record<string, FactValue>);
      entries.forEach(([nestedKey, nestedValue]) => {
        stack.push({ key: nestedKey, value: nestedValue });
      });
    }
  }
  return dedupePreserveOrder(phrases);
}

function extractKeywords(texts: string[]): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    const sanitized = sanitizePhrase(text).toLowerCase();
    if (!sanitized) continue;
    const tokens = sanitized.match(/[a-z0-9][a-z0-9\-']+/g);
    if (!tokens) continue;

    for (const token of tokens) {
      const word = token.replace(/['-]/g, "");
      if (word.length < 3) continue;
      if (STOPWORDS.has(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      keywords.push(word);
    }
  }

  return keywords;
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildHashtags(
  platform: Platform,
  primaryKeywords: string[],
  phraseSources: string[],
  supplementalKeywords: string[]
): string[] {
  const { min, max, prefix, filler } = PLATFORM_HASHTAG_RULES[platform];
  const tags: string[] = [];
  const seen = new Set<string>();

  const addTag = (raw: string) => {
    const sanitized = sanitizePhrase(raw).toLowerCase();
    if (!sanitized) return;
    const canonical = prefix === "#" ? `#${sanitized.replace(/\s+/g, "")}` : sanitized.replace(/\s+/g, " ");
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    tags.push(canonical);
  };

  primaryKeywords.forEach(keyword => {
    if (tags.length >= max) return;
    addTag(keyword);
  });

  for (const phrase of phraseSources) {
    if (tags.length >= max) break;
    const cleaned = sanitizePhrase(phrase).toLowerCase();
    if (!cleaned) continue;
    const words = cleaned.split(/\s+/).filter(word => word && !STOPWORDS.has(word));
    if (words.length === 0) continue;
    if (prefix === "#") {
      addTag(words.slice(0, 2).join(""));
    } else {
      addTag(words.slice(0, 3).join(" "));
    }
  }

  supplementalKeywords.forEach(keyword => {
    if (tags.length >= max) return;
    addTag(keyword);
  });

  filler.forEach(keyword => {
    if (tags.length >= max) return;
    addTag(keyword);
  });

  while (tags.length < min) {
    addTag(prefix === "#" ? "socialupdate" : "community spotlight");
    if (tags.length >= min) break;
    addTag(prefix === "#" ? "trendwatch" : "deep dive");
    if (tags.length >= min) break;
  }

  return tags.slice(0, max);
}

function buildCTA(
  platform: Platform,
  prioritizedKeywords: string[],
  themeKeywords: string[],
  captionKeywords: string[],
  theme?: string,
  existingCaption?: string
): string {
  const topicWords = prioritizedKeywords.length > 0
    ? prioritizedKeywords
    : (themeKeywords.length > 0
      ? themeKeywords
      : captionKeywords);

  const topic = topicWords.slice(0, 2).join(" ");
  const readableTopic = topic ? toTitleCase(topic) : undefined;

  switch (platform) {
    case "instagram":
      return readableTopic ? `Tap to explore ${readableTopic}` : "Tap to see the full story";
    case "x":
      return readableTopic ? `Join the ${readableTopic} conversation` : "Join the conversation";
    case "tiktok":
      return readableTopic ? `Follow for more ${readableTopic}` : "Follow for more moments";
    case "reddit":
      return readableTopic ? `Share your ${readableTopic} take` : "Share your thoughts with the community";
    default:
      return existingCaption || theme || "Discover more";
  }
}

function buildAlt(
  platform: Platform,
  factPhrases: string[],
  themePhrases: string[],
  captionPhrases: string[],
  keywords: string[],
  theme?: string,
  existingCaption?: string
): string {
  const descriptorSources = factPhrases.length > 0
    ? factPhrases
    : (themePhrases.length > 0 ? themePhrases : captionPhrases);

  const descriptors = dedupePreserveOrder(descriptorSources)
    .map(sanitizePhrase)
    .filter(Boolean)
    .slice(0, 4);

  let alt: string;
  if (descriptors.length > 0) {
    alt = `Scene featuring ${descriptors.join(", ")}.`;
  } else if (keywords.length > 0) {
    alt = `Story focusing on ${keywords.slice(0, 3).join(", ")}.`;
  } else if (theme) {
    alt = `Visual representation of ${sanitizePhrase(theme)}.`;
  } else if (existingCaption) {
    alt = `Illustration supporting the caption: ${sanitizePhrase(existingCaption)}.`;
  } else {
    alt = `Engaging social media content tailored for ${platform}.`;
  }

  if (alt.length < 20) {
    alt = `${alt} Detailed social media moment.`;
  }

  if (alt.length > 200) {
    alt = `${alt.slice(0, 197).replace(/[.,]?\s*$/, "")}...`;
  }

  return alt;
}

export function inferFallbackFromFacts(input: FallbackInferenceInput): FallbackInferenceResult {
  const factPhrases = flattenFacts(input.facts);
  const themePhrases = input.theme ? dedupePreserveOrder([input.theme, input.context ?? ""]) : (input.context ? [input.context] : []);
  const captionPhrases = input.existingCaption ? [input.existingCaption] : [];

  const allPhrases = dedupePreserveOrder([
    ...factPhrases,
    ...themePhrases,
    ...captionPhrases
  ]);

  const factKeywords = extractKeywords(factPhrases);
  const themeKeywords = extractKeywords(themePhrases);
  const captionKeywords = extractKeywords(captionPhrases);
  const prioritizedKeywords = extractKeywords(allPhrases);
  const supplementalKeywords = factKeywords.length > 0 ? factKeywords : themeKeywords.length > 0 ? themeKeywords : captionKeywords;

  const hashtags = buildHashtags(input.platform, prioritizedKeywords, factPhrases, supplementalKeywords);
  const cta = buildCTA(input.platform, prioritizedKeywords, themeKeywords, captionKeywords, input.theme, input.existingCaption);
  const alt = buildAlt(
    input.platform,
    factPhrases,
    themePhrases,
    captionPhrases,
    prioritizedKeywords,
    input.theme,
    input.existingCaption
  );

  return { hashtags, cta, alt };
}

interface ContentToValidate {
  caption?: string;
  hashtags?: string[];
  cta?: string;
  alt?: string;
}

export function ensureFallbackCompliance(
  content: ContentToValidate,
  params: FallbackInferenceInput
): FallbackInferenceResult {
  const fallback = inferFallbackFromFacts(params);
  const rules = PLATFORM_HASHTAG_RULES[params.platform];
  
  // Validate and fix hashtags
  let hashtags = content.hashtags || [];
  if (!Array.isArray(hashtags)) {
    hashtags = [];
  }
  
  // Filter and format hashtags according to platform rules
  hashtags = hashtags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => {
      const cleaned = sanitizePhrase(tag).toLowerCase();
      if (rules.prefix === "#") {
        return cleaned.startsWith('#') ? `#${cleaned.slice(1).replace(/\s+/g, "")}` : `#${cleaned.replace(/\s+/g, "")}`;
      } else {
        return cleaned.replace(/^#/, "").replace(/\s+/g, " ");
      }
    })
    .filter(tag => tag.length > 2)
    .slice(0, rules.max);
  
  // Ensure minimum hashtag count
  if (hashtags.length < rules.min) {
    const needed = rules.min - hashtags.length;
    const additionalTags = fallback.hashtags
      .filter(tag => !hashtags.includes(tag))
      .slice(0, needed);
    hashtags.push(...additionalTags);
  }
  
  // Validate CTA
  let cta = content.cta;
  if (!cta || typeof cta !== 'string' || cta.trim().length < 3) {
    cta = fallback.cta;
  }
  
  // Validate alt text
  let alt = content.alt;
  if (!alt || typeof alt !== 'string' || alt.trim().length < 20) {
    alt = fallback.alt;
  }
  
  return {
    hashtags,
    cta,
    alt
  };
}