import { useEffect } from "react";
import { observeViewport } from "../services/browserViewport";

// CSS viewport units alone do not follow the on-screen keyboard in every browser.
export default function useViewportMetrics() {
  useEffect(() => observeViewport(window, document.documentElement.style), []);
}
