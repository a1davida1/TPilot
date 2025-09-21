import { z } from "zod";

type FactCategory = "objects" | "colors" | "setting" | "wardrobe";

const FACT_CATEGORIES: ReadonlyArray<FactCategory> = [
  "objects",
  "colors",
  "setting",
  "wardrobe",
];

const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ["boardwalk", "pier", "dock", "promenade"],
  ["ocean", "sea", "seaside"],
  ["beach", "shore", "coast"],
  ["sunset", "twilight", "dusk"],
  ["sunrise", "dawn", "daybreak"],
  ["dress", "gown"],
  ["shirt", "top", "tee"],
  ["pants", "trousers", "slacks"],
  ["jacket", "coat", "blazer"],
  ["swimsuit", "bikini"],
  ["casual", "laid-back"],
  ["colorful", "vibrant"],
  ["blue", "azure", "navy", "cerulean"],
  ["red", "crimson", "scarlet"],
  ["green", "emerald", "verdant"],
  ["yellow", "golden", "sunny"],
  ["black", "ebony", "onyx"],
  ["white", "ivory", "pearl"],
];

const SYNONYM_LOOKUP: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(term => term.toLowerCase());
    for (const term of normalizedGroup) {
      const entry = map.get(term) ?? new Set<string>();
      for (const candidate of normalizedGroup) {
        if (candidate !== term) {
          entry.add(candidate);
        }
      }
      map.set(term, entry);
    }
  }
  return map;
})();

const captionSchema = z.object({
  caption: z.string(),
  alt: z.string(),
});

export interface EnsureFactCoverageResult {
  ok: boolean;
  missing: FactCategory[];
  keywords: Record<FactCategory, string[]>;
  hint?: string;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => collectStrings(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(item => collectStrings(item));
  }
  return [];
}

function uniqueNormalizedKeywords(values: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (normalized.length > 0) {
      out.add(normalized);
    }
  }
  return Array.from(out);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(text: string, lowerText: string, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  if (normalized.includes(" ")) {
    return lowerText.includes(normalized);
  }
  const regex = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
  return regex.test(text);
}

function keywordMatches(text: string, lowerText: string, keyword: string): boolean {
  if (includesTerm(text, lowerText, keyword)) {
    return true;
  }
  const synonyms = SYNONYM_LOOKUP.get(keyword) ?? new Set<string>();
  for (const candidate of synonyms) {
    if (includesTerm(text, lowerText, candidate)) {
      return true;
    }
  }
  return false;
}

function buildHint(keywords: Record<FactCategory, string[]>, missing: FactCategory[]): string | undefined {
  if (missing.length === 0) {
    return undefined;
  }
  const segments: string[] = [];
  for (const category of missing) {
    const terms = keywords[category];
    if (terms.length === 0) {
      continue;
    }
    const label = category === "objects" ? "nouns" : category;
    segments.push(`${label}: ${terms.join(", ")}`);
  }
  if (segments.length === 0) {
    return undefined;
  }
  return `Work in IMAGE_FACTS ${segments.join("; ")}`;
}

export function ensureFactCoverage(params: {
  facts?: Record<string, unknown>;
  caption: string;
  alt: string;
}): EnsureFactCoverageResult {
  const { caption, alt } = captionSchema.parse({ caption: params.caption, alt: params.alt });
  const facts = params.facts ?? {};
  const keywords = FACT_CATEGORIES.reduce<Record<FactCategory, string[]>>((acc, category) => {
    const raw = collectStrings((facts as Record<string, unknown>)[category]);
    acc[category] = uniqueNormalizedKeywords(raw);
    return acc;
  }, {
    objects: [],
    colors: [],
    setting: [],
    wardrobe: [],
  });

  const combinedText = `${caption} ${alt}`;
  const lowerText = combinedText.toLowerCase();

  const missing: FactCategory[] = [];

  for (const category of FACT_CATEGORIES) {
    const terms = keywords[category];
    if (terms.length === 0) {
      continue;
    }
    const matchesCategory = terms.some(term => keywordMatches(combinedText, lowerText, term));
    if (!matchesCategory) {
      missing.push(category);
    }
  }

  const ok = missing.length === 0;

  return {
    ok,
    missing,
    keywords,
    hint: ok ? undefined : buildHint(keywords, missing),
  };
}