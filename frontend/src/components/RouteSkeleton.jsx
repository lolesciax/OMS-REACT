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
    : pathname.includes("settings")
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
      <div className="flex min-h-dvh flex-col bg-[#f5f6f0] min-[901px]:flex-row">
        <SkeletonRegion
          label="Loading workspace navigation"
          className="w-full shrink-0 bg-[#26392d] p-6 min-[901px]:w-65"
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
      <div className="flex h-21 items-center justify-between gap-6 border-b border-line px-5 sm:px-10">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      {pathname === "/" ? (
        <>
          <SkeletonRegion label="Loading storefront">
            <div className="mx-auto grid min-h-[calc(100svh-84px)] max-w-305 items-center gap-10 px-5 py-12 md:grid-cols-2 sm:px-7">
              <div className="space-y-7">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-4/5" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-12 w-56" />
              </div>
              <Skeleton className="mx-auto aspect-[4/5] w-full max-w-96 rounded-xl" />
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
