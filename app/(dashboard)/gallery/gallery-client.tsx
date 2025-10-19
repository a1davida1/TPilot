'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { GalleryGrid } from './gallery-grid';
import { RepostModal } from './repost-modal';
import type { GalleryItem, GalleryResponse, QuickRepostPayload } from './types';

interface GalleryClientProps {
  initialData: GalleryResponse | null;
}

const sectionClass = 'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10';
const headingClass = 'text-2xl font-semibold text-gray-900';
const descriptionClass = 'text-sm text-gray-600';
const buttonClass = 'inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
const loadButtonClass = 'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const FALLBACK_RESPONSE: GalleryResponse = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  hasMore: false,
  items: [],
};

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-48 w-full rounded-lg bg-gray-200" />
          <div className="mt-3 space-y-2 px-2">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GalleryClient({ initialData }: GalleryClientProps) {
  const initial = initialData ?? FALLBACK_RESPONSE;
  const [items, setItems] = useState<GalleryItem[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [pageSize] = useState(initial.pageSize);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modalAsset, setModalAsset] = useState<GalleryItem | null>(null);
  const [repostError, setRepostError] = useState<string | null>(null);
  const [repostSuccess, setRepostSuccess] = useState<string | null>(null);
  const [repostLoading, setRepostLoading] = useState(false);
  const [reposting, setReposting] = useState<Set<number>>(new Set());

  // Load initial data if not provided by SSR
  useEffect(() => {
    if (!initialData) {
      const loadInitial = async () => {
        try {
          const response = await fetch(`/api/gallery?page=1&pageSize=${pageSize}`, {
            credentials: 'include',
          });
          if (!response.ok) {
            throw new Error('Failed to load gallery');
          }
          const data = (await response.json()) as GalleryResponse;
          setItems(data.items);
          setPage(data.page);
          setHasMore(data.hasMore);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to load gallery';
          setError(message);
        } finally {
          setInitialLoading(false);
        }
      };
      loadInitial();
    }
  }, [initialData, pageSize]);

  const emptyState = items.length === 0;

  const toggleSelect = useCallback((item: GalleryItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const openRepostModal = useCallback((item: GalleryItem) => {
    setModalAsset(item);
    setRepostError(null);
    setRepostSuccess(null);
  }, []);

  const closeRepostModal = useCallback(() => {
    setModalAsset(null);
    setRepostError(null);
    setRepostSuccess(null);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const response = await fetch(`/api/gallery?page=${nextPage}&pageSize=${pageSize}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load additional media');
      }
      const data = (await response.json()) as GalleryResponse;
      setItems((prev) => [...prev, ...data.items]);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load more items';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, page, pageSize]);

  const handleRepost = useCallback(async (payload: QuickRepostPayload) => {
    if (!modalAsset) {
      return;
    }

    // Prevent concurrent reposts of same asset
    if (reposting.has(modalAsset.id)) {
      setRepostError('Repost already in progress for this asset.');
      return;
    }

    setReposting((prev) => new Set(prev).add(modalAsset.id));
    setRepostLoading(true);
    setRepostError(null);
    setRepostSuccess(null);

    try {
      const response = await fetch('/api/reddit/quick-repost', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, assetId: modalAsset.id }),
      });

      const data: { error?: string; repostedAt?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? 'Quick repost failed');
      }

      const timestamp = data.repostedAt ?? new Date().toISOString();
      setItems((prev) => prev.map((item) => (
        item.id === modalAsset.id
          ? { ...item, lastRepostedAt: timestamp }
          : item
      )));
      setRepostSuccess('Repost queued successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repost image';
      setRepostError(message);
    } finally {
      setRepostLoading(false);
      setReposting((prev) => {
        const next = new Set(prev);
        next.delete(modalAsset.id);
        return next;
      });
    }
  }, [modalAsset, reposting]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  if (initialLoading) {
    return (
      <section className={sectionClass}>
        <header className="flex flex-col gap-2">
          <h1 className={headingClass}>Media gallery</h1>
          <p className={descriptionClass}>
            Browse your protected uploads, stage quick reposts, and keep tabs on recent activity.
          </p>
        </header>
        <LoadingSkeleton />
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <header className="flex flex-col gap-2">
        <h1 className={headingClass}>Media gallery</h1>
        <p className={descriptionClass}>
          Browse your protected uploads, stage quick reposts, and keep tabs on recent activity.
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span data-testid="selection-count">{selectedCount} selected</span>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedCount === 0}
          >
            Clear selection
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <GalleryGrid
        items={items}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onRepost={openRepostModal}
      />

      <div className="flex items-center justify-center">
        <button
          type="button"
          className={loadButtonClass}
          onClick={loadMore}
          disabled={!hasMore || loading || emptyState}
        >
          {loading ? 'Loading…' : hasMore ? 'Load more' : 'No more items'}
        </button>
      </div>

      <RepostModal
        asset={modalAsset}
        open={modalAsset !== null}
        loading={repostLoading}
        error={repostError}
        successMessage={repostSuccess}
        onClose={closeRepostModal}
        onSubmit={handleRepost}
      />
    </section>
  );
}
