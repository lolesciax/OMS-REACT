import { useId } from "react";
import Skeleton from "../Skeleton";
import Icon from "../Icon";

export function MaintenancePanel({
  title,
  description,
  actions,
  children,
  className = "",
}) {
  const heading = useId();
  return (
    <section
      className={`admin-panel padded min-w-0 ${className}`}
      aria-labelledby={heading}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={heading}>{title}</h2>
          {description && (
            <p className="mt-2 max-w-3xl text-body leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function MaintenanceFeedback({
  error,
  onRetry,
  busy = false,
  retryLabel = "Try again",
}) {
  return (
    <>
      {error && (
        <div className="ui-message error mb-5" role="alert">
          <p className="break-words">{error}</p>
          {onRetry && (
            <button
              type="button"
              className="ui-button ui-button-light mt-3"
              disabled={busy}
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function MaintenanceLoading({ label = "Loading module" }) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
export function MaintenanceSaveBar({
  dirty,
  busy,
  onDiscard,
  label = "Save changes",
  busyLabel = "Savingâ€¦",
  note,
  disabled = false,
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="min-w-0">
        <p
          className={`flex items-center gap-2 text-small font-semibold ${dirty ? "text-[#8b572b]" : "text-forest"}`}
          role="status"
        >
          <Icon name={dirty ? "orders" : "check"} size={16} />
          {busy ? busyLabel : dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        {note && <p className="mt-1 text-small text-muted">{note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {onDiscard && (
          <button
            type="button"
            className="ui-button ui-button-light"
            disabled={!dirty || busy}
            onClick={onDiscard}
          >
            Discard changes
          </button>
        )}
        <button
          type="submit"
          className="ui-button ui-button-dark"
          disabled={!dirty || busy || disabled}
        >
          {busy ? busyLabel : label}
        </button>
      </div>
    </div>
  );
}
