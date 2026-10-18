// Watch the visual viewport without resizing the app during browser pinch zoom.
export function observeViewport(win, style) {
  const viewport = win.visualViewport;
  let frame;
  const update = () => {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      style.setProperty(
        "--app-viewport-height",
        `${viewport?.height || win.innerHeight}px`,
      );
      style.setProperty(
        "--app-viewport-top",
        `${Math.max(0, viewport?.offsetTop || 0)}px`,
      );
    });
  };
  update();
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  win.addEventListener("resize", update);
  return () => {
    win.cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    win.removeEventListener("resize", update);
    style.removeProperty("--app-viewport-height");
    style.removeProperty("--app-viewport-top");
  };
}
