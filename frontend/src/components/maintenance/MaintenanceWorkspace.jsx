import { toast } from "../../services/feedback";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ConfirmDialog from "../ConfirmDialog";

const DraftContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export function useMaintenanceDraft(dirty, busy = false) {
  const context = useContext(DraftContext);
  const id = useId();
  const register = context?.register;
  useEffect(() => {
    register?.(id, { dirty, busy });
    return () => register?.(id, null);
  }, [register, id, dirty, busy]);
}

export default function MaintenanceWorkspace({ children }) {
  const [drafts, setDrafts] = useState({});
  const [destination, setDestination] = useState(null);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const register = useCallback(
    (id, value) =>
      setDrafts((previous) => {
        if (
          value &&
          previous[id]?.dirty === value.dirty &&
          previous[id]?.busy === value.busy
        )
          return previous;
        const next = { ...previous };
        if (value) next[id] = value;
        else delete next[id];
        return next;
      }),
    [],
  );
  const dirty = Object.values(drafts).some((value) => value.dirty);
  const busy = Object.values(drafts).some((value) => value.busy);
  const context = useMemo(() => ({ register }), [register]);
  useEffect(() => {
    const unload = (event) => {
      if (dirty || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event) => {
      if (
        !(dirty || busy) ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const target = new URL(link.href, location.origin);
      if (
        target.origin !== location.origin ||
        (target.pathname === pathname && target.search === search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (busy)
        setNotice(
          "A save is in progress. Wait for it to finish before leaving this page.",
        );
      else setDestination(target.pathname + target.search + target.hash);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, busy, pathname, search]);
  return (
    <DraftContext.Provider value={context}>
      {notice && (
        <div className="ui-message error mx-5 my-3" role="alert">
          {notice}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
      {destination && (
        <ConfirmDialog
          title="Leave unsaved changes?"
          description="Your edits on this page have not been saved. Stay to continue editing, or discard them and leave."
          confirmLabel="Discard and leave"
          onClose={() => setDestination(null)}
          onConfirm={() => {
            setDestination(null);
            navigate(destination);
            toast.success("Unsaved changes discarded.");
          }}
        />
      )}
    </DraftContext.Provider>
  );
}
