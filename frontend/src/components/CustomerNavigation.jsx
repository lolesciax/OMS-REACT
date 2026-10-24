import { Link, NavLink, useLocation } from "react-router-dom";
import Breadcrumbs from "./Breadcrumbs";
import Icon from "./Icon";

const accountPages = [
  ["/profile", "Account", "user"],
  ["/order-history", "Orders", "orders"],
  ["/notifications", "Notifications", "bell"],
];
const titles = {
  "/cart": "Your bag",
  "/checkout": "Checkout",
  "/profile": "Your account",
  "/order-history": "Your orders",
  "/notifications": "Notifications",
  "/help": "Help centre",
  "/faqs": "FAQs",
  "/policies": "Store policies",
  "/policies/privacy": "Privacy policy",
  "/policies/shipping": "Shipping & delivery",
  "/policies/returns": "Returns & order issues",
  "/terms": "Terms & conditions",
  "/contact": "Contact us",
};

export default function CustomerNavigation() {
  const { pathname } = useLocation();
  const isAccount = accountPages.some(([path]) => path === pathname);
  const title = titles[pathname];
  if (!title) return null;
  const parent =
    pathname === "/checkout"
      ? { to: "/cart", label: "Your bag" }
      : /^\/(faqs|policies|terms|contact)/.test(pathname)
        ? { to: "/help", label: "Help centre" }
        : null;
  return (
    <div className="customer-navigation">
      <Breadcrumbs
        items={[
          { to: "/", label: "Shop" },
          ...(parent ? [parent] : []),
          { label: title },
        ]}
      />
      {isAccount && (
        <nav
          className="customer-account-navigation"
          aria-label="Your account navigation"
        >
          {accountPages.map(([path, label, icon]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `customer-account-link${isActive ? " is-active" : ""}`
              }
            >
              <Icon name={icon} size={18} />
              {label}
            </NavLink>
          ))}
          <Link className="customer-account-link" to="/?liked=true#collection">
            <Icon name="heart" size={18} />
            Saved finds
          </Link>
        </nav>
      )}
    </div>
  );
}
