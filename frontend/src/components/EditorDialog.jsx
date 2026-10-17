import useDialog from "../hooks/useDialog";
import Icon from "./Icon";

export default function EditorDialog({
  title,
  description,
  children,
  busy,
  onClose,
  wide = false,
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
        className={`ui-dialog editor-dialog ${wide ? "editor-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        tabIndex={-1}
      >
        <button
          className="ui-dialog-close"
          aria-label="Close editor"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <span className="ui-eyebrow">Store workspace</span>
        <h2 id="editor-title">{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </section>
    </div>
  );
}
