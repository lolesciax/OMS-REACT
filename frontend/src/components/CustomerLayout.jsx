import StoreHeader from "./StoreHeader";
import Footer from "./Footer";
import CustomerNavigation from "./CustomerNavigation";
import "../styles/customer-pages.css";

export default function CustomerLayout({ children, cartCount }) {
  return (
    <div className="customer-page min-h-dvh flex flex-col">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <StoreHeader cartCount={cartCount} />
      <main className="customer-main" id="main-content">
        <CustomerNavigation />
        {children}
      </main>
      <Footer />
    </div>
  );
}
