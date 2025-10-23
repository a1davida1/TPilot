import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { eq } from 'drizzle-orm';

import { pipeline } from '@server/caption/openrouterPipeline';
import { loadCaptionPersonalizationContext } from '@server/caption/personalization-context';
import { db } from '@server/db';
import { captionVariants, users } from '@shared/schema';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const personaValues = [
  'flirty_playful',
  'gamer_nerdy',
  'luxury_minimal',
  'arts_muse',
  'gym_energy',
  'cozy_girl',
  'seductive_goddess',
  'intimate_girlfriend',
  'bratty_tease',
  'submissive_kitten',
] as const;

const toneToggleValues = ['story', 'question', 'tease', 'promo', 'urgent'] as const;

type Persona = typeof personaValues[number];
type ToneToggle = typeof toneToggleValues[number];

type TierKey = 'free' | 'starter' | 'pro' | 'premium' | 'admin';

const subredditSchema = z
  .string()
  .min(3, 'Subreddit must be at least 3 characters')
  .max(32, 'Subreddit must be at most 32 characters')
  .transform(value => value.trim().replace(/^r\//iu, ''))
  .superRefine((value, ctx) => {
    if (!/^[A-Za-z0-9_]{3,32}$/u.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Subreddit may only include letters, numbers, or underscores',
      });
    }
  })
  .transform(value => value.toLowerCase());

const targetSchema = z.object({
  subreddit: subredditSchema,
  persona: z.enum(personaValues).optional(),
  tones: z.array(z.enum(toneToggleValues)).max(5).optional().default([]),
});

const requestSchema = z.object({
  imageUrl: z.string().url(),
  imageId: z.number().int().positive().optional(),
  platform: z.literal('reddit'),
  voice: z.string().min(1).max(120).optional(),
  style: z.string().min(1).max(120).optional(),
  mood: z.string().min(1).max(120).optional(),
  nsfw: z.boolean().optional(),
  targets: z.array(targetSchema).min(1).max(10),
});

interface RateLimitState {
  count: number;
  reset: number;
}

class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly tier: TierKey,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const rateLimits: Record<TierKey, { windowMs: number; max: number }> = {
  free: { windowMs: 60 * 60 * 1000, max: 5 },
  starter: { windowMs: 60 * 60 * 1000, max: 25 },
  pro: { windowMs: 60 * 60 * 1000, max: 200 },
  premium: { windowMs: 60 * 60 * 1000, max: 500 },
  admin: { windowMs: 60 * 60 * 1000, max: 10000 },
};

const rateLimiterStore = new Map<string, RateLimitState>();

const toneHintPresets: Record<ToneToggle, { key: string; value: string }> = {
  story: {
    key: 'narrative_mode',
    value: 'Add a short narrative hook that references the visual details and builds a mini story arc.',
  },
  question: {
    key: 'comment_invite',
    value: 'End with an open-ended question tailored to the subreddit to encourage thoughtful comments.',
  },
  tease: {
    key: 'tease_level',
    value: 'Dial up playful teasing and leave one vivid detail off-screen to spark curiosity.',
  },
  promo: {
    key: 'promotion_style',
    value: 'Include a subtle promotional nudge that feels native to the persona without direct links.',
  },
  urgent: {
    key: 'urgency',
    value: 'Create a gentle sense of urgency or limited-time moment to motivate immediate engagement.',
  },
};

const DEFAULT_SFW_VOICE: Persona = 'flirty_playful';
const DEFAULT_NSFW_VOICE: Persona = 'seductive_goddess';

function resolveToneExtras(tones: ToneToggle[] | undefined): Record<string, string> | undefined {
  if (!tones || tones.length === 0) {
    return undefined;
  }
  const extras: Record<string, string> = {};
  for (const tone of tones) {
    const preset = toneHintPresets[tone];
    if (preset) {
      extras[preset.key] = preset.value;
    }
  }
  return Object.keys(extras).length > 0 ? extras : undefined;
}

async function resolveUserTier(userId: number): Promise<TierKey> {
  const [row] = await db
    .select({ tier: users.tier, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return 'free';
  }

  if (row.isAdmin) {
    return 'admin';
  }

  switch (row.tier) {
    case 'starter':
      return 'starter';
    case 'pro':
      return 'pro';
    case 'premium':
      return 'premium';
    default:
      return 'free';
  }
}

function enforceRateLimit(userId: number, tier: TierKey, requested: number): { remaining: number; reset: number } {
  const limits = rateLimits[tier] ?? rateLimits.free;
  const key = `${userId}:${tier}`;
  const now = Date.now();
  const state = rateLimiterStore.get(key);

  if (!state || state.reset <= now) {
    const reset = now + limits.windowMs;
    const nextState: RateLimitState = { count: requested, reset };
    rateLimiterStore.set(key, nextState);
    return { remaining: Math.max(limits.max - requested, 0), reset };
  }

  const nextCount = state.count + requested;
  if (nextCount > limits.max) {
    const retryAfter = Math.max(1, Math.ceil((state.reset - now) / 1000));
    throw new RateLimitError('Caption generation limit reached for your tier', retryAfter, tier);
  }

  state.count = nextCount;
  rateLimiterStore.set(key, state);
  return { remaining: limits.max - nextCount, reset: state.reset };
}

function resolveVoice(persona: Persona | undefined, fallback: string | undefined, nsfw: boolean | undefined): string {
  if (persona) {
    return persona;
  }

  const allowedVoices = new Set<string>(personaValues);
  if (fallback && allowedVoices.has(fallback)) {
    return fallback;
  }

  return nsfw ? DEFAULT_NSFW_VOICE : DEFAULT_SFW_VOICE;
}

export async function POST(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await request.json();
    const validated = requestSchema.parse(payload);

    const tier = await resolveUserTier(userId);
    const rateLimitMeta = enforceRateLimit(userId, tier, validated.targets.length);

    const personalization = await loadCaptionPersonalizationContext(userId);

    const responses: Array<{
      variantId: number;
      subreddit: string;
      persona: string;
      tones: string[];
      suggestion: {
        caption: string;
        alt?: string;
        hashtags?: string[];
        cta?: string;
        mood?: string;
        style?: string;
        nsfw?: boolean;
        titles: string[];
      };
      ranked: unknown;
      variants: unknown;
      createdAt: string;
    }> = [];

    for (const target of validated.targets) {
      const voice = resolveVoice(target.persona, validated.voice, validated.nsfw);
      const toneExtras = resolveToneExtras(target.tones);

      const result = await pipeline({
        imageUrl: validated.imageUrl,
        platform: 'reddit',
        voice,
        style: validated.style,
        mood: validated.mood,
        nsfw: validated.nsfw ?? false,
        toneExtras,
        personalization,
      });

      const [row] = await db
        .insert(captionVariants)
        .values({
          userId,
          imageUrl: validated.imageUrl,
          imageId: validated.imageId ?? null,
          subreddit: target.subreddit,
          persona: voice,
          toneHints: target.tones ?? [],
          finalCaption: result.final.caption,
          finalAlt: result.final.alt ?? null,
          finalCta: result.final.cta ?? null,
          hashtags: result.final.hashtags ?? null,
          rankedMetadata: result.ranked,
          variants: result.variants,
        })
        .returning();

      const createdAtIso = row?.createdAt instanceof Date ? row.createdAt.toISOString() : String(row?.createdAt ?? new Date().toISOString());
      const tones = Array.isArray(row?.toneHints) ? (row?.toneHints as string[]) : target.tones ?? [];

      responses.push({
        variantId: row?.id ?? 0,
        subreddit: row?.subreddit ?? target.subreddit,
        persona: row?.persona ?? voice,
        tones,
        suggestion: {
          caption: result.final.caption,
          alt: result.final.alt ?? undefined,
          hashtags: result.final.hashtags ?? undefined,
          cta: result.final.cta ?? undefined,
          mood: result.final.mood ?? undefined,
          style: result.final.style ?? undefined,
          nsfw: result.final.nsfw ?? undefined,
          titles: result.final.titles ?? result.titles ?? [],
        },
        ranked: result.ranked,
        variants: result.variants,
        createdAt: createdAtIso,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: validated.imageUrl,
        imageId: validated.imageId ?? null,
        tier,
        rateLimit: {
          remaining: rateLimitMeta.remaining,
          resetAt: new Date(rateLimitMeta.reset).toISOString(),
        },
        variants: responses,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.flatten() },
        { status: 400 },
      );
    }

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          retryAfter: error.retryAfter,
          tier: error.tier,
        },
        { status: 429 },
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  } finally {
    clearAuthRequestContext();
  }
}
