import Image from "./Image";
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
    <header className="store-header">
      <Link className="store-brand" to="/" aria-label="Old Goods Thrift home">
        <Image src="/Shop Icon.jpg" alt="" />
        <span>
          Old Goods<span className="brand-second">Thrift.</span>
        </span>
      </Link>
      <nav className="store-nav" aria-label="Main navigation">
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
