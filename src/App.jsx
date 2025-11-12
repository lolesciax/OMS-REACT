import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/login";
import SignUp from "./pages/SignUp";
import ShoppingWindow from "./pages/shopping_window";
import Cart from "./pages/cart";
import CheckoutPage from "./pages/checkout";
import Profile from "./pages/profile";
import OrderHistory from "./pages/order_history";
import AdminDashboard from "./components/AdminDashboard";
import AdminProducts from "./components/AdminProducts";
import AdminOrders from "./components/AdminOrders";
import AdminCustomers from "./components/AdminCustomers";
import AdminDiscounts from "./components/AdminDiscounts";
import AdminViewOrders from "./components/AdminViewOrders";
import Payment from "./pages/payment";

// Import admin CSS
import "./styles/admin/dashboard.css";
import "./styles/admin/products.css";
import "./styles/admin/orders.css";
import "./styles/admin/customer.css";
import "./styles/admin/vieworders.css";
import "./App.css";

// Protected Route Component (for routes that require login)
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Public Route Component (redirect logged-in users away from auth pages)
const PublicRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (isLoggedIn) {
    // If user is admin, redirect to admin dashboard
    if (user?.isAdmin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    // If regular user, stay on shopping page (no redirect)
    return <Navigate to="/" replace />;
  }

  return children;
};

// Main App Component
function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
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
              <AdminViewOrders />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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