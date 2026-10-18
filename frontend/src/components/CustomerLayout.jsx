import StoreHeader from "./StoreHeader";
import Footer from "./Footer";
import "../styles/customer-pages.css";

export default function CustomerLayout({ children, cartCount }) {
  return (
    <div className="customer-page min-h-dvh flex flex-col">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <StoreHeader cartCount={cartCount} />
      <main
        className="customer-main w-full max-w-305 my-0 mx-auto [padding:48px_28px_72px] max-[760px]:[padding:32px_20px_48px]"
        id="main-content"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
