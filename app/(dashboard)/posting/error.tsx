'use client';

interface PostingErrorProps {
  error: Error;
  reset: () => void;
}

export default function PostingError({ error, reset }: PostingErrorProps) {
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 px-8 py-12 text-center text-red-700">
      <h2 className="text-xl font-semibold">Posting workspace unavailable</h2>
      <p className="mt-2 text-sm">{error.message || 'Please retry your request.'}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
      >
        Reload workspace
      </button>
    </div>
  );
}
