export default function PostingLoading() {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="h-6 w-1/2 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="h-4 w-3/4 rounded bg-slate-800" />
            <div className="h-3 w-2/3 rounded bg-slate-800" />
            <div className="h-10 rounded bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-5 w-full rounded bg-slate-800" />
        ))}
      </div>
    </div>
  );
}
