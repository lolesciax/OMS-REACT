import Image from "./Image";
import { Link } from "react-router-dom";
import StoreHeader from "./StoreHeader";
import Footer from "./Footer";
import Icon from "./Icon";
import "../styles/auth-pages.css";

export default function AuthLayout({ mode, children }) {
  return (
    <div className="auth-page min-h-dvh flex flex-col" data-auth-mode={mode}>
      <a className="skip-link" href="#auth-heading">
        Skip to form
      </a>
      <StoreHeader compact />
      <main
        className={
          "auth-shell w-full max-w-280 my-0 mx-auto [padding:64px_28px_80px] grid grid-cols-[1fr_1fr] gap-[110px] items-center max-[1000px]:gap-12 max-[700px]:block max-[700px]:[padding:32px_20px_48px] max-[700px]:max-w-125"
        }
      >
        <aside className="auth-story max-[700px]:hidden" aria-hidden="true">
          <span className="ui-eyebrow">A little history. A fresh start.</span>
          <h2>
            Good clothes.
            <br />
            <em>Better stories.</em>
          </h2>
          <p>
            Make room for pieces with character. Find something you love, give it
            another life, and make it your own.
          </p>
          <div className="auth-story-image">
            <Image src="/p2.jpg" alt="A pre-loved shirt from our collection" />
            <span>Old goods. New possibilities.</span>
          </div>
          <div className="auth-story-note">
            <Icon name="leaf" size={17} /> A thoughtful way to get dressed.
          </div>
        </aside>
        <section
          className={`auth-card border border-line rounded-[12px] bg-white shadow-[0_8px_40px_#28362c05] min-w-0 ${mode === "signup" ? "w-full max-w-[560px] justify-self-end p-5 sm:p-8 lg:p-10" : "p-9 max-[1000px]:p-7 max-[700px]:py-7 max-[700px]:px-6"}`}
          aria-labelledby="auth-heading"
        >
          {mode === "login" && <span className="ui-eyebrow">Good to have you back</span>}
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
