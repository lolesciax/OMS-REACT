import Image from "./Image";
import { useState } from "react";
import NotificationBell from "./NotificationBell";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";
import "../styles/admin-workspace.css";

const links = [
  ["dashboard", "Overview", "leaf"],
  ["products", "Products", "bag"],
  ["orders", "Orders", "orders"],
  ["customers", "People", "user"],
  ["discounts", "Discount codes", "shield"],
  ["maintenance", "Maintenance", "settings"],
  ["notifications", "Notifications", "bell"],
];
export default function AdminLayout({ children, title, description, actions }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const maintenance = pathname.startsWith("/admin/maintenance");
  const navigate = useNavigate();
  const current =
    links.find(([path]) => pathname.includes("/" + path))?.[1] ||
    "Order details";
  return (
    <div className="admin-shell flex min-h-screen bg-[#f5f6f0] text-ink max-[900px]:block">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <aside className="admin-rail sticky top-0 w-65 flex-[0_0_260px] h-dvh overflow-y-auto [padding:32px_22px_24px] flex flex-col bg-[#26392d] text-[#d9e0d2] max-[1150px]:w-[205px] max-[1150px]:basis-[205px] max-[1150px]:px-4 max-[900px]:static max-[900px]:w-full max-[900px]:h-auto max-[900px]:py-[18px] max-[900px]:px-5 max-[900px]:grid max-[900px]:grid-cols-[1fr_auto] max-[900px]:gap-4">
        <Link to="/admin/dashboard" className="admin-brand">
          <Image src="/Shop Icon.jpg" alt="" />
          <span>
            Old Goods<span>Store workspace</span>
          </span>
        </Link>
        <span className="admin-nav-label">Your store</span>
        {maintenance && (
          <button
            type="button"
            className="col-span-full flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-body font-semibold text-white focus-visible:outline-white min-[901px]:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="store-management-nav"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            <Icon name="menu" size={18} />
            {mobileMenuOpen ? "Hide store menu" : "Store menu"}
          </button>
        )}
        <nav
          id="store-management-nav"
          aria-label="Store management"
          className={
            maintenance && !mobileMenuOpen ? "max-[900px]:hidden" : undefined
          }
        >
          {links.map(([path, label, icon]) => (
            <NavLink
              key={path}
              to={`/admin/${path}`}
              className={({ isActive }) =>
                isActive ||
                (path === "orders" && pathname.startsWith("/admin/view-orders"))
                  ? "active"
                  : undefined
              }
            >
              <Icon name={icon} size={19} />
              {label}
              <Icon name="chevron" size={14} />
            </NavLink>
          ))}
        </nav>
        <div className="admin-rail-bottom">
          <Link to="/">
            <Icon name="arrow" size={17} />
            Visit storefront
          </Link>
          <div className="admin-user">
            <span>{user?.username?.slice(0, 1).toUpperCase() || "A"}</span>
            <div>
              <strong>{user?.username || "Store admin"}</strong>
              <small>{user?.roleLabel || "Store workspace"}</small>
            </div>
          </div>
          <button
            onClick={async () => {
              if (await logout()) navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-workspace min-w-0 flex-1 flex flex-col">
        <header className="admin-topbar">
          <div>
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>{current}</strong>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link to="/">
              View store <Icon name="arrow" size={15} />
            </Link>
          </div>
        </header>
        <main
          id="admin-content"
          className="admin-content w-full max-w-375 my-0 mx-auto [padding:40px_36px_56px] max-[1150px]:py-8 max-[1150px]:px-6 max-[650px]:[padding:28px_20px_40px]"
        >
          <div className="admin-page-heading flex items-center justify-between gap-6 mb-[30px] max-[1150px]:items-start max-[650px]:flex-col max-[650px]:gap-[18px]">
            <div>
              <span className="ui-eyebrow">Old Goods / {current}</span>
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
