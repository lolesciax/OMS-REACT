import Image from "./Image";
import { Link } from "react-router-dom";
import StoreHeader from "./StoreHeader";
import Footer from "./Footer";
import Icon from "./Icon";
import "../styles/auth-pages.css";

export default function AuthLayout({ mode, children }) {
  return (
    <div className="auth-page">
      <StoreHeader compact />
      <main className="auth-shell">
        <aside className="auth-story" aria-hidden="true">
          <span className="ui-eyebrow">A little history. A fresh start.</span>
          <h2>
            Good clothes.
            <br />
            <em>Better stories.</em>
          </h2>
          <p>
            Make room for pieces with character. Find something you love, give
            it another life, and make it your own.
          </p>
          <div className="auth-story-image">
            <Image src="/p2.jpg" alt="A pre-loved shirt from our collection" />
            <span>Old goods. New possibilities.</span>
          </div>
          <div className="auth-story-note">
            <Icon name="leaf" size={17} /> A thoughtful way to get dressed.
          </div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-heading">
          <span className="ui-eyebrow">
            {mode === "signup"
              ? "Your next chapter starts here"
              : "Good to have you back"}
          </span>
          {children}
          <Link to="/" className="auth-back">
            <Icon name="back" size={16} /> Keep exploring the collection
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
