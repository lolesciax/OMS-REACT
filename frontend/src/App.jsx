import React, { useLayoutEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ShoppingWindow from "./pages/shopping_window";
import Cart from "./pages/cart";
import CheckoutPage from "./pages/checkout";
import Profile from "./pages/profile";
import OrderHistory from "./pages/order_history";
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
import AdminProducts from "./components/AdminProducts";
import AdminOrders from "./components/AdminOrders";
import AdminCustomers from "./components/AdminCustomers";
import AdminDiscounts from "./components/AdminDiscounts";
import AdminViewOrders from "./components/AdminViewOrders";
import AdminSettings from "./components/AdminSettings";
import Payment from "./pages/payment";
import { postLoginPath } from "./utils/navigation";

// Import admin CSS
import "./app.css";

// Protected Route Component (for routes that require login)
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Public Route Component (redirect logged-in users away from auth pages)
const PublicRoute = ({ children }) => {
  const location = useLocation();
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (isLoggedIn) {
    return <Navigate to={postLoginPath(user, location.state?.from)} replace />;
  }

  return children;
};

// Main App Component
function AppContent() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.body.dataset.page = pathname.startsWith("/admin/")
      ? "admin"
      : pathname === "/"
        ? "shop"
        : pathname.slice(1);
    document.body.dataset.area = pathname.startsWith("/admin/")
      ? "admin"
      : "customer";
    window.scrollTo(0, 0);
  }, [pathname]);
  const { loading, authError, sessionError, checkAuthStatus } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (sessionError)
    return (
      <div className="ui-empty" role="alert">
        <p>{sessionError}</p>
        <button
          className="ui-button ui-button-dark"
          onClick={() => checkAuthStatus()}
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className="App">
      {authError && (
        <div className="ui-message error" role="alert">
          {authError}
        </div>
      )}
      <Suspense
        fallback={
          <div className="loading" role="status">
            Loading page...
          </div>
        }
      >
        <Routes>
          {/* Shopping Window is the landing page for everyone */}
          <Route path="/" element={<ShoppingWindow />} />

          {/* Public routes - only accessible when NOT logged in */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUp />
              </PublicRoute>
            }
          />

          {/* Protected routes - require login */}
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-history"
            element={
              <ProtectedRoute>
                <OrderHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <Payment />
              </ProtectedRoute>
            }
          />

          {/* Admin routes - require admin privileges */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/discounts"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDiscounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/view-orders"
            element={
              <ProtectedRoute requireAdmin={true}>
                <Navigate to="/admin/orders" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/view-orders/:orderId"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminViewOrders />
              </ProtectedRoute>
            }
          />

          {/* 404 Fallback */}
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requireAdmin>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

// Main App Wrapper
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
