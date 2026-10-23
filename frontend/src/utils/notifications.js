export const notificationCategories = {
  orders: "Orders",
  account: "Account & security",
  inventory: "Inventory",
  store: "Store updates",
};

export function notificationDestination(value, isAdmin) {
  const fallback = isAdmin ? "/admin/notifications" : "/notifications";
  if (value === "/admin/settings" && isAdmin) return "/admin/maintenance";
  if (typeof value !== "string" || /[\\\s]/.test(value)) return fallback;
  if (
    /^\/order-history\?order=[a-f0-9]{24}$/i.test(value) ||
    value === "/profile"
  )
    return value;
  if (
    isAdmin &&
    (/^\/admin\/view-orders\/[a-f0-9]{24}$/i.test(value) ||
      [
        "/admin/products",
        "/admin/maintenance",
        "/admin/maintenance/roles",
        "/admin/maintenance/security",
        "/admin/maintenance/profile",
        "/admin/maintenance/catalog",
        "/admin/customers",
        "/admin/maintenance/payments",
        "/admin/maintenance/policies",
        "/admin/maintenance/faqs",
        "/admin/maintenance/support",
      ].includes(value))
  )
    return value;
  return fallback;
}

export function notificationTime(value, now = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  const seconds = Math.max(0, (now - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const [divisor, unit] =
    seconds < 3600
      ? [60, "minute"]
      : seconds < 86400
        ? [3600, "hour"]
        : [86400, "day"];
  if (seconds < 604800)
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      -Math.floor(seconds / divisor),
      unit,
    );
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
