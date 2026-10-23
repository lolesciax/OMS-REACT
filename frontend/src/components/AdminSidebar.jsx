import useWorkspaceSidebar from "../hooks/useWorkspaceSidebar";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  workspaceLinks,
  workspacePreferences,
} from "../utils/workspaceNavigation";
import Icon from "./Icon";
import Image from "./Image";

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [arranging, setArranging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
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
  } = useWorkspaceSidebar();
  return (
    <aside
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget && gesture.current) cancel();
      }}
      style={{ "--workspace-sidebar-width": `${preferences.sidebarWidth}px` }}
      className="admin-rail workspace-sidebar relative sticky top-0 flex h-dvh w-[var(--workspace-sidebar-width)] flex-[0_0_var(--workspace-sidebar-width)] flex-col overflow-y-auto border-r border-line bg-paper px-4 py-6 text-ink max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:basis-auto max-[900px]:border-b max-[900px]:px-5 max-[900px]:py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/admin/dashboard" className="workspace-brand">
          <Image src="/Shop Icon.jpg" alt="" />
          <span>
            Old Goods<span>Admin workspace</span>
          </span>
        </Link>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-xl border border-line bg-white text-primary min-[901px]:hidden"
          aria-label={mobileOpen ? "Hide store menu" : "Show store menu"}
          aria-expanded={mobileOpen}
          aria-controls="store-management-nav"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon name={mobileOpen ? "close" : "menu"} />
        </button>
      </div>
      <div
        className={`mt-9 mb-3 flex items-center justify-between gap-2 ${!mobileOpen ? "max-[900px]:hidden" : ""}`}
      >
        <span className="pl-3 text-small font-semibold text-muted">
          Workspace
        </span>
        <button
          type="button"
          disabled={busy || !!dragging}
          aria-label={
            arranging ? "Finish arranging navigation" : "Arrange navigation"
          }
          aria-pressed={arranging}
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-small font-medium text-muted transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-50"
          onClick={() => setArranging(!arranging)}
        >
          <Icon name={arranging ? "check" : "sliders"} size={16} />
          {arranging ? "Done" : "Arrange"}
        </button>
      </div>
      {arranging && (
        <p
          id="sidebar-reorder-help"
          className={`mb-3 rounded-xl bg-primary-soft p-3 text-small leading-relaxed text-primary ${!mobileOpen ? "max-[900px]:hidden" : ""}`}
        >
          Drag the grips to reorder. With a grip focused, use the up and down
          arrow keys. Changes save automatically.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="my-3 rounded-xl border border-[#eeb9a5] bg-[#fff4ef] p-3 text-small text-[#8d3326]"
        >
          {error} Your previous layout was restored.
          <button
            type="button"
            className="mt-2 block underline"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}
      <nav
        id="store-management-nav"
        aria-label="Store management"
        className={`sidebar-navigation ${!mobileOpen ? "sidebar-menu-closed" : ""}`}
        aria-busy={busy}
      >
        {preferences.sidebarOrder.map((key) => {
          const [, label, icon] = workspaceLinks.find(([path]) => path === key);
          const pinned = key === "maintenance";
          return (
            <div
              key={key}
              data-sidebar-item={key}
              className={`sidebar-nav-item ${pinned ? "sidebar-nav-pinned" : ""} ${dragging === key ? "ring-2 ring-primary/40 bg-primary-soft rounded-xl" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-1">
                {arranging && !pinned && (
                  <button
                    type="button"
                    aria-label={`Drag ${label} to reorder`}
                    title={`Drag ${label}`}
                    disabled={busy}
                    aria-describedby="sidebar-reorder-help"
                    className="flex min-h-11 w-7 shrink-0 touch-none cursor-grab select-none items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary active:cursor-grabbing"
                    onPointerDown={(event) => begin(event, "order", key)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancel();
                      if (
                        !busy &&
                        ["ArrowUp", "ArrowDown"].includes(event.key)
                      ) {
                        event.preventDefault();
                        nudge(key, event.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                  >
                    <Icon name="grip" size={18} strokeWidth={3} />
                  </button>
                )}
                <NavLink
                  to={`/admin/${key}`}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    isActive ||
                    (key === "products" &&
                      pathname === "/admin/out-of-stock") ||
                    (key === "orders" &&
                      pathname.startsWith("/admin/view-orders"))
                      ? "active"
                      : undefined
                  }
                >
                  <Icon name={icon} size={20} />
                  <span className="min-w-0 flex-1">{label}</span>
                  {pinned ? (
                    <span
                      title="Maintenance stays last"
                      className="sidebar-pin"
                    >
                      <Icon name="lock" size={14} />
                      <span className="sr-only">Fixed last</span>
                    </span>
                  ) : (
                    <Icon name="chevron" size={14} />
                  )}
                </NavLink>
              </div>
            </div>
          );
        })}
      </nav>
      {arranging && (
        <button
          type="button"
          disabled={busy}
          className={`mt-3 min-h-10 cursor-pointer rounded-lg text-small font-medium text-muted underline decoration-line underline-offset-4 hover:text-primary disabled:opacity-50 ${!mobileOpen ? "max-[900px]:hidden" : ""}`}
          onClick={() => {
            const next = workspacePreferences();
            preview(next);
            persist(next);
          }}
        >
          Reset sidebar layout
        </button>
      )}
      {busy && (
        <p role="status" className="mt-3 text-small text-muted">
          Saving layout…
        </p>
      )}
      <div
        className={`workspace-sidebar-footer ${!mobileOpen ? "max-[900px]:hidden" : ""}`}
      >
        <Link to="/" className="workspace-store-link">
          <Icon name="bag" size={18} />
          <span>Visit storefront</span>
          <Icon name="arrow" size={16} />
        </Link>
        <div className="workspace-profile">
          <span className="workspace-avatar" aria-hidden="true">
            {user?.username?.slice(0, 1).toUpperCase() || "A"}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-small font-semibold">
              {user?.username || "Store admin"}
            </strong>
            <span className="block truncate text-small text-muted">
              {user?.roleLabel || "Store workspace"}
            </span>
          </div>
          <button
            type="button"
            className="workspace-signout"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              if (await logout()) navigate("/login");
            }}
          >
            <Icon name="logout" size={19} />
          </button>
        </div>
      </div>
      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={220}
        aria-valuemax={360}
        aria-valuenow={preferences.sidebarWidth}
        tabIndex={busy ? -1 : 0}
        title="Drag to resize. Use arrow keys to adjust width."
        className="absolute inset-y-0 right-0 z-10 w-2 touch-none cursor-col-resize border-r border-transparent hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary max-[900px]:hidden"
        onPointerDown={(event) => begin(event, "width")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancel();
            return;
          }
          if (
            locked.current ||
            !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
          )
            return;
          event.preventDefault();
          const width =
            event.key === "Home"
              ? 220
              : event.key === "End"
                ? 360
                : Math.max(
                    220,
                    Math.min(
                      360,
                      draft.current.sidebarWidth +
                        (event.key === "ArrowLeft" ? -10 : 10),
                    ),
                  );
          preview({ ...draft.current, sidebarWidth: width });
        }}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            persist(draft.current);
        }}
        onBlur={() => {
          if (!gesture.current) persist(draft.current);
        }}
      />
    </aside>
  );
}
