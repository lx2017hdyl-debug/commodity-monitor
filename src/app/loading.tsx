/** 页面切换时的骨架屏 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 h-10 w-64 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-800/60" />
        ))}
      </div>
    </main>
  );
}
