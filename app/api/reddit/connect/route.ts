import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { getRedditAuthUrl } from '@server/lib/reddit';
import { stateStore } from '@server/services/state-store';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const intentSchema = z.enum(['account-link', 'posting', 'intelligence']);
const querySchema = z.object({
  intent: intentSchema,
  queue: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/u, 'Queue identifier must be 1-64 URL-safe characters')
    .optional(),
});

interface RedditOAuthStateData {
  userId: number;
  ip?: string | null;
  userAgent?: string | null;
  timestamp: number;
  intent: z.infer<typeof intentSchema>;
  queue?: string;
}

function resolveClientIp(request: Request): string | null {
  const header = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  if (header) {
    const [first] = header.split(',').map(part => part.trim()).filter(Boolean);
    if (first) {
      return first;
    }
  }
  const remote = request.headers.get('cf-connecting-ip');
  return remote ?? null;
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!process.env.REDDIT_CLIENT_ID) {
      return NextResponse.json(
        {
          error: 'Reddit integration not configured. Please contact support to enable Reddit OAuth.',
        },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const validated = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const stateToken = crypto.randomBytes(32).toString('hex');
    const state = `${validated.intent}:${stateToken}`;

    const stateData: RedditOAuthStateData = {
      userId,
      ip: resolveClientIp(request),
      userAgent: request.headers.get('user-agent'),
      timestamp: Date.now(),
      intent: validated.intent,
      queue: validated.queue,
    };

    await stateStore.set(`reddit_state:${state}`, stateData, 600);

    const authUrl = getRedditAuthUrl(state);

    return NextResponse.json({ success: true, authUrl, intent: validated.intent });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 }
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    clearAuthRequestContext();
  }
}
