import Image from "./Image";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";
import "../styles/admin-workspace.css";
import "../styles/auth-pages.css";

const links = [
  ["dashboard", "Overview", "leaf"],
  ["products", "Products", "bag"],
  ["orders", "Orders", "orders"],
  ["customers", "People", "user"],
  ["discounts", "Discount codes", "shield"],
  ["settings", "Settings", "user"],
];
export default function AdminLayout({ children, title, description, actions }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current =
    links.find(([path]) => pathname.includes("/" + path))?.[1] ||
    "Order details";
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <aside className="admin-rail">
        <Link to="/admin/dashboard" className="admin-brand">
          <Image src="/Shop Icon.jpg" alt="" />
          <span>
            Old Goods<span>Store workspace</span>
          </span>
        </Link>
        <span className="admin-nav-label">Your store</span>
        <nav aria-label="Store management">
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
              <small>Administrator</small>
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
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>{current}</strong>
          </div>
          <Link to="/">
            View store <Icon name="arrow" size={15} />
          </Link>
        </header>
        <main id="admin-content" className="admin-content">
          <div className="admin-page-heading">
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
