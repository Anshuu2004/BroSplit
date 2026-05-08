export default function Loading() {
  return (
    <div className="space-y-5">
      <section
        className="grid grid-cols-2 gap-3"
        aria-label="Loading totals"
      >
        <div className="rounded-xl border bg-card p-4">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        </div>
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-xl border bg-card p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-44 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
