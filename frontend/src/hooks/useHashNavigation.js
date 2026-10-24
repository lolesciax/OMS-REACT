import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Lazy routes may finish rendering after the router updates the address bar.
export default function useHashNavigation() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const reveal = () => {
      const target = document.getElementById(id);
      if (!target) return false;
      target.scrollIntoView({ behavior: "instant", block: "start" });
      return true;
    };
    const frame = requestAnimationFrame(() => {
      if (reveal()) observer.disconnect();
    });
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname, hash]);
}
