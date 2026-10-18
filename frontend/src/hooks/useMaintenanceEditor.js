import { toast } from "../services/feedback";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import useFormValidation from "./useFormValidation";
import { useMaintenanceDraft } from "../components/maintenance/MaintenanceWorkspace";

export default function useMaintenanceEditor(options) {
  const { loadPath, savePath, prefix = "maintenance" } = options;
  const config = useRef(options);
  useEffect(() => {
    config.current = options;
  });
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [conflict, setConflict] = useState(false);

  const edit = useCallback((value) => {
    setForm(value);
  }, []);
  const [retry, setRetry] = useState(0);
  const [resetRevision, setResetRevision] = useState(0);
  const validation = useFormValidation(prefix);
  const validationRef = useRef(validation);
  useEffect(() => {
    validationRef.current = validation;
  });
  const dirty =
    saved !== null && JSON.stringify(form) !== JSON.stringify(saved);
  useMaintenanceDraft(dirty, busy);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setLoadError(false);
    setConflict(false);
    apiFetch(`${API_BASE_URL}${loadPath}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.success === false)
          throw new Error(data.error || "This module could not be loaded.");
        const value = config.current.select(data);
        if (!controller.signal.aborted) {
          setForm(value);
          setSaved(value);
          setSource(data);

          validationRef.current.reset();
          setResetRevision((value) => value + 1);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadPath, retry]);
  const save = async (event, fields = {}) => {
    event.preventDefault();
    if (busy || loading || !source || !dirty || !validation.check(fields))
      return;
    setBusy(true);
    setError("");

    setConflict(false);
    try {
      const body = config.current.serialize(form, source);
      const response = await apiFetch(`${API_BASE_URL}${savePath}`, {
        method: "PUT",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        validation.reject(data);
        setConflict(response.status === 409);
        throw new Error(data.error || "Changes could not be saved.");
      }
      const value = config.current.select(data);
      setForm(value);
      setSaved(value);
      setSource(data);
      validation.reset();
      setResetRevision((value) => value + 1);
      toast.success(
        config.current.successMessage || "Changes saved successfully.",
      );
      config.current.onSaved?.(data);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return {
    form,
    setForm: edit,
    saved,
    source,
    loading,
    busy,
    error,
    loadError,
    conflict,
    dirty,
    validation,
    resetRevision,
    save,
    reload: () => setRetry((value) => value + 1),
    discard: () => {
      if (dirty) toast.success("Unsaved changes discarded.");
      setForm(saved);
      setError("");

      setConflict(false);
      validation.reset();
      setResetRevision((value) => value + 1);
    },
  };
}
