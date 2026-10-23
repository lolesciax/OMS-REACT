import { useEffect, useRef, useState } from "react";

export default function FieldTooltip({
  id,
  htmlFor,
  label,
  message,
  invalid = false,
  active = false,
  available = false,
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const root = useRef(null);
  const visible = (open || active) && !dismissed;
  useEffect(() => {
    setDismissed(false);
  }, [active, message]);
  useEffect(() => {
    if (!visible) return;
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setDismissed(true);
      }
    };
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [visible]);
  return (
    <div
      ref={root}
      className="relative flex items-center gap-2"
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={htmlFor}>{label}</label>
      <button
        type="button"
        className={`relative mb-[6px] inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-small font-semibold before:absolute before:-inset-2 ${invalid ? "border-[#c98d83] text-[#943b2c] bg-[#fff1ed]" : available ? "border-[#b1bbcb] text-primary bg-primary-soft" : "border-line text-muted bg-paper"}`}
        aria-label={`${invalid ? "Validation" : "Help"} for ${label.toLowerCase()}`}
        aria-describedby={id}
        aria-expanded={visible}
        aria-controls={id}
        onMouseEnter={() => {
          setOpen(true);
          setDismissed(false);
        }}
        onFocus={() => {
          setOpen(true);
          setDismissed(false);
        }}
        onClick={() => {
          setOpen(true);
          setDismissed(false);
        }}
      >
        <span aria-hidden="true">{invalid ? "!" : available ? "✓" : "?"}</span>
      </button>
      <div
        className={
          visible ? "absolute bottom-full left-0 z-30 w-full pb-2" : "sr-only"
        }
      >
        <p
          id={id}
          role="tooltip"
          className="rounded-lg bg-ink px-3 py-2 text-small font-normal leading-relaxed text-white shadow-lg [overflow-wrap:anywhere]"
        >
          {message}
        </p>
      </div>
    </div>
  );
}
