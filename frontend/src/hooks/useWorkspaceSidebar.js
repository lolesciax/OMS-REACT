import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import { toast } from "../services/feedback";
import {
  workspacePreferences,
  moveWorkspaceItem,
} from "../utils/workspaceNavigation";

export default function useWorkspaceSidebar() {
  const { user, updateUser } = useAuth();
  const [preferences, setPreferences] = useState(() =>
    workspacePreferences(user?.workspacePreferences),
  );
  const draft = useRef(preferences);
  const saved = useRef(preferences);
  const locked = useRef(false);
  const gesture = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(null);
  const preview = (value) => {
    draft.current = value;
    setPreferences(value);
  };
  const persist = async (value) => {
    if (
      locked.current ||
      JSON.stringify(value) === JSON.stringify(saved.current)
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/users/workspace-preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
      );
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error(data.error || "The sidebar layout could not be saved.");
      saved.current = workspacePreferences(data.workspacePreferences);
      preview(saved.current);
      updateUser({ workspacePreferences: saved.current });
      toast.success("Sidebar layout saved.");
    } catch (failure) {
      preview(saved.current);
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const begin = (event, kind, key) => {
    if (locked.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    // Reordered rows can move in the DOM and lose their own pointer capture.
    // Capture on the stable rail so mouse and touch drags survive either direction.
    event.currentTarget.closest("aside").setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      key,
      x: event.clientX,
      width: draft.current.sidebarWidth,
    };
    setDragging(key || "width");
  };
  const move = (event) => {
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "width") {
      preview({
        ...draft.current,
        sidebarWidth: Math.round(
          Math.max(220, Math.min(360, active.width + event.clientX - active.x)),
        ),
      });
    } else {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-sidebar-item]")?.dataset.sidebarItem;
      if (target && target !== active.key)
        preview({
          ...draft.current,
          sidebarOrder: moveWorkspaceItem(
            draft.current.sidebarOrder,
            active.key,
            target,
          ),
        });
    }
  };
  const end = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setDragging(null);
    persist(draft.current);
  };
  const cancel = () => {
    gesture.current = null;
    setDragging(null);
    preview(saved.current);
  };
  const nudge = (key, direction) => {
    const order = draft.current.sidebarOrder;
    const target = order[order.indexOf(key) + direction];
    if (!target || target === "maintenance") return;
    const next = {
      ...draft.current,
      sidebarOrder: moveWorkspaceItem(order, key, target),
    };
    preview(next);
    persist(next);
  };
  return {
    preferences,
    busy,
    error,
    setError,
    dragging,
    preview,
    persist,
    begin,
    move,
    end,
    cancel,
    nudge,
    draft,
    gesture,
    locked,
  };
}
