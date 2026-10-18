// Requests use the local Vite proxy unless VITE_API_URL is configured.
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || "/api").replace(
  /\/$/,
  "",
);
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");
