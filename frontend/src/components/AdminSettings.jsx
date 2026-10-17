import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import Image from "./Image";
import UploadField from "./UploadField";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";

export default function AdminSettings() {
  const [methods, setMethods] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    apiFetch(`${BACKEND_URL}/api/admin/settings`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Store settings could not be loaded.");
        setMethods(data.methods);
        setRecovery(data.passwordRecoveryConfigured);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [retry]);
  const change = (key, field, value) =>
    setMethods((previous) => ({
      ...previous,
      [key]: { ...previous[key], [field]: value },
    }));
  const save = async (event, key) => {
    event.preventDefault();
    if (busy) return;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("merchantName", methods[key].merchantName.trim());
      body.set("enabled", String(methods[key].enabled));
      if (files[key]) body.set("image", files[key]);
      const response = await apiFetch(
        `${BACKEND_URL}/api/admin/settings/payments/${key}`,
        { method: "PUT", body },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Payment settings could not be saved.");
      setMethods((previous) => ({ ...previous, [key]: data.methods[key] }));
      setFiles((previous) => ({ ...previous, [key]: null }));
      setMessage(`${data.methods[key].label} payment settings saved.`);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <AdminLayout
      title="Store settings"
      description="Manage the merchant QR codes customers use at checkout."
    >
      {error && (
        <div className="ui-message error" role="alert">
          {error}
          {!methods && (
            <button
              className="ui-button ui-button-light"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {message && (
        <div className="ui-message success" role="status">
          {message}
        </div>
      )}
      {!methods && !error && (
        <div className="ui-empty" role="status">
          Loading store settings…
        </div>
      )}
      <div className="payment-settings-grid">
        {methods &&
          Object.entries(methods).map(([key, method]) => (
            <form
              className="admin-panel padded"
              key={key}
              onSubmit={(event) => save(event, key)}
            >
              <h2>{method.label}</h2>
              <p className="admin-help">
                Upload your real merchant QR code. Check the recipient and try
                scanning the image before enabling payments.
              </p>
              {method.qrUrl && (
                <div className="settings-qr">
                  <Image
                    src={method.qrUrl}
                    alt={`${method.label} merchant QR code`}
                  />
                </div>
              )}
              <div className="ui-field">
                <label htmlFor={`${key}-merchant`}>Merchant name</label>
                <input
                  id={`${key}-merchant`}
                  value={method.merchantName}
                  maxLength={100}
                  required
                  disabled={!!busy}
                  onChange={(event) =>
                    change(key, "merchantName", event.target.value)
                  }
                  placeholder="Name shown in the wallet app"
                />
              </div>
              <UploadField
                label={method.qrUrl ? "Replace QR image" : "Merchant QR image"}
                file={files[key]}
                onChange={(file) =>
                  setFiles((previous) => ({ ...previous, [key]: file }))
                }
                onError={setError}
                disabled={!!busy}
              />
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  disabled={!!busy}
                  onChange={(event) =>
                    change(key, "enabled", event.target.checked)
                  }
                />
                Available at checkout
              </label>
              <button className="ui-button ui-button-dark" disabled={!!busy}>
                {busy === key ? "Saving…" : `Save ${method.label}`}
              </button>
            </form>
          ))}
      </div>
      <section className="admin-panel padded">
        <h2>Password recovery</h2>
        <p className="admin-help">
          {recovery
            ? "Store email is configured. Customers can request a recovery code from the sign-in page."
            : "Store email is not configured. Configure the store’s email service before customers can receive recovery codes."}
        </p>
      </section>
    </AdminLayout>
  );
}
