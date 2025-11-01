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

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function GalleryGrid({ items, selectedIds, onToggleSelect, onRepost, isFiltered, onResetFilters }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-8 py-16 text-center text-slate-300">
        <h2 className="text-lg font-semibold text-white">
          {isFiltered ? 'No media matches your filters yet.' : 'Your gallery is empty.'}
        </h2>
        <p className="mt-3 text-sm">
          {isFiltered
            ? 'Adjust filters or search criteria to locate the content you need.'
            : 'Upload protected assets from the dashboard to see them here.'}
        </p>
        {isFiltered && (
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
            onClick={onResetFilters}
          >
            Reset filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const selected = selectedIds.has(item.id);
        const cooldown = getCooldownStatus(item.lastRepostedAt);
        const badgeLabel = cooldown.active
          ? `${Math.ceil(cooldown.hoursRemaining)}h cooldown`
          : item.lastRepostedAt
            ? 'Cooldown cleared'
            : 'Never reposted';
        const badgeTone = cooldown.active ? 'bg-amber-500/90' : item.lastRepostedAt ? 'bg-emerald-500/90' : 'bg-blue-500/90';

        return (
          <article
            key={item.id}
            className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 transition-shadow hover:shadow-bubble ${
              selected ? 'ring-2 ring-rose-400' : ''
            }`}
          >
            <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white ${badgeTone}`}>
              {badgeLabel}
            </span>
            <button
              type="button"
              className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold transition ${
                selected ? 'bg-rose-500 text-white' : 'bg-slate-900/90 text-slate-100 hover:bg-slate-800'
              }`}
              onClick={() => onToggleSelect(item)}
            >
              {selected ? 'Selected' : 'Select'}
            </button>

            <img
              src={item.thumbnailUrl}
              alt={item.filename}
              className="h-48 w-full object-cover"
              loading="lazy"
            />

            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatMegabytes(item.bytes)} · {item.mime}
                  </p>
                </div>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    cooldown.active
                      ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                      : 'bg-rose-500 text-white hover:bg-rose-400'
                  }`}
                  onClick={() => {
                    if (!cooldown.active) onRepost(item);
                  }}
                  disabled={cooldown.active}
                >
                  {cooldown.active ? 'Cooling down' : 'Queue repost'}
                </button>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <p>Uploaded {new Date(item.createdAt).toLocaleDateString()}</p>
                <p>{item.isWatermarked ? 'Protected by ImageShield' : 'Requires watermark'}</p>
                <p>
                  {item.lastRepostedAt
                    ? `Last repost ${new Date(item.lastRepostedAt).toLocaleDateString()}`
                    : 'No repost history'}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
