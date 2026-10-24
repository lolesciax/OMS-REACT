import AdminSidebar from "./AdminSidebar";
import { workspaceLinks } from "../utils/workspaceNavigation";
import NotificationBell from "./NotificationBell";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";
import Breadcrumbs from "./Breadcrumbs";
import { maintenanceModules } from "./maintenance/registry";
import "../styles/admin-workspace.css";

export default function AdminLayout({ children, title, description, actions }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const current =
    (pathname === "/admin/notifications" && "Notifications") ||
    (pathname === "/admin/out-of-stock" && "Products") ||
    workspaceLinks.find(([path]) => pathname.includes("/" + path))?.[1] ||
    "Order details";
  const module = pathname.startsWith("/admin/maintenance/")
    ? maintenanceModules[pathname.split("/")[3]]
    : null;
  const detailParent = module
    ? { to: "/admin/maintenance", label: "Maintenance" }
    : pathname.startsWith("/admin/view-orders/")
      ? { to: "/admin/orders", label: "Orders" }
      : pathname === "/admin/out-of-stock"
        ? { to: "/admin/products", label: "Products" }
        : null;
  return (
    <div className="admin-shell flex min-h-dvh bg-surface-soft text-ink max-[900px]:block">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <AdminSidebar key={user?._id} />
      <div className="admin-workspace min-w-0 flex-1 flex flex-col">
        <header className="admin-topbar">
          <Breadcrumbs
            items={[
              { to: "/admin/dashboard", label: "Workspace" },
              ...(detailParent ? [detailParent] : []),
              {
                label:
                  module?.title ||
                  (pathname === "/admin/out-of-stock"
                    ? "Out of stock"
                    : current),
              },
            ]}
          />
          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <Link
              to="/"
              aria-label="View storefront"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-3 text-small font-medium text-primary no-underline hover:bg-primary-soft"
            >
              <Icon name="bag" size={18} />
              <span className="hidden sm:inline">View store</span>
            </Link>
          </div>
        </header>
        <main
          id="admin-content"
          className="admin-content w-full max-w-375 my-0 mx-auto [padding:40px_36px_56px] max-[1150px]:py-8 max-[1150px]:px-6 max-[650px]:[padding:28px_20px_40px]"
        >
          <div className="admin-page-heading flex items-center justify-between gap-6 mb-[30px] max-[1150px]:items-start max-[650px]:flex-col max-[650px]:gap-[18px]">
            <div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {actions && <div className="admin-heading-actions">{actions}</div>}
          </div>
          {children}
        </main>
        <footer className="admin-workspace-footer">
          Old Goods Thrift <span>A little care goes a long way.</span>
        </footer>
      </div>
    </div>
  );
}
