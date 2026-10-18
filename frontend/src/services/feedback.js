// Deliberate completed actions only: never call from polling or autosave effects.
export function createFeedbackStore() {
  let items = [];
  let sequence = 0;
  const listeners = new Set();
  const publish = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => items,
    add(message, tone = "success") {
      if (typeof message !== "string" || !message.trim()) return;
      const id = ++sequence;
      items = [...items, { id, message, tone }].slice(-4);
      publish();
      return id;
    },
    dismiss(id) {
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) return;
      items = next;
      publish();
    },
  };
}

export const feedbackStore = createFeedbackStore();
export const toast = {
  success: (message) => feedbackStore.add(message),
  info: (message) => feedbackStore.add(message, "info"),
  dismiss: (id) => feedbackStore.dismiss(id),
};
