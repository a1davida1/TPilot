'use client';

interface GalleryErrorProps {
  error: Error;
  reset: () => void;
}

export default function GalleryError({ error, reset }: GalleryErrorProps) {
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 px-8 py-12 text-center text-red-700">
      <h2 className="text-xl font-semibold">Gallery failed to load</h2>
      <p className="mt-2 text-sm">{error.message || 'Please try refreshing the page.'}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
