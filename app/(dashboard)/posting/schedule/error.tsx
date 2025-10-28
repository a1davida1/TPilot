'use client';

interface ScheduleErrorProps {
  error: Error;
  reset: () => void;
}

export default function ScheduleError({ error, reset }: ScheduleErrorProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="rounded-2xl border border-red-300 bg-red-50 px-8 py-12 text-center text-red-700">
        <h2 className="text-xl font-semibold">Scheduler safeguards unavailable</h2>
        <p className="mt-2 text-sm">{error.message || 'We could not load the risk summary. Please try again shortly.'}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Retry safety check
        </button>
      </div>
    </div>
  );
}
