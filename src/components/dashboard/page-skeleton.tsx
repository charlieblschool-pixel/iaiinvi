/** Shown the instant a dashboard link is clicked, while the next page loads. */
export function PageSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="animate-page-in flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      {withHeader && (
        <div className="flex flex-col gap-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}
