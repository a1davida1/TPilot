import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, AlertCircle, Info } from "lucide-react";
import type { CaptionObject, RankedResult, CaptionPreviewData } from '@shared/types/caption';

// Re-export types from shared module for backward compatibility
export type { CaptionObject, RankedResult, CaptionPreviewData } from '@shared/types/caption';

const PLATFORM_HASHTAG_LIMITS: Record<string, number> = {
  instagram: 8,
  x: 3,
  twitter: 3,
  tiktok: 5,
  youtube: 15,
  linkedin: 5,
  pinterest: 10,
  reddit: 0,
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  x: "X",
  twitter: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  reddit: "Reddit",
};

const CONTEXT_KEYWORDS = [
  "creator",
  "photographer",
  "artist",
  "brand",
  "company",
  "label",
  "designer",
  "subreddit",
  "community",
  "location",
  "city",
  "country",
  "state",
  "region",
  "neighborhood",
  "venue",
  "event",
  "festival",
  "landmark",
  "studio",
  "team",
  "club",
  "series",
  "campaign",
  "collection",
  "place",
];

type ContextSource = Record<string, unknown>;

function determineHashtagLimit(platform?: string): number {
  if (!platform) {
    return 10;
  }
  const normalized = platform.toLowerCase();
  if (normalized in PLATFORM_HASHTAG_LIMITS) {
    return PLATFORM_HASHTAG_LIMITS[normalized];
  }
  return 10;
}

function normalizeForComparison(tag: string): string {
  return tag.replace(/^#+/, "").toLowerCase();
}

function formatHashtag(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withoutHash = trimmed.replace(/^#+/, "");
  const sanitized = withoutHash
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) {
    return null;
  }
  const words = sanitized.split(" ").filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  const formattedWords = words.map(word => {
    if (word.length <= 3 && word === word.toUpperCase()) {
      return word.toUpperCase();
    }
    return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  });
  return `#${formattedWords.join("")}`;
}

function sanitizeHashtagList(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const seen = new Set<string>();
  const sanitized: string[] = [];
  for (const tag of tags) {
    const formatted = typeof tag === "string" ? formatHashtag(tag) : null;
    if (!formatted) {
      continue;
    }
    const key = normalizeForComparison(formatted);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sanitized.push(formatted);
  }
  return sanitized;
}

function shouldIncludeKey(path: string[]): boolean {
  return path.some(segment => {
    const normalized = segment.toLowerCase();
    return CONTEXT_KEYWORDS.some(keyword => normalized.includes(keyword));
  });
}

function collectContextualStrings(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") {
    return shouldIncludeKey(path) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => collectContextualStrings(item, path));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as ContextSource).flatMap(([key, child]) =>
      collectContextualStrings(child, [...path, key])
    );
  }
  return [];
}

function buildContextualHashtags({ facts, metadata }: { facts?: ContextSource; metadata?: ContextSource }): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const sources: ContextSource[] = [];
  if (facts) {
    sources.push(facts);
  }
  if (metadata) {
    sources.push(metadata);
  }
  for (const source of sources) {
    const strings = collectContextualStrings(source);
    for (const value of strings) {
      const formatted = formatHashtag(value);
      if (!formatted) {
        continue;
      }
      const key = normalizeForComparison(formatted);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(formatted);
    }
  }
  return results;
}

function resolvePlatformLabel(platform?: string): string {
  if (!platform) {
    return "your selected platform";
  }
  const normalized = platform.toLowerCase();
  if (normalized in PLATFORM_LABELS) {
    return PLATFORM_LABELS[normalized];
  }
  return `${platform.charAt(0).toUpperCase()}${platform.slice(1)}`;
}

interface CaptionPreviewProps {
  data: CaptionPreviewData | null | undefined;
  includeHashtags?: boolean;
  platform?: string;
  metadata?: Record<string, unknown>;
}

export function CaptionPreview({ data, includeHashtags, platform, metadata }: CaptionPreviewProps) {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null);


  if (!data) return null;
  
  const { final = '', ranked = [] } = data || {};
  if (!final) return null;

  // Handle different data formats - final could be a string or object with caption property
  const captionText = typeof final === 'string' ? final : final.caption;
  const charCount = captionText ? captionText.length : 0;
  const finalTitles =
    typeof final === 'object' && Array.isArray(final.titles)
      ? final.titles.filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
      : [];
  const topLevelTitles = Array.isArray(data?.titles)
    ? data.titles.filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
    : [];
  const titles = [...finalTitles, ...topLevelTitles.filter(title => !finalTitles.includes(title))];

  const effectivePlatform = platform ?? data?.platform;
  const metadataSource = metadata ?? data?.metadata;
  const factsSource = data?.facts;
  const includeHashtagsPreference = includeHashtags ?? data?.includeHashtags ?? true;
  const platformLimit = determineHashtagLimit(effectivePlatform);

  const baseHashtags = includeHashtagsPreference && typeof final === 'object'
    ? sanitizeHashtagList(final.hashtags)
    : [];

  const contextualHashtags = includeHashtagsPreference
    ? buildContextualHashtags({ facts: factsSource, metadata: metadataSource })
    : [];

  const combinedHashtags = [...baseHashtags];
  const seenHashtags = new Set(combinedHashtags.map(normalizeForComparison));
  for (const tag of contextualHashtags) {
    const normalized = normalizeForComparison(tag);
    if (seenHashtags.has(normalized)) {
      continue;
    }
    seenHashtags.add(normalized);
    combinedHashtags.push(tag);
  }

  const limitedHashtags = platformLimit > 0 ? combinedHashtags.slice(0, platformLimit) : [];
  const hashtagsSuppressedByPreference = !includeHashtagsPreference;
  const hashtagsSuppressedByPlatform = includeHashtagsPreference && platformLimit === 0;
  const showHashtagRow = includeHashtagsPreference && platformLimit !== 0 && limitedHashtags.length > 0;
  const showHashtagNotice = hashtagsSuppressedByPreference || hashtagsSuppressedByPlatform;
  const platformLabel = resolvePlatformLabel(effectivePlatform);
  const omissionSummary = hashtagsSuppressedByPreference
    ? "Hashtags intentionally omitted per your settings."
    : `Hashtags are typically not used on ${platformLabel}, so we left them out.`;
  const tooltipDetails = hashtagsSuppressedByPreference
    ? "You asked us to exclude hashtags for this draft. Enable hashtags to bring them back."
    : `To keep your ${platformLabel} post compliant, we skipped hashtags even though fallback suggestions existed.`;

  if (!captionText) return null;

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(captionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyTitle = async (title: string, index: number) => {
    await navigator.clipboard.writeText(title);
    setCopiedTitleIndex(index);
    setTimeout(() => setCopiedTitleIndex(null), 2000);
  };

  const handleCopyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(final, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <Card className="rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Caption Preview</CardTitle>
          <Badge variant="outline" className="font-mono">
            {charCount} chars
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {titles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Suggested Titles</p>
            <div className="flex flex-wrap gap-2">
              {titles.map((title, index) => (
                <Button
                  key={`${title}-${index}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-gradient-to-r from-purple-100 to-pink-100 text-gray-800 dark:from-purple-900/40 dark:to-pink-900/40 dark:text-gray-100"
                  onClick={() => handleCopyTitle(title, index)}
                >
                  <span className="mr-2 text-xs font-medium truncate max-w-[160px]">{title}</span>
                  {copiedTitleIndex === index ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Main Caption */}
        <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {captionText}
          </p>
        </div>

        {/* ALT Text */}
        {typeof final === 'object' && final.alt && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ALT Text</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              {final.alt}
            </p>
          </div>
        )}

        {/* Hashtags */}
        {showHashtagRow && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recommended Hashtags</p>
            <div className="flex flex-wrap gap-2">
              {limitedHashtags.map((tag, index) => (
                <Badge
                  key={`${tag}-${index}`}
                  variant="secondary"
                  className="text-xs bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {showHashtagNotice && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Info className="h-3 w-3" />
                  <span>{omissionSummary}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {tooltipDetails}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mood</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.mood || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Style</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.style || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">CTA</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.cta || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Safety Level</p>
            <Badge 
              variant={typeof final === 'object' && final.safety_level === 'normal' ? 'default' : typeof final === 'object' && final.safety_level === 'spicy_safe' ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {typeof final === 'object' && final.safety_level || 'Generated'}
            </Badge>
          </div>
        </div>

        {/* AI Selection Reason */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Why this caption won</p>
              <p className="text-xs text-blue-600 dark:text-blue-300">{typeof ranked === 'object' && ranked && !Array.isArray(ranked) && 'reason' in ranked ? ranked.reason : 'Based on engagement optimization'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleCopyCaption}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {copiedCaption ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Caption
              </>
            )}
          </Button>
          <Button
            onClick={handleCopyJSON}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {copiedJSON ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy JSON
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}