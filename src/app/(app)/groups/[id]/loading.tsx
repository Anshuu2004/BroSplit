export default function Loading() {
  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          </div>
        </div>

        <div className="-mx-1 flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 w-24 animate-pulse rounded-full bg-muted"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      </header>

      <div className="space-y-2">
        <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rounded-xl border bg-card p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
