import { useLocation } from "react-router-dom";
import Skeleton, { SkeletonRegion } from "./Skeleton";
import PageSkeleton, {
  ProductSkeletons,
  TablePageSkeleton,
} from "./PageSkeleton";

export default function RouteSkeleton() {
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin/");
  const variant = pathname.includes("dashboard")
    ? "dashboard"
    : pathname.includes("settings") || pathname.includes("maintenance")
      ? "settings"
      : pathname.includes("view-orders")
        ? "order"
        : pathname === "/profile"
          ? "profile"
          : ["/checkout", "/payment"].includes(pathname)
            ? "checkout"
            : pathname === "/cart"
              ? "cart"
              : ["/login", "/signup"].includes(pathname)
                ? "auth"
                : "list";
  const heading = (
    <div className="mb-8 space-y-4">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
  if (admin)
    return (
      <div className="flex min-h-dvh flex-col bg-surface-soft min-[901px]:flex-row">
        <SkeletonRegion
          label="Loading workspace navigation"
          className="w-full shrink-0 bg-primary p-6 min-[901px]:w-65"
        >
          <Skeleton className="mb-8 h-9 w-40" />
          <div className="grid grid-cols-3 gap-4 min-[901px]:grid-cols-1">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </SkeletonRegion>
        <div className="min-w-0 flex-1">
          <div className="border-b border-line bg-white px-5 py-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="mx-auto max-w-375 px-5 py-8 sm:px-9">
            {heading}
            {["dashboard", "order", "settings"].includes(variant) ? (
              <PageSkeleton variant={variant} />
            ) : (
              <TablePageSkeleton />
            )}
          </div>
        </div>
      </div>
    );
  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-330 grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 sm:px-7 md:grid-cols-[160px_1fr_240px]">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="order-3 col-span-2 h-12 w-full rounded-xl md:order-none md:col-span-1" />
        <Skeleton className="h-11 w-28 md:w-full" />
      </div>
      {pathname === "/" ? (
        <>
          <SkeletonRegion
            label="Loading storefront"
            className="startup-storefront bg-primary"
          >
            <div className="mx-auto grid min-h-[calc(100svh-100px)] max-w-330 items-center gap-10 px-6 py-10 min-[801px]:grid-cols-2 sm:px-7">
              <div className="space-y-6">
                <Skeleton className="h-4 w-40 opacity-30" />
                <Skeleton className="h-16 w-full max-w-120 opacity-30" />
                <Skeleton className="h-16 w-4/5 opacity-30" />
                <div className="space-y-3 opacity-30">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
                <Skeleton className="h-14 w-52 rounded-full opacity-60" />
              </div>
              <div className="w-full rounded-2xl border border-cream/20 bg-cream/5 p-5">
                <Skeleton className="mb-6 h-4 w-32 opacity-40" />
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map((key) => (
                    <div
                      key={key}
                      className="overflow-hidden rounded-xl bg-paper p-3"
                    >
                      <Skeleton className="aspect-[4/5] w-full rounded-lg" />
                      <Skeleton className="mb-3 mt-5 h-4 w-4/5" />
                      <Skeleton className="mb-2 h-4 w-1/2" />
                    </div>
                  ))}
                </div>
                <Skeleton className="mt-6 h-4 w-40 opacity-40" />
              </div>
            </div>
          </SkeletonRegion>
          <div className="mx-auto max-w-305 px-5 pb-12">
            <ProductSkeletons />
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-305 px-5 py-10 sm:px-7">
          {variant !== "auth" && heading}
          <PageSkeleton variant={variant} />
        </div>
      )}
    </div>
  );
}
