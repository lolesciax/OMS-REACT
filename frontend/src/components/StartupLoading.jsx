import { useEffect, useState } from "react";
import RouteSkeleton from "./RouteSkeleton";

export default function StartupLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <RouteSkeleton />
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-2xl border border-line bg-white/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm"
      >
        <p className="text-body font-semibold text-primary">
          {slow ? "Getting the store ready…" : "Opening the store…"}
        </p>
        {slow && (
          <p className="mt-1 text-small leading-relaxed text-muted">
            The server is waking up. This can take up to 90 seconds. Your page
            will open automatically.
          </p>
        )}
      </div>
    </>
  );
}
