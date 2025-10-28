export default function GalleryLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="h-5 w-1/3 animate-pulse rounded bg-slate-800" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="h-24 rounded-xl bg-slate-800" />
              <div className="h-4 w-2/3 rounded bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="h-48 w-full animate-pulse rounded-t-2xl bg-slate-800" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-2/3 rounded bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-800" />
              <div className="h-3 w-full rounded bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
