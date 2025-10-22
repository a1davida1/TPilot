'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GalleryItem, QuickRepostPayload } from './types';
import { getCooldownStatus } from './types';

interface RepostModalProps {
  asset: GalleryItem | null;
  open: boolean;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: QuickRepostPayload) => Promise<void> | void;
}

const overlayStyle = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4';
const panelStyle = 'w-full max-w-lg rounded-lg bg-white p-6 shadow-xl';
const labelStyle = 'block text-sm font-medium text-gray-700';
const inputStyle = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const checkboxContainerStyle = 'flex items-center gap-2';
const buttonBase = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

export function RepostModal({
  asset,
  open,
  loading,
  error,
  successMessage,
  onClose,
  onSubmit,
}: RepostModalProps) {
  const [subreddit, setSubreddit] = useState('');
  const [title, setTitle] = useState('');
  const [nsfw, setNsfw] = useState(true);
  const [spoiler, setSpoiler] = useState(false);

  const cooldown = useMemo(() => (asset ? getCooldownStatus(asset.lastRepostedAt) : { active: false, hoursRemaining: 0 }), [asset]);
  const cooldownHoursRemaining = cooldown.active ? Math.ceil(cooldown.hoursRemaining) : 0;

  useEffect(() => {
    if (asset && open) {
      setSubreddit('');
      setTitle(asset.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
      setNsfw(true);
      setSpoiler(false);
    }
  }, [asset, open]);

  // ESC key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !loading) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, loading, onClose]);

  if (!open || !asset) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldown.active) {
      return;
    }
    await onSubmit({ assetId: asset.id, subreddit, title, nsfw, spoiler });
  };

  return (
    <div className={overlayStyle} role="dialog" aria-modal onClick={(event) => {
      if (event.target === event.currentTarget && !loading) {
        onClose();
      }
    }}>
      <div className={panelStyle}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Quick repost</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <img
            src={asset.thumbnailUrl}
            alt={asset.filename}
            className="h-20 w-20 rounded object-cover"
            loading="lazy"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">{asset.filename}</p>
            <p className="text-xs text-gray-500">{new Date(asset.createdAt).toLocaleString()}</p>
            {asset.lastRepostedAt ? (
              <p className="text-xs text-gray-500">Last reposted {new Date(asset.lastRepostedAt).toLocaleString()}</p>
            ) : (
              <p className="text-xs text-gray-500">Not reposted yet</p>
            )}
          </div>
        </div>

        {cooldown.active ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Reddit enforces a 72-hour cooldown per subreddit. This asset will be ready again in approximately {cooldownHoursRemaining}{' '}
            hour{cooldownHoursRemaining === 1 ? '' : 's'}.
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            Cooldown cleared. Feel free to line up a repost and queue it with a fresh caption.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelStyle} htmlFor="repost-subreddit">Target subreddit</label>
            <input
              id="repost-subreddit"
              name="subreddit"
              className={inputStyle}
              placeholder="example: CreatorSuccess"
              value={subreddit}
              onChange={(event) => setSubreddit(event.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className={labelStyle} htmlFor="repost-title">Post title</label>
            <input
              id="repost-title"
              name="title"
              className={inputStyle}
              placeholder="Catchy headline for your repost"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className={checkboxContainerStyle}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={nsfw}
                onChange={(event) => setNsfw(event.target.checked)}
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Mark NSFW</span>
            </label>
            <label className={checkboxContainerStyle}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={spoiler}
                onChange={(event) => setSpoiler(event.target.checked)}
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Spoiler</span>
            </label>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className={`${buttonBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${buttonBase} ${
                cooldown.active
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={loading || cooldown.active}
            >
              {loading ? 'Posting…' : cooldown.active ? 'Cooling down' : 'Confirm repost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
