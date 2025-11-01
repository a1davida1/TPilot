export default function ScheduleLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="h-16 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-48 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
    </div>
  );
}
