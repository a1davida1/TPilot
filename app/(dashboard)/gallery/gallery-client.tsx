'use client';

import { useCallback, useMemo, useState } from 'react';
import type { GalleryItem, GalleryResponse } from './types';
import { GalleryGrid } from './gallery-grid';
import { StickyRail } from '../_components/sticky-rail';
import { WidgetErrorBoundary } from '../_components/widget-error-boundary';
import { useGalleryInfiniteQuery } from '../../../client/hooks/dashboard';
import { Loader2, Search, SlidersHorizontal } from 'lucide-react';

interface GalleryClientProps {
  initialData?: GalleryResponse | null;
}

type FilterPreset = 'all' | 'watermarked' | 'unprotected' | 'cooldownReady' | 'cooldownLocked';
type SortOrder = 'newest' | 'oldest' | 'sizeDesc' | 'sizeAsc' | 'recentlyReposted';

const filterPresets: ReadonlyArray<{ id: FilterPreset; label: string; helper: string }> = [
  { id: 'all', label: 'All assets', helper: 'Everything in your library' },
  { id: 'watermarked', label: 'ImageShield', helper: 'Protected uploads' },
  { id: 'unprotected', label: 'Needs protection', helper: 'Uploads missing watermark' },
  { id: 'cooldownReady', label: 'Ready to repost', helper: 'Cleared the 72h Reddit cooldown' },
  { id: 'cooldownLocked', label: 'Cooling down', helper: 'Recently posted — cooldown active' },
];

const sortOptions: ReadonlyArray<{ id: SortOrder; label: string }> = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'sizeDesc', label: 'Largest file size' },
  { id: 'sizeAsc', label: 'Smallest file size' },
  { id: 'recentlyReposted', label: 'Recently reposted' },
];

function createSkeleton(count: number) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={index} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70">
      <div className="h-48 w-full rounded-t-2xl bg-slate-800" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-slate-800" />
        <div className="h-3 w-1/2 rounded bg-slate-800" />
        <div className="h-3 w-full rounded bg-slate-800" />
      </div>
    </div>
  ));
}

function GallerySkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="h-5 w-1/3 animate-pulse rounded bg-slate-800" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {createSkeleton(4)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {createSkeleton(8)}
      </div>
    </div>
  );
}

function normalizeItems(pages: Array<GalleryResponse | undefined>): GalleryItem[] {
  return pages
    .filter((page): page is GalleryResponse => Boolean(page))
    .flatMap((page) => page.items);
}

export function GalleryClient({ initialData }: GalleryClientProps) {
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchValue, setSearchValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const galleryQuery = useGalleryInfiniteQuery(
    {
      page: 1,
      pageSize: 20,
      filter: filterPreset === 'all' ? undefined : filterPreset,
      sort: sortOrder,
      search: searchValue.trim() || undefined,
    },
    initialData ?? undefined,
  );

  const items = useMemo(() => normalizeItems(galleryQuery.data?.pages ?? []), [galleryQuery.data]);
  const isFiltered = filterPreset !== 'all' || Boolean(searchValue);

  const stats = useMemo(() => {
    const totalSize = items.reduce((sum, item) => sum + item.bytes, 0);
    const watermarked = items.filter((item) => item.isWatermarked).length;
    const readyToRepost = items.filter((item) => item.lastRepostedAt).length;
    return {
      totalAssets: items.length,
      librarySizeMb: (totalSize / (1024 * 1024)).toFixed(1),
      watermarked,
      readyToRepost,
    };
  }, [items]);

  const handleToggleSelect = useCallback((item: GalleryItem) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilterPreset('all');
    setSearchValue('');
    setSortOrder('newest');
  }, []);

  const handleRepost = useCallback((item: GalleryItem) => {
    console.info('Trigger repost workflow', item.id);
  }, []);

  if (galleryQuery.isLoading && !initialData) {
    return <GallerySkeleton />;
  }

  if (galleryQuery.error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-10 text-center text-red-700">
        <h2 className="text-lg font-semibold">Unable to load your gallery</h2>
        <p className="mt-2 text-sm">
          {galleryQuery.error instanceof Error ? galleryQuery.error.message : 'Please retry in a few moments.'}
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => galleryQuery.refetch()}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <WidgetErrorBoundary>
      <StickyRail
        rail={
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Quick stats</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="flex items-center justify-between"><span>Total assets</span><span className="font-semibold text-white">{stats.totalAssets}</span></li>
                <li className="flex items-center justify-between"><span>Library size</span><span className="font-semibold text-white">{stats.librarySizeMb} MB</span></li>
                <li className="flex items-center justify-between"><span>Watermarked</span><span className="font-semibold text-white">{stats.watermarked}</span></li>
                <li className="flex items-center justify-between"><span>Repost-ready</span><span className="font-semibold text-white">{stats.readyToRepost}</span></li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </div>
              <div className="flex flex-wrap gap-2">
                {filterPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => setFilterPreset(preset.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      preset.id === filterPreset
                        ? 'bg-rose-500 text-white shadow-bubble'
                        : 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {filterPresets.find((preset) => preset.id === filterPreset)?.helper}
              </p>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sort order</label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Search</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Find filename or subreddit"
                  className="flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h4 className="text-sm font-semibold text-slate-100">Selection</h4>
              <p className="text-xs text-slate-400">{selectedIds.size} assets selected.</p>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-300 underline-offset-4 hover:underline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </button>
              )}
            </div>
          </div>
        }
      >
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h1 className="text-2xl font-semibold text-white">Media control center</h1>
            <p className="mt-2 text-sm text-slate-300">
              Organize watermarked assets, check repost cooldowns, and queue content straight to your Reddit scheduler.
            </p>
            {isFiltered && (
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-rose-300 underline-offset-4 hover:underline"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            )}
          </div>
          <GalleryGrid
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onRepost={handleRepost}
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
          />
          <div className="flex justify-center">
            {galleryQuery.hasNextPage ? (
              <button
                type="button"
                onClick={() => galleryQuery.fetchNextPage()}
                disabled={galleryQuery.isFetchingNextPage}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {galleryQuery.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </button>
            ) : (
              <span className="text-xs text-slate-500">All assets loaded</span>
            )}
          </div>
        </section>
      </StickyRail>
    </WidgetErrorBoundary>
  );
}
