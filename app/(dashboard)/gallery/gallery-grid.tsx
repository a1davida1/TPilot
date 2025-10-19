'use client';

import type { GalleryItem } from './types';

interface GalleryGridProps {
  items: GalleryItem[];
  selectedIds: Set<number>;
  onToggleSelect: (item: GalleryItem) => void;
  onRepost: (item: GalleryItem) => void;
}

const gridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
const cardClass = 'relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg';
const badgeClass = 'absolute left-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white';
const selectionOutline = 'ring-4 ring-blue-500';

export function GalleryGrid({ items, selectedIds, onToggleSelect, onRepost }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-sm font-medium text-gray-900">Your gallery is empty.</p>
        <p className="mt-2 text-sm text-gray-500">Upload media from the dashboard to see it here.</p>
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        return (
          <div
            key={item.id}
            className={`${cardClass} ${selected ? selectionOutline : ''}`}
          >
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-900 shadow hover:bg-white transition-colors"
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

            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(item.bytes / (1024 * 1024)).toFixed(2)} MB · {item.mime}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() => onRepost(item)}
                >
                  Repost
                </button>
              </div>

              {item.lastRepostedAt ? (
                <span className={badgeClass}>
                  Reposted {new Date(item.lastRepostedAt).toLocaleDateString()}
                </span>
              ) : null}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                <span>{item.isWatermarked ? 'Watermarked' : 'Original'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
