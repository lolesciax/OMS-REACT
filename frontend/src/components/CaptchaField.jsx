import "altcha";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../services/config";
import FieldError from "./FieldError";

export default function CaptchaField({
  purpose,
  onChange,
  error,
  id,
  compact = false,
}) {
  const ref = useRef(null);
  const callback = useRef(onChange);
  const [status, setStatus] = useState("unverified");
  const [failure, setFailure] = useState("");
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const element = ref.current;
    const changed = (event) => {
      const state = event.detail.state;
      setStatus(state);
      setFailure(
        state === "error"
          ? "Verification could not be completed. Check your connection and try again."
          : state === "expired"
            ? "Verification expired. Please verify again."
            : "",
      );
      callback.current(
        event.detail.state === "verified"
          ? event.detail.payload || element.value || ""
          : "",
      );
    };
    element.addEventListener("statechange", changed);
    return () => element.removeEventListener("statechange", changed);
  }, []);
  return (
    <div
      className={`${compact ? "my-3" : "my-5"} min-w-0`}
      id={id}
      tabIndex={-1}
    >
      <p className={compact ? "sr-only" : "mb-2 text-small font-semibold"}>
        Security verification
      </p>
      <altcha-widget
        ref={ref}
        challenge={`${API_BASE_URL}/auth/captcha?purpose=${purpose}`}
        name="captcha"
        workers="2"
        style={{
          "--altcha-max-width": "100%",
          "--altcha-border-radius": "8px",
        }}
      />
      <FieldError id={`${id}-error`} error={failure || error} />
      {failure && (
        <button
          type="button"
          className="ui-button ui-button-light mt-3"
          disabled={status === "verifying"}
          onClick={async () => {
            callback.current("");
            setFailure("");
            try {
              await ref.current.reset();
              await ref.current.verify();
            } catch {
              setFailure("Verification is unavailable. Please try again.");
            }
          }}
        >
          Retry verification
        </button>
      )}
    </div>
  );
}
