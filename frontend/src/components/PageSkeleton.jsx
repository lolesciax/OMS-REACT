import Skeleton, { SkeletonRegion, TableSkeleton } from "./Skeleton";

function Lines({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${index === count - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-line bg-white p-5 sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Panel key={index}>
          <Skeleton className="mb-5 h-4 w-24 max-w-full" />
          <Skeleton className="mb-4 h-9 w-20 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </Panel>
      ))}
    </div>
  );
}

export function ProductSkeletons({ count = 4 }) {
  return (
    <SkeletonRegion label="Loading the collection">
      <div className="grid grid-cols-1 gap-x-5 gap-y-7 min-[360px]:grid-cols-2 min-[701px]:grid-cols-3 min-[1001px]:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-line bg-white"
          >
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

function Chart() {
  return (
    <Panel>
      <Skeleton className="mb-8 h-5 w-1/2" />
      <div className="flex h-56 items-end gap-3 border-b border-line pb-3 sm:gap-5">
        {["h-2/5", "h-3/5", "h-1/2", "h-4/5", "h-2/3", "h-full"].map(
          (height, index) => (
            <Skeleton key={index} className={`flex-1 ${height}`} />
          ),
        )}
      </div>
      <Skeleton className="mt-4 h-3 w-2/3" />
    </Panel>
  );
}

function List({ count = 3, photo = true }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center gap-4" key={index}>
          {photo && <Skeleton className="h-24 w-20 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1">
            <Lines />
            <Skeleton className="mt-4 h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Form({ fields = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index}>
          <Skeleton className="mb-3 h-3 w-24 max-w-full" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="mt-2 h-12 w-full rounded-lg sm:col-span-2" />
    </div>
  );
}

export default function PageSkeleton({
  variant = "list",
  label = "Loading page content",
}) {
  let content;
  if (variant === "dashboard") {
    content = (
      <div className="space-y-6">
        <StatSkeletons />
        <div className="grid gap-6 lg:grid-cols-2">
          <Chart />
          <Chart />
        </div>
        <Panel>
          <Skeleton className="mb-6 h-5 w-44" />
          <List photo={false} />
        </Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <Chart />
          <Panel>
            <List />
          </Panel>
        </div>
      </div>
    );
  } else if (variant === "profile") {
    content = (
      <div className="grid items-start gap-8 min-[761px]:grid-cols-[240px_minmax(0,1fr)]">
        <Panel>
          <Skeleton className="mx-auto mb-6 size-28 rounded-full" />
          <Lines />
          <Skeleton className="mt-6 h-11 w-full" />
        </Panel>
        <div className="space-y-6">
          <Panel>
            <Skeleton className="mb-6 h-6 w-40" />
            <Form />
          </Panel>
          <Panel>
            <Skeleton className="mb-6 h-6 w-40" />
            <Lines />
          </Panel>
        </div>
      </div>
    );
  } else if (["cart", "checkout", "order"].includes(variant)) {
    content = (
      <div className="grid items-start gap-7 min-[901px]:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          {variant === "checkout" ? (
            <>
              <Skeleton className="mb-7 h-7 w-48 max-w-full" />
              <Form fields={8} />
            </>
          ) : (
            <List />
          )}
        </Panel>
        <Panel>
          <Skeleton className="mb-7 h-6 w-36" />
          <Lines count={4} />
          <Skeleton className="my-7 h-px w-full" />
          <Skeleton className="mb-6 h-7 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </Panel>
      </div>
    );
  } else if (variant === "settings") {
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <Panel key={index}>
            <Skeleton className="mb-5 h-6 w-28" />
            <Lines count={2} />
            <Skeleton className="mx-auto my-7 aspect-square w-48 max-w-full" />
            <Form fields={2} />
          </Panel>
        ))}
        <Panel className="lg:col-span-2">
          <Skeleton className="mb-5 h-6 w-40" />
          <Lines count={2} />
        </Panel>
      </div>
    );
  } else if (variant === "auth") {
    content = (
      <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-2">
        <div className="hidden space-y-6 md:block">
          <Skeleton className="h-16 w-4/5" />
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Lines />
        </div>
        <Panel>
          <Skeleton className="mb-5 h-4 w-36" />
          <Skeleton className="mb-8 h-9 w-3/4" />
          <Form fields={4} />
          <Skeleton className="mt-6 h-4 w-2/3" />
        </Panel>
      </div>
    );
  } else {
    content = (
      <div className="space-y-6">
        {[0, 1, 2].map((index) => (
          <Panel key={index}>
            <div className="mb-6 flex justify-between gap-4">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-7 w-20 shrink-0" />
            </div>
            <List count={1} />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </Panel>
        ))}
      </div>
    );
  }
  return <SkeletonRegion label={label}>{content}</SkeletonRegion>;
}

export function TablePageSkeleton() {
  return (
    <SkeletonRegion label="Loading workspace records">
      <div className="space-y-6">
        <StatSkeletons />
        <Panel>
          <div className="mb-6 flex justify-between gap-6">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-12 w-1/4" />
          </div>
          <div className="overflow-hidden">
            <table className="w-full min-w-[600px] border-separate border-spacing-y-4">
              <tbody>
                <TableSkeleton />
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </SkeletonRegion>
  );
}
