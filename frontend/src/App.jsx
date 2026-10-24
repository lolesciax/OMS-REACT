import RouteSkeleton from "./components/RouteSkeleton";
import StartupLoading from "./components/StartupLoading";
import useViewportMetrics from "./hooks/useViewportMetrics";
import useHashNavigation from "./hooks/useHashNavigation";
import React, { useLayoutEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ShoppingWindow from "./pages/shopping_window";
import PageErrorBoundary from "./components/PageErrorBoundary";
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Cart = lazy(() => import("./pages/cart"));
const CheckoutPage = lazy(() => import("./pages/checkout"));
const Profile = lazy(() => import("./pages/profile"));
const Notifications = lazy(() => import("./pages/notifications"));
const OrderHistory = lazy(() => import("./pages/order_history"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const AdminProducts = lazy(() => import("./components/AdminProducts"));
const AdminOrders = lazy(() => import("./components/AdminOrders"));
const AdminCustomers = lazy(() => import("./components/AdminCustomers"));
const AdminDiscounts = lazy(() => import("./components/AdminDiscounts"));
const AdminViewOrders = lazy(() => import("./components/AdminViewOrders"));
const AdminMaintenance = lazy(() => import("./components/AdminMaintenance"));
const Payment = lazy(() => import("./pages/payment"));
const HelpPage = lazy(() => import("./pages/help"));
import { postLoginPath } from "./utils/navigation";
import { maintenanceModules } from "./components/maintenance/registry";

// Protected Route Component (for routes that require login)
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return <RouteSkeleton />;
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
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
    return <RouteSkeleton />;
  }

  if (isLoggedIn) {
    return <Navigate to={postLoginPath(user, location.state?.from)} replace />;
  }

  return children;
};

// Main App Component
function AppContent() {
  useHashNavigation();
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const title =
      {
        "/": "Shop the collection",
        "/login": "Sign in",
        "/signup": "Create an account",
        "/cart": "Your bag",
        "/checkout": "Checkout",
        "/profile": "Your account",
        "/notifications": "Notifications",
        "/admin/notifications": "Notifications",
        "/order-history": "Your orders",
        "/admin/dashboard": "Store overview",
        "/admin/products": "Products & inventory",
        "/admin/out-of-stock": "Out-of-stock products",
        "/admin/orders": "Orders",
        "/admin/customers": "People",
        "/admin/discounts": "Discount codes",
        "/admin/maintenance": "System maintenance",
        "/help": "Help centre",
        "/faqs": "Frequently asked questions",
        "/policies": "Store policies",
        "/policies/privacy": "Privacy policy",
        "/policies/shipping": "Shipping & delivery",
        "/policies/returns": "Returns & order issues",
        "/terms": "Terms & conditions",
        "/contact": "Contact us",
      }[pathname] ||
      (pathname.startsWith("/admin/maintenance/")
        ? maintenanceModules[pathname.split("/")[3]]?.title ||
          "System maintenance"
        : pathname.startsWith("/admin/view-orders/")
          ? "Order details"
          : "Old Goods Thrift");
    document.title = `${title} | Old Goods Thrift`;
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
    return <StartupLoading />;
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
    <div className="App min-h-dvh flex flex-col">
      {authError && (
        <div className="ui-message error" role="alert">
          {authError}
        </div>
      )}
      <PageErrorBoundary key={pathname}>
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute requireAdmin>
                  <Notifications admin />
                </ProtectedRoute>
              }
            />
            {/* Shopping Window is the landing page for everyone */}
            <Route path="/" element={<ShoppingWindow />} />
            {["/help", "/faqs", "/policies/:kind?", "/terms", "/contact"].map(
              (path) => (
                <Route key={path} path={path} element={<HelpPage />} />
              ),
            )}

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
              path="/admin/out-of-stock"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminProducts outOfStockOnly />
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
              path="/admin/maintenance/:section?"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminMaintenance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/admin/maintenance/payments" replace />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PageErrorBoundary>
    </div>
  );
}

// Main App Wrapper
function App() {
  useViewportMetrics();
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
