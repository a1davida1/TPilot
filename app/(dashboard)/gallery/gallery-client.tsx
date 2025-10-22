'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { GalleryGrid } from './gallery-grid';
import { RepostModal } from './repost-modal';
import type { GalleryItem, GalleryResponse, QuickRepostPayload } from './types';
import { getCooldownStatus } from './types';

interface GalleryClientProps {
  initialData: GalleryResponse | null;
}

type FilterPreset = 'all' | 'watermarked' | 'unprotected' | 'cooldownReady' | 'cooldownLocked';
type SortOrder = 'newest' | 'oldest' | 'sizeDesc' | 'sizeAsc' | 'recentlyReposted';
type StatTone = 'default' | 'success' | 'warning';

const sectionClass = 'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10';
const headingClass = 'text-2xl font-semibold text-gray-900';
const descriptionClass = 'text-sm text-gray-600';
const selectionBadgeClass = 'inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700';
const clearSelectionButtonClass = 'text-sm font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const loadButtonClass = 'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const statsGridClass = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4';
const statCardClass = 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm';
const statLabelClass = 'text-sm font-medium text-gray-500';
const statHelperClass = 'mt-1 text-xs text-gray-500';
const filtersContainerClass = 'flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm';
const filterButtonBase = 'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
const filterButtonActive = 'border-blue-600 bg-blue-50 text-blue-700';
const filterButtonInactive = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50';
const searchInputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const selectInputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const FALLBACK_RESPONSE: GalleryResponse = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  hasMore: false,
  items: [],
};

const FILTER_PRESETS: ReadonlyArray<{ id: FilterPreset; label: string; helper: string }> = [
  { id: 'all', label: 'All assets', helper: 'Everything in your library' },
  { id: 'watermarked', label: 'ImageShield', helper: 'Protected uploads' },
  { id: 'unprotected', label: 'Needs protection', helper: 'Original uploads without watermark' },
  { id: 'cooldownReady', label: 'Ready to repost', helper: 'Cleared the 72h Reddit cooldown' },
  { id: 'cooldownLocked', label: 'In cooldown', helper: 'Recently posted—cooldown active' },
];

const SORT_OPTIONS: ReadonlyArray<{ id: SortOrder; label: string }> = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'sizeDesc', label: 'Largest file size' },
  { id: 'sizeAsc', label: 'Smallest file size' },
  { id: 'recentlyReposted', label: 'Recently reposted' },
];

function parseDate(value: string): number {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatStorage(bytes: number): string {
  const gigabytes = bytes / (1024 * 1024 * 1024);
  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(1)} GB`;
  }

  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  const kilobytes = bytes / 1024;
  return `${kilobytes.toFixed(1)} KB`;
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function ceilHours(value: number): number {
  return Math.ceil(value);
}

function StatsCard({ label, value, helper, tone = 'default' }: { label: string; value: string; helper: string; tone?: StatTone }) {
  const toneClassMap: Record<StatTone, string> = {
    default: 'text-gray-900',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  };

  return (
    <article className={statCardClass}>
      <p className={statLabelClass}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClassMap[tone]}`}>{value}</p>
      <p className={statHelperClass}>{helper}</p>
    </article>
  );
}

function FilterHelper({ helper }: { helper: string }) {
  return <span className="block text-xs text-gray-500">{helper}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-48 w-full rounded-lg bg-gray-200" />
            <div className="mt-3 space-y-2 px-2">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
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
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');

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
      void loadInitial();
    }
  }, [initialData, pageSize]);

  useEffect(() => {
    setSelectedIds((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validIds = new Set<number>();
      for (const id of previous) {
        if (items.some((item) => item.id === id)) {
          validIds.add(id);
        }
      }

      if (validIds.size === previous.size) {
        return previous;
      }

      return validIds;
    });
  }, [items]);

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
    const cooldown = getCooldownStatus(modalAsset.lastRepostedAt);
    if (cooldown.active) {
      setRepostError(`Reddit cooldown active. Try again in ${ceilHours(cooldown.hoursRemaining)} hours.`);
      return;
    }

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
      setItems((prev) =>
        prev.map((item) => (item.id === modalAsset.id ? { ...item, lastRepostedAt: timestamp } : item)),
      );
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

  const resetFilters = useCallback(() => {
    setFilterPreset('all');
    setSearchQuery('');
  }, []);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const totalAssets = items.length;
  const watermarkedCount = useMemo(() => items.reduce((count, item) => (item.isWatermarked ? count + 1 : count), 0), [items]);
  const storageUsed = useMemo(() => items.reduce((total, item) => total + item.bytes, 0), [items]);
  const cooldownReadyCount = useMemo(
    () => items.reduce((count, item) => (getCooldownStatus(item.lastRepostedAt).active ? count : count + 1), 0),
    [items],
  );
  const cooldownLockedCount = totalAssets - cooldownReadyCount;

  const coveragePercent = totalAssets > 0 ? (watermarkedCount / totalAssets) * 100 : 0;
  const coverageTone: StatTone = coveragePercent >= 90 ? 'success' : coveragePercent >= 70 ? 'default' : 'warning';
  const cooldownTone: StatTone = cooldownLockedCount === 0 ? 'success' : cooldownReadyCount === 0 ? 'warning' : 'default';

  const visibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    let filtered = items;
    switch (filterPreset) {
      case 'watermarked':
        filtered = filtered.filter((item) => item.isWatermarked);
        break;
      case 'unprotected':
        filtered = filtered.filter((item) => !item.isWatermarked);
        break;
      case 'cooldownReady':
        filtered = filtered.filter((item) => !getCooldownStatus(item.lastRepostedAt).active);
        break;
      case 'cooldownLocked':
        filtered = filtered.filter((item) => getCooldownStatus(item.lastRepostedAt).active);
        break;
      default:
        break;
    }

    if (normalizedQuery) {
      filtered = filtered.filter((item) => item.filename.toLowerCase().includes(normalizedQuery));
    }

    const sorted = [...filtered];
    switch (sortOrder) {
      case 'oldest':
        sorted.sort((a, b) => parseDate(a.createdAt) - parseDate(b.createdAt));
        break;
      case 'sizeDesc':
        sorted.sort((a, b) => b.bytes - a.bytes);
        break;
      case 'sizeAsc':
        sorted.sort((a, b) => a.bytes - b.bytes);
        break;
      case 'recentlyReposted':
        sorted.sort((a, b) => parseDate(b.lastRepostedAt ?? '') - parseDate(a.lastRepostedAt ?? ''));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
        break;
    }

    return sorted;
  }, [filterPreset, items, searchQuery, sortOrder]);

  const isFiltered = filterPreset !== 'all' || searchQuery.trim() !== '';
  const emptyState = totalAssets === 0 && !initialLoading;

  if (initialLoading) {
    return (
      <section className={sectionClass}>
        <header className="flex flex-col gap-2">
          <h1 className={headingClass}>Media gallery</h1>
          <p className={descriptionClass}>
            Browse your protected uploads, stage quick reposts, and keep tabs on recent activity.
          </p>
        </header>
        <div className="space-y-4">
          <LoadingSkeleton />
        </div>
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
      </header>

      <div className={statsGridClass}>
        <StatsCard label="Total assets" value={totalAssets.toString()} helper="Uploads available across all campaigns" />
        <StatsCard
          label="Watermark coverage"
          value={totalAssets === 0 ? '0%' : formatPercentage(coveragePercent)}
          helper={`${watermarkedCount} protected / ${totalAssets} total`}
          tone={coverageTone}
        />
        <StatsCard
          label="Cooldown ready"
          value={cooldownReadyCount.toString()}
          helper={cooldownLockedCount > 0 ? `${cooldownLockedCount} cooling down` : 'All clear to repost'}
          tone={cooldownTone}
        />
        <StatsCard label="Library footprint" value={formatStorage(storageUsed)} helper="Total space used across ImageShield" />
      </div>

      <div className={filtersContainerClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((preset) => {
                const active = filterPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${filterButtonBase} ${active ? filterButtonActive : filterButtonInactive}`}
                    onClick={() => setFilterPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <FilterHelper helper={FILTER_PRESETS.find((preset) => preset.id === filterPreset)?.helper ?? ''} />
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="sr-only" htmlFor="gallery-search">Search library</label>
            <input
              id="gallery-search"
              type="search"
              placeholder="Search by filename"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={searchInputClass}
            />
            <label className="sr-only" htmlFor="gallery-sort">Sort assets</label>
            <select
              id="gallery-sort"
              className={selectInputClass}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-gray-600">
            Showing {visibleItems.length} of {totalAssets} assets
            {isFiltered ? ' (filtered)' : ''}
          </span>
          <div className="flex items-center gap-3">
            <span className={selectionBadgeClass} data-testid="selection-count">
              {selectedCount} selected
            </span>
            <button
              type="button"
              className={clearSelectionButtonClass}
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedCount === 0}
            >
              Clear selection
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <GalleryGrid
        items={visibleItems}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onRepost={openRepostModal}
        isFiltered={isFiltered}
        onResetFilters={resetFilters}
      />

      <div className="flex items-center justify-center">
        <button
          type="button"
          className={loadButtonClass}
          onClick={loadMore}
          disabled={!hasMore || loading || emptyState}
        >
          {loading ? 'Loading…' : hasMore ? 'Load more' : emptyState ? 'No uploads yet' : 'No more items'}
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
