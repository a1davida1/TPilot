import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { pipeline } from '@server/caption/openrouterPipeline';
import { loadCaptionPersonalizationContext } from '@server/caption/personalization-context';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const schema = z.object({
  imageUrl: z.string().url(),
  platform: z.enum(['instagram', 'x', 'reddit', 'tiktok']),
  voice: z.string().min(1).max(120).optional(),
  style: z.string().min(1).max(120).optional(),
  mood: z.string().min(1).max(120).optional(),
  nsfw: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await request.json();
    const validated = schema.parse(payload);

    const personalization = typeof userId === 'number' ? await loadCaptionPersonalizationContext(userId) : null;

    const result = await pipeline({
      imageUrl: validated.imageUrl,
      platform: validated.platform,
      voice: validated.voice,
      style: validated.style,
      mood: validated.mood,
      nsfw: validated.nsfw ?? false,
      personalization,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.flatten() },
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
