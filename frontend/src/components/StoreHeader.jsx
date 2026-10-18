import Image from "./Image";
import NotificationBell from "./NotificationBell";
import { useEffect, useState } from "react";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icon from "./Icon";

export default function StoreHeader({ cartCount, compact = false }) {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
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
          setCount(
            (data.cart || []).reduce(
              (sum, item) => sum + Number(item.qty || 0),
              0,
            ),
          );
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
  const displayCount = cartCount ?? count;
  return (
    <header className="store-header relative flex justify-between items-center gap-6 [padding:20px_max(24px,_calc((100vw_-_1280px)_/_2))] border-b border-line bg-paper max-[600px]:flex-wrap max-[600px]:gap-3 max-[600px]:py-4 max-[600px]:px-5 max-[600px]:gap-3">
      <Link className="store-brand" to="/" aria-label="Old Goods Thrift home">
        <Image src="/Shop Icon.jpg" alt="" />
        <span>
          Old Goods<span className="brand-second">Thrift.</span>
        </span>
      </Link>
      <nav
        className="store-nav flex items-center gap-[27px] max-[900px]:gap-4 max-[600px]:gap-3 max-[600px]:flex-wrap max-[600px]:gap-3"
        aria-label="Main navigation"
      >
        {!compact && (
          <NavLink to="/" end>
            Shop
          </NavLink>
        )}
        {isLoggedIn ? (
          <>
            {user?.isAdmin && (
              <Link to="/admin/dashboard" className="store-admin-link">
                Manage store
              </Link>
            )}
            {!compact && (
              <NavLink to="/order-history">
                <Icon name="orders" />
                <span>Orders</span>
              </NavLink>
            )}
            <NavLink to="/profile">
              <Icon name="user" />
              <span>Account</span>
            </NavLink>
            <span className="max-[600px]:absolute max-[600px]:right-5 max-[600px]:top-4">
              <NotificationBell />
            </span>
            <NavLink to="/cart" className="store-cart">
              <Icon name="bag" />
              <span>Bag</span>
              {displayCount > 0 && (
                <span
                  className="store-cart-count"
                  aria-label={`${displayCount} items`}
                >
                  {displayCount}
                </span>
              )}
            </NavLink>
            <button
              className="store-signout"
              onClick={async () => {
                if (await logout()) navigate("/");
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link to="/signup" className="ui-button ui-button-dark">
              Join the thrift
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
