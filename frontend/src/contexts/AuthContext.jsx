import { toast } from "../services/feedback";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { apiFetch, setCSRFToken } from "../services/http";
import { API_BASE_URL } from "../services/config";
import { fetchSession } from "../services/session";
const AuthContext = createContext();
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const epoch = useRef(0);
  const restored = useRef(false);
  const signedIn = useRef(false);
  const inFlight = useRef(null);
  const clearSession = useCallback(() => {
    epoch.current++;
    setCSRFToken();
    signedIn.current = false;
    setUser(null);
  }, []);
  const checkAuthStatus = useCallback(
    (signal) => {
      if (inFlight.current && !inFlight.current.signal?.aborted)
        return inFlight.current.promise;
      const version = epoch.current;
      const startup = !restored.current;
      // A background check must not unmount the current page or its forms.
      if (startup) setLoading(true);
      setSessionError("");
      const promise = (async () => {
        try {
          const response = await fetchSession({ signal, startup });
          if (version !== epoch.current || signal?.aborted) return;
          const data = await response.json();
          if (version !== epoch.current || signal?.aborted) return;
          if (
            response.status === 401 ||
            (response.ok && data.authenticated === false && data.user === null)
          ) {
            restored.current = true;
            clearSession();
            setAuthError("");
            return;
          }
          if (!response.ok || !data.user)
            throw new Error(data.error || "Your session could not be loaded.");
          restored.current = true;
          signedIn.current = true;
          setAuthError((previous) =>
            previous.startsWith("Session refresh failed.") ? "" : previous,
          );
          setUser((previous) =>
            JSON.stringify(previous) === JSON.stringify(data.user)
              ? previous
              : data.user,
          );
        } catch (error) {
          if (!signal?.aborted && version === epoch.current) {
            if (restored.current)
              setAuthError(`Session refresh failed. ${error.message}`);
            else setSessionError(error.message);
          }
        } finally {
          if (inFlight.current?.promise === promise) {
            inFlight.current = null;
            if (!signal?.aborted) setLoading(false);
          }
        }
      })();
      inFlight.current = { promise, signal };
      return promise;
    },
    [clearSession],
  );
  useEffect(() => {
    const controller = new AbortController();
    checkAuthStatus(controller.signal);
    const refresh = () => {
      if (document.visibilityState === "visible" && signedIn.current)
        checkAuthStatus(controller.signal);
    };
    window.addEventListener("auth:expired", clearSession);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("auth:expired", clearSession);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [checkAuthStatus, clearSession]);
  const logout = useCallback(async () => {
    setAuthError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
      });
      if (!response.ok && response.status !== 401)
        throw new Error((await response.json()).error || "Sign-out failed.");
      clearSession();
      toast.success("You have been signed out.");
      return true;
    } catch (error) {
      setAuthError(`Could not sign out. ${error.message}`);
      return false;
    }
  }, [clearSession]);
  const updateUser = useCallback(
    (profile) => setUser((previous) => ({ ...previous, ...profile })),
    [],
  );
  const login = (data) => {
    epoch.current++;
    restored.current = true;
    signedIn.current = true;
    setLoading(false);
    setUser(data);
    setAuthError("");
    setSessionError("");
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        logout,
        updateUser,
        checkAuthStatus,
        authError,
        sessionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
