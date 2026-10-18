import { useEffect, useRef } from "react";

export default function useScrollReveal(revision) {
  const root = useRef(null);
  const revealed = useRef(new WeakSet());

  useEffect(() => {
    const element = root.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || !window.IntersectionObserver) return;
    const animations = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target;
          observer.unobserve(target);
          revealed.current.add(target);
          if (preference.matches || !target.animate) continue;
          const animation = target.animate(
            [
              { opacity: 0, translate: "0 18px" },
              { opacity: 1, translate: "0 0" },
            ],
            {
              duration: 550,
              delay: Number(target.dataset.revealDelay || 0),
              fill: "backwards",
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          );
          animations.add(animation);
          animation.finished.then(
            () => animations.delete(animation),
            () => animations.delete(animation),
          );
        }
      },
      { threshold: 0.08 },
    );
    const observe = () => {
      if (preference.matches) {
        observer.disconnect();
        animations.forEach((animation) => animation.cancel());
        return;
      }
      element.querySelectorAll("[data-reveal]").forEach((target) => {
        if (!revealed.current.has(target)) observer.observe(target);
      });
    };
    observe();
    preference.addEventListener("change", observe);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", observe);
    };
  }, [revision]);

  return root;
}
