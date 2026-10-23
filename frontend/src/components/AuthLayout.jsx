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
        className={`auth-shell ${mode === "signup" ? "min-[1100px]:max-w-300 min-[1100px]:grid-cols-[0.85fr_1.15fr]" : ""} w-full max-w-280 my-0 mx-auto [padding:64px_28px_80px] grid grid-cols-[1fr_1fr] gap-8 items-stretch max-[1000px]:gap-6 max-[700px]:block max-[700px]:[padding:32px_20px_48px] max-[700px]:max-w-125`}
      >
        <aside
          className="auth-story max-[700px]:hidden"
          aria-label="Your Old Goods account"
        >
          <div className="auth-story-brand">
            <Icon name="leaf" size={23} />
            <span>OLD GOODS / NEW POSSIBILITIES</span>
          </div>
          <div className="auth-story-copy">
            <span className="auth-story-eyebrow">YOUR OWN LITTLE CORNER</span>
            <h2>
              Good finds.
              <br />
              <span>Start here.</span>
            </h2>
            <p>
              Save your favorite finds and follow their next chapter, all in one
              place.
            </p>
          </div>
          <ul className="auth-story-features">
            {[
              [
                "heart",
                "Keep what catches your eye",
                "Save your favorite finds in one place.",
              ],
              [
                "orders",
                "Follow every second act",
                "Stay up to date on your orders.",
              ],
            ].map(([icon, title, description]) => (
              <li key={icon}>
                <span className="auth-story-feature-icon">
                  <Icon name={icon} size={20} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="auth-story-signature">
            <span>Less ordinary. More you.</span>
            <Icon name="arrow" size={22} className="-rotate-45" />
          </div>
        </aside>
        <section
          className={`auth-card border border-line rounded-[12px] bg-white shadow-[0_8px_40px_#362f2805] min-w-0 ${mode === "signup" ? "w-full min-[1100px]:max-w-none max-w-[560px] justify-self-end p-5 sm:p-8 lg:p-10" : "p-9 max-[1000px]:p-7 max-[700px]:py-7 max-[700px]:px-6"}`}
          aria-labelledby="auth-heading"
        >
          {mode === "login" && (
            <span className="ui-eyebrow">Good to have you back</span>
          )}
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
