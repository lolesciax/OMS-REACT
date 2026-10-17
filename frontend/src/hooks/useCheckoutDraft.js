import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";

export default function useCheckoutDraft(payload, enabled) {
  const [error, setError] = useState("");
  const editor = useRef(crypto.randomUUID());
  const version = useRef(0);
  const latest = useRef(null);
  const saved = useRef("");
  const mounted = useRef(true);
  const body = JSON.stringify(payload);
  const save = useCallback(async (entry, keepalive = false) => {
    if (!entry || entry.source === saved.current) return;
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/checkout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: entry.body,
        keepalive,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Checkout changes could not be saved.");
      if (latest.current?.body === entry.body) {
        saved.current = entry.source;
        if (mounted.current) setError("");
      }
    } catch (error) {
      if (mounted.current && latest.current?.body === entry.body)
        setError(error.message);
    }
  }, []);
  useEffect(() => {
    if (!enabled) {
      latest.current = null;
      return;
    }
    const entry = {
      source: body,
      body: JSON.stringify({
        ...JSON.parse(body),
        editorId: editor.current,
        editVersion: ++version.current,
      }),
    };
    latest.current = entry;
    const timer = setTimeout(() => save(entry), 400);
    return () => clearTimeout(timer);
  }, [body, enabled, save]);
  useEffect(() => {
    mounted.current = true;
    const flush = () => save(latest.current, true);
    const hide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [save]);
  return { error, retry: () => save(latest.current) };
}
