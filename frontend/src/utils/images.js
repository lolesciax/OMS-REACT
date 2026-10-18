import { BACKEND_URL } from "../services/config.js";

export function imageURL(value, fallback = "/product-placeholder.svg") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const source = value.trim().replaceAll("\\", "/");
  if (/^(blob:|data:image\/)/i.test(source)) return source;
  if (/default-product\.(jpg|png)$/i.test(source)) return fallback;
  const bundledProduct = source.match(/(?:^|\/)(p[1-7]\.jpg)$/i);
  if (bundledProduct) return `/${bundledProduct[1]}`;
  // Historical orders may contain an old backend host or the old upload route.
  const upload = source.match(/(?:^|\/)(?:static\/)?uploads\/(.+)$/i);
  if (upload) return `${BACKEND_URL}/static/uploads/${upload[1]}`;
  if (/^https?:\/\//i.test(source) || source.startsWith("/")) return source;
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return fallback;
  return `${BACKEND_URL}/static/uploads/${source}`;
}
