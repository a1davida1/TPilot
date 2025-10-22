'use client';

import type { GalleryItem } from './types';
import { getCooldownStatus } from './types';

interface GalleryGridProps {
  items: GalleryItem[];
  selectedIds: Set<number>;
  onToggleSelect: (item: GalleryItem) => void;
  onRepost: (item: GalleryItem) => void;
  isFiltered: boolean;
  onResetFilters: () => void;
}

const gridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
const cardClass = 'relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg';
const badgeBaseClass = 'absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow';
const selectionOutline = 'ring-4 ring-blue-500';
const emptyStateContainer = 'rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center';
const emptyStateAction = 'mt-4 inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function GalleryGrid({ items, selectedIds, onToggleSelect, onRepost, isFiltered, onResetFilters }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className={emptyStateContainer}>
        <p className="text-sm font-medium text-gray-900">
          {isFiltered ? 'No media matches your filters yet.' : 'Your gallery is empty.'}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {isFiltered
            ? 'Try adjusting the filters or search to locate the asset you need.'
            : 'Upload media from the dashboard to see it here.'}
        </p>
        {isFiltered ? (
          <button type="button" className={emptyStateAction} onClick={onResetFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        const cooldown = getCooldownStatus(item.lastRepostedAt);
        const badgeLabel = cooldown.active
          ? `${Math.ceil(cooldown.hoursRemaining)}h cooldown` 
          : item.lastRepostedAt
            ? 'Cooldown cleared'
            : 'Never reposted';
        const badgeTone = cooldown.active ? 'bg-amber-600/90' : item.lastRepostedAt ? 'bg-emerald-600/90' : 'bg-blue-600/90';

        return (
          <div key={item.id} className={`${cardClass} ${selected ? selectionOutline : ''}`}>
            <span className={`${badgeBaseClass} ${badgeTone}`}>{badgeLabel}</span>

            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-900 shadow transition-colors hover:bg-white"
              onClick={() => onToggleSelect(item)}
              aria-label={selected ? 'Deselect' : 'Select'}
            >
              {selected ? 'Selected' : 'Select'}
            </button>

            <img
              src={item.thumbnailUrl}
              alt={item.filename}
              className="h-48 w-full object-cover"
              loading="lazy"
            />

            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-xs text-gray-500">{formatMegabytes(item.bytes)} · {item.mime}</p>
                </div>
                <button
                  type="button"
                  className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    cooldown.active
                      ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  onClick={() => {
                    if (!cooldown.active) {
                      onRepost(item);
                    }
                  }}
                  disabled={cooldown.active}
                  title={cooldown.active ? 'Reddit cooldown is still active for this asset.' : 'Queue a quick repost'}
                >
                  {cooldown.active ? 'Cooling down' : 'Repost'}
                </button>
              </div>

              <div className="space-y-1 text-xs text-gray-500">
                <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                <p>{item.isWatermarked ? 'Watermarked via ImageShield' : 'Original upload'}</p>
                <p>
                  {item.lastRepostedAt
                    ? `Last reposted ${new Date(item.lastRepostedAt).toLocaleDateString()}` 
                    : 'Not reposted yet'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
