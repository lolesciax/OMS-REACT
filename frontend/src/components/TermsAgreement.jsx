import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import FieldError from "./FieldError";
import Skeleton from "./Skeleton";
import { Link } from "react-router-dom";

export default function TermsAgreement({
  kind,
  value,
  onChange,
  error,
  disabled = false,
  id,
}) {
  const [policy, setPolicy] = useState(null);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const controller = new AbortController();
    setFailure("");
    setPolicy(null);
    apiFetch(`${API_BASE_URL}/policies/${kind}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Terms could not be loaded.");
        if (!controller.signal.aborted) {
          setPolicy(data.policy);
          callback.current({ accepted: false, version: data.policy._id });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setFailure(failure.message);
      });
    return () => controller.abort();
  }, [kind, retry]);
  return (
    <div className="my-4 min-w-0">
      {failure ? (
        <div className="text-body text-[#8d3326]" role="alert">
          {failure}
          <button
            type="button"
            className="ui-button ui-button-light mt-3"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry terms
          </button>
        </div>
      ) : !policy ? (
        <div role="status">
          <span className="sr-only">Loading terms and conditions</span>
          <Skeleton className="h-6 w-full rounded" />
        </div>
      ) : (
        <div className="flex items-start gap-3 py-1 text-small leading-relaxed text-muted">
          <input
            id={id}
            name="termsAccepted"
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-forest"
            type="checkbox"
            checked={value.accepted}
            disabled={disabled}
            aria-invalid={!!error}
            aria-labelledby={`${id}-label`}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) =>
              onChange({
                accepted: event.target.checked,
                version: policy._id,
              })
            }
          />
          <span id={`${id}-label`}>
            <label htmlFor={id} className="cursor-pointer">
              I agree to the{" "}
            </label>
            <Link
              to={`/terms#${kind}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-forest underline underline-offset-2 hover:text-accent"
            >
              {kind === "order"
                ? "Order Terms & Conditions"
                : "Terms & Conditions"}
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            {" and "}
            <Link
              to="/policies/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-forest underline underline-offset-2 hover:text-accent"
            >
              Privacy Policy
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </span>
        </div>
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
