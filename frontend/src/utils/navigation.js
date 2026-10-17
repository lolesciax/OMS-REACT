export function postLoginPath(user, requested) {
  const fallback = user?.isAdmin ? "/admin/dashboard" : "/";
  if (
    typeof requested !== "string" ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\")
  )
    return fallback;
  const path = requested.split(/[?#]/)[0];
  if (["/login", "/signup"].includes(path)) return fallback;
  if (path.startsWith("/admin") && !user?.isAdmin) return "/";
  return requested;
}
