export default function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonRegion({
  children,
  label = "Loading content",
  className = "",
}) {
  return (
    <div
      className={`skeleton-region ${className}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="h-full min-w-0" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
  label = "Loading records",
  thumbnail = false,
}) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row}>
      {Array.from({ length: columns }, (_, column) => (
        <td key={column}>
          {row === 0 && column === 0 && (
            <span className="sr-only" role="status">
              {label}
            </span>
          )}
          <div className="flex min-h-12 items-center gap-3" aria-hidden="true">
            {thumbnail && column === 0 && (
              <Skeleton className="size-12 shrink-0 rounded-lg" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton
                className={
                  column === columns - 1 ? "h-7 w-16 max-w-full" : "h-4 w-4/5"
                }
              />
              {column === 0 && <Skeleton className="h-3 w-1/2" />}
            </div>
          </div>
        </td>
      ))}
    </tr>
  ));
}
