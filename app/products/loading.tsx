export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Filters */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="space-y-3 rounded-lg border p-4">
            <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded-md bg-muted" />
          </div>
        </aside>

        {/* Results */}
        <section className="lg:col-span-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-56 animate-pulse rounded-md bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border">
                <div className="aspect-square w-full animate-pulse bg-muted" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center">
            <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
          </div>
        </section>
      </div>
    </div>
  );
}
