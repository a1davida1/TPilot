/**
 * Gallery API Route (Next.js App Router)
 * Provides paginated access to user's gallery
 * Extracted from PR #39
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGalleryPage, type GalleryPagination } from '@server/services/gallery-service.js';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../_lib/auth';
import type { GalleryResponse } from '../../(dashboard)/gallery/types';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

function parseQueryParams(url: URL): { page: number; pageSize: number } | null {
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function mapToResponse(pagination: GalleryPagination): GalleryResponse {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    hasMore: pagination.hasMore,
    items: pagination.items,
  };
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pagination = parseQueryParams(url);
    if (!pagination) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }

    const data = await getGalleryPage(userId, pagination.page, pagination.pageSize);
    return NextResponse.json(mapToResponse(data));
  } catch (error) {
    console.error('Gallery API error:', error);
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}
