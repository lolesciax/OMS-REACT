import StoreHeader from "./StoreHeader";
import Footer from "./Footer";
import "../styles/customer-pages.css";

export default function CustomerLayout({ children, cartCount }) {
  return (
    <div className="customer-page">
      <StoreHeader cartCount={cartCount} />
      <main className="customer-main" id="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
}
