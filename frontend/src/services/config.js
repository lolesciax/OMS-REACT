// Requests use the local Vite proxy unless VITE_API_URL is configured.
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || "/api").replace(
  /\/$/,
  "",
);
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");
export const paymentQR = (method) =>
  method === "gcash"
    ? import.meta.env.VITE_GCASH_QR_URL || ""
    : import.meta.env.VITE_PAYMAYA_QR_URL || "";
