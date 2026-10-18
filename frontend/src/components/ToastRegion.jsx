import { useEffect, useState, useSyncExternalStore } from "react";
import { feedbackStore, toast } from "../services/feedback";

function Toast({ item, hidden }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused || hidden) return;
    // Restart the reading window after interaction or returning to the tab.
    const timer = setTimeout(() => toast.dismiss(item.id), 8000);
    return () => clearTimeout(timer);
  }, [item.id, hovered, focused, hidden]);
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-body text-ink shadow-xl motion-safe:animate-[toast-enter_180ms_ease-out]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#edf3e9] font-bold text-forest">
        {item.tone === "success" ? "✓" : "i"}
      </span>
      <div className="min-w-0 flex-1 break-words leading-relaxed" role="status" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{item.tone === "success" ? "Success. " : "Notice. "}</span>
        {item.message}
      </div>
      <button
        type="button"
        className="-my-2 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        aria-label={`Dismiss: ${item.message}`}
        onClick={() => toast.dismiss(item.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export default function ToastRegion() {
  const items = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getSnapshot);
  const [hidden, setHidden] = useState(document.visibilityState === "hidden");
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <section aria-label="Action feedback" className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[10000] flex max-h-[70dvh] flex-col gap-3 overflow-y-auto p-1 sm:left-auto sm:right-6 sm:w-[min(25rem,calc(100vw-3rem))]">
      {items.map((item) => <Toast key={item.id} item={item} hidden={hidden} />)}
    </section>
  );
}
