import Image from "./Image";
import NotificationBell from "./NotificationBell";
import { useEffect, useState, useRef, useId } from "react";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";
import StoreSearch from "./StoreSearch";

export default function StoreHeader({
  cartCount,
  compact = false,
  searchValue,
  onSearchChange,
}) {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [count, setCount] = useState({ userId: null, value: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const headerRef = useRef(null);
  const accountRef = useRef(null);
  const accountButton = useRef(null);
  const mobileButton = useRef(null);
  const menuId = useId();
  const accountId = useId();
  const closeMenus = () => {
    setMobileOpen(false);
    setAccountOpen(false);
  };
  useEffect(() => {
    const outside = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setMobileOpen(false);
        setAccountOpen(false);
      } else if (!accountRef.current?.contains(event.target))
        setAccountOpen(false);
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      if (accountOpen) {
        setAccountOpen(false);
        accountButton.current?.focus();
      } else if (mobileOpen) {
        setMobileOpen(false);
        mobileButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen, mobileOpen]);
  const userId = user?._id || user?.id;
  useEffect(() => {
    if (!userId || cartCount !== undefined) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/cart/${userId}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok && data.success && !controller.signal.aborted)
          setCount({
            userId,
            value: (data.cart || []).reduce(
              (sum, item) => sum + Number(item.qty || 0),
              0,
            ),
          });
      } catch {
        /* A cart refresh should not block navigation. */
      }
    };
    refresh();
    window.addEventListener("cart:changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("cart:changed", refresh);
    };
  }, [userId, cartCount]);
  const displayCount = cartCount ?? (count.userId === userId ? count.value : 0);
  const likedItemsActive =
    pathname === "/" && new URLSearchParams(search).get("liked") === "true";
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (await logout()) {
        closeMenus();
        navigate("/");
      }
    } finally {
      setSigningOut(false);
    }
  };
  const primaryLinks = [
    ["/", "Shop", "bag"],
    ...(isLoggedIn ? [["/order-history", "Orders", "orders"]] : []),
    ["/help", "Help", "leaf"],
  ];
  const accountLinks = [
    ["/profile", "Your account", "user"],
    ...(user?.isAdmin
      ? [["/admin/dashboard", "Manage store", "settings"]]
      : []),
  ];
  const navClass = ({ isActive }) =>
    `store-nav-link${isActive ? " is-active" : ""}`;
  const primaryClass =
    (path) =>
    ({ isActive }) =>
      navClass({
        isActive:
          isActive ||
          (path === "/help" &&
            /^\/(help|faqs|terms|contact|policies)(\/|$)/.test(pathname)),
      });
  return (
    <header
      ref={headerRef}
      className="store-header relative z-30 border-b border-line bg-paper"
    >
      <div className="mx-auto grid min-h-[88px] max-w-[1328px] grid-cols-[auto_1fr_auto] items-center gap-x-2 px-4 py-4 sm:gap-x-6 sm:px-6 min-[1280px]:grid-cols-[auto_minmax(180px,1fr)_auto_auto]">
        <Link
          className="store-brand shrink-0"
          to="/"
          aria-label="Old Goods Thrift home"
          onClick={closeMenus}
        >
          <Image src="/Shop Icon.jpg" alt="" className="max-[900px]:size-9" />
          <span>
            Old Goods<span className="brand-second">Thrift.</span>
          </span>
        </Link>
        <StoreSearch
          key={pathname}
          value={searchValue}
          onChange={onSearchChange}
          onSubmit={closeMenus}
        />
        {!compact && (
          <nav
            className="col-start-2 row-start-1 hidden items-center justify-center gap-2 min-[901px]:flex min-[1280px]:col-start-3"
            aria-label="Main navigation"
          >
            {primaryLinks.map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={primaryClass(path)}
                onClick={closeMenus}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 sm:gap-3 min-[1280px]:col-start-4">
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <Link
                to={isLoggedIn ? "/?liked=true#collection" : "/login"}
                state={
                  isLoggedIn ? undefined : { from: "/?liked=true#collection" }
                }
                onClick={closeMenus}
                className={`store-bag-button${likedItemsActive ? " is-active" : ""}`}
                aria-label="Liked items"
                aria-current={likedItemsActive ? "page" : undefined}
              >
                <Icon
                  name="heart"
                  size={21}
                  fill={likedItemsActive ? "currentColor" : "none"}
                />
                <span className="hidden min-[1100px]:inline">Liked</span>
              </Link>
              <NavLink
                to="/cart"
                onClick={closeMenus}
                className={({ isActive }) =>
                  `store-bag-button${isActive ? " is-active" : ""}`
                }
                aria-label={`Shopping bag${displayCount > 0 ? `, ${displayCount} ${displayCount === 1 ? "item" : "items"}` : ""}`}
              >
                <Icon name="bag" size={21} />
                <span className="hidden min-[1100px]:inline">Bag</span>
                {displayCount > 0 && (
                  <span className="store-bag-count" aria-hidden="true">
                    {displayCount > 99 ? "99+" : displayCount}
                  </span>
                )}
              </NavLink>
              <div
                ref={accountRef}
                className="relative hidden min-[901px]:block"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setAccountOpen(false);
                }}
              >
                <button
                  ref={accountButton}
                  type="button"
                  className={`store-account-toggle ${accountOpen || pathname.startsWith("/profile") ? "is-active" : ""}`}
                  aria-expanded={accountOpen}
                  aria-controls={accountId}
                  onClick={() => setAccountOpen(!accountOpen)}
                >
                  <Icon name="user" size={19} />
                  <span>Account</span>
                  <Icon
                    name="chevron"
                    size={13}
                    className={`transition-transform ${accountOpen ? "-rotate-90" : "rotate-90"}`}
                  />
                </button>
                {accountOpen && (
                  <nav
                    id={accountId}
                    className="store-account-panel"
                    aria-label="Account navigation"
                  >
                    <div className="border-b border-line px-3 pb-3 mb-2">
                      <p className="truncate font-semibold text-ink">
                        {user?.username}
                      </p>
                      <p className="text-small text-muted">
                        {user?.roleLabel || "Your store account"}
                      </p>
                    </div>
                    {accountLinks.map(([path, label, icon]) => (
                      <NavLink
                        key={path}
                        to={path}
                        className={navClass}
                        onClick={closeMenus}
                      >
                        <Icon name={icon} size={18} />
                        {label}
                      </NavLink>
                    ))}
                    <button
                      type="button"
                      className="store-header-signout"
                      disabled={signingOut}
                      onClick={signOut}
                    >
                      <Icon name="logout" size={18} />
                      {signingOut ? "Signing out?" : "Sign out"}
                    </button>
                  </nav>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                state={{ from: "/?liked=true#collection" }}
                onClick={closeMenus}
                className="store-bag-button"
                aria-label="Liked items"
              >
                <Icon name="heart" size={21} />
                <span className="hidden min-[1100px]:inline">Liked</span>
              </Link>
              <Link to="/login" className="store-nav-link" onClick={closeMenus}>
                Sign in
              </Link>
              <Link
                to="/signup"
                className="ui-button ui-button-dark hidden min-[901px]:inline-flex"
                onClick={closeMenus}
              >
                Join the thrift
              </Link>
            </>
          )}
          <button
            ref={mobileButton}
            type="button"
            className="store-mobile-toggle min-[901px]:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls={menuId}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={21} />
          </button>
        </div>
        {mobileOpen && (
          <nav
            id={menuId}
            className="col-span-full mt-4 border-t border-line pt-3 min-[901px]:hidden"
            aria-label="Mobile navigation"
          >
            {!compact && (
              <div className="grid gap-1">
                {primaryLinks.map(([path, label, icon]) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/"}
                    className={primaryClass(path)}
                    onClick={closeMenus}
                  >
                    <Icon name={icon} size={19} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
            {isLoggedIn ? (
              <div
                className={`${!compact ? "mt-3 border-t border-line pt-3" : ""} grid gap-1`}
              >
                {accountLinks.map(([path, label, icon]) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={navClass}
                    onClick={closeMenus}
                  >
                    <Icon name={icon} size={19} />
                    {label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  className="store-header-signout"
                  disabled={signingOut}
                  onClick={signOut}
                >
                  <Icon name="logout" size={19} />
                  {signingOut ? "Signing out?" : "Sign out"}
                </button>
              </div>
            ) : (
              <Link
                to="/signup"
                className="ui-button ui-button-dark mt-3 w-full"
                onClick={closeMenus}
              >
                Join the thrift <Icon name="arrow" size={18} />
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
