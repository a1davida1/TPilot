// Shared types for caption generation and preview
import { z } from 'zod';

export interface CaptionObject {
  caption: string;
  alt?: string;
  hashtags?: string[];
  mood?: string;
  style?: string;
  cta?: string;
  safety_level?: 'normal' | 'spicy_safe' | 'unsafe';
  titles?: string[];
}

export interface RankedResult {
  reason?: string;
  [key: string]: unknown;
}

export interface CaptionPreviewData {
  final: string | CaptionObject;
  ranked: string[] | RankedResult;
  titles?: string[];
  facts?: Record<string, unknown>;
  includeHashtags?: boolean;
  platform?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationResponse {
  final: string | CaptionObject;
  ranked: string[] | RankedResult;
  facts?: Record<string, unknown>;
  provider?: string;
  titles?: string[];
  includeHashtags?: boolean;
  platform?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Zod schemas for runtime validation
export const captionObjectSchema = z.object({
  caption: z.string(),
  alt: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mood: z.string().optional(),
  style: z.string().optional(),
  cta: z.string().optional(),
  safety_level: z.enum(['normal', 'spicy_safe', 'unsafe']).optional(),
  titles: z.array(z.string()).min(1).optional(),
});

export const rankedResultSchema = z.object({
  reason: z.string().optional(),
}).catchall(z.unknown());

export const generationResponseSchema = z.object({
  final: z.union([z.string(), captionObjectSchema]),
  ranked: z.union([z.array(z.string()), rankedResultSchema]),
  facts: z.record(z.string(), z.unknown()).optional(),
  provider: z.string().optional(),
  titles: z.array(z.string()).min(1).optional(),
}).catchall(z.unknown());