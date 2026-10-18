import { apiFetch } from "./http";
import { API_BASE_URL } from "./config";
async function request(path, options = {}) {
  const response = await apiFetch(API_BASE_URL + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    const failure = new Error(
      data?.error || data?.message || "Request failed. Please try again.",
    );
    failure.fields = data?.fields || {};
    throw failure;
  }
  if (!data)
    throw new Error(
      "The server returned an unexpected response. Please try again.",
    );
  return data;
}
const post = (path, data) =>
  request(path, { method: "POST", body: JSON.stringify(data) });
export const authAPI = {
  healthCheck: () => request("/health"),
  checkUsername: (username) => post("/auth/check-username", { username }),
  checkEmail: (email) => post("/auth/check-email", { email }),
  signUp: (data) => post("/auth/register", data),
  login: (data) => post("/auth/login", data),
  requestPasswordReset: (data) => post("/auth/request-password-reset", data),
  forgotPassword: (data) => post("/auth/forgot-password", data),
};
