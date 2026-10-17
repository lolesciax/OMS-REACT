import useDialog from "../hooks/useDialog";
import Icon from "./Icon";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  busy,
  onConfirm,
  onClose,
}) {
  const ref = useDialog(true, () => {
    if (!busy) onClose();
  });
  return (
    <div
      className="ui-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={ref}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        tabIndex={-1}
      >
        <button
          className="ui-dialog-close"
          aria-label="Close confirmation"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="ui-dialog-actions">
          <button
            className="ui-button ui-button-light"
            disabled={busy}
            onClick={onClose}
          >
            Keep it
          </button>
          <button
            className="ui-button ui-button-dark"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
