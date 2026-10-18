import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "./Icon";
import useScrollReveal from "../hooks/useScrollReveal";
import usePublicContent from "../hooks/usePublicContent";
import Skeleton from "./Skeleton";

const socialLinks = [
  ["Instagram", "https://www.instagram.com/oldgoodsthrift.ph/"],
  ["Facebook", "https://www.facebook.com/oldgoodsthrift"],
  ["TikTok", "https://www.tiktok.com/@oldgoodsthrift_23"],
];

export default function Footer() {
  const support = usePublicContent("/content/support");
  const info = support.data?.content.data;
  const footer = useScrollReveal();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (pathname === "/" && hash === "#collection")
      document.getElementById("collection")?.scrollIntoView();
  }, [pathname, hash]);
  const explore = () => {
    if (pathname === "/")
      document.getElementById("collection")?.scrollIntoView();
  };
  return (
    <footer ref={footer} className="site-footer" aria-label="Store information">
      <div className="footer-inner">
        <div className="footer-invitation" data-reveal>
          <div>
            <span className="footer-eyebrow">Keep the good going</span>
            <h2>
              Good clothes.
              <br />
              <em>Another chapter.</em>
            </h2>
          </div>
          <Link
            to="/#collection"
            onClick={explore}
            className="footer-shop-link"
          >
            <span>
              Find something
              <br />
              that feels like you.
            </span>
            <span className="footer-shop-arrow">
              <Icon name="arrow" size={30} className="-rotate-45" />
            </span>
          </Link>
        </div>
        <div className="footer-grid">
          <div className="footer-story" data-reveal>
            <span className="footer-leaf">
              <Icon name="leaf" size={22} />
            </span>
            <p>
              Less ordinary. More you.
              <br />A second life for good clothes, and a little more character
              for your wardrobe.
            </p>
            <span className="footer-location">
              {info ? `From ${info.location}` : "Thoughtfully pre-loved"}
              <br />
              Shipped across the Philippines.
            </span>
          </div>
          <nav
            className="footer-column"
            aria-label="Footer shopping"
            data-reveal
            data-reveal-delay="60"
          >
            <h3>Explore</h3>
            <Link to="/#collection" onClick={explore}>
              The collection
            </Link>
            <Link to="/order-history">Your orders</Link>
            <Link to="/profile">Your account</Link>
          </nav>
          <nav
            className="footer-column"
            aria-label="Help and policies"
            data-reveal
            data-reveal-delay="90"
          >
            <h3>Here to help</h3>
            <Link to="/help">Help centre</Link>
            <Link to="/faqs">FAQs</Link>
            <Link to="/policies/shipping">Shipping & delivery</Link>
            <Link to="/policies/returns">Returns & order issues</Link>
            <Link to="/policies">All policies</Link>
          </nav>
          <div className="footer-column" data-reveal data-reveal-delay="120">
            <h3>Say hello</h3>
            {info ? (
              <>
                <a
                  href={`mailto:${encodeURIComponent(info.email)}`}
                  className="footer-email"
                >
                  {info.email}
                </a>
                <a href={`tel:${info.phone.replace(/[^+\d]/g, "")}`}>
                  {info.phone}
                </a>
                <p className="whitespace-pre-wrap">{info.hours}</p>
              </>
            ) : support.error ? (
              <button
                type="button"
                className="min-h-11 cursor-pointer text-left underline"
                onClick={support.reload}
              >
                Retry contact details
              </button>
            ) : (
              <Skeleton className="h-20 w-full bg-white/10" />
            )}
            <Link to="/contact">
              Contact us <Icon name="arrow" size={16} />
            </Link>
          </div>
          <nav
            className="footer-column"
            aria-label="Social media"
            data-reveal
            data-reveal-delay="180"
          >
            <h3>Elsewhere</h3>
            {socialLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer">
                {label}
                <Icon name="arrow" size={16} className="-rotate-45" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </nav>
        </div>
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 py-5 text-small text-white/85"
          aria-label="Legal information"
        >
          <Link
            className="inline-flex min-h-11 items-center hover:underline"
            to="/terms"
          >
            Terms & conditions
          </Link>
          <Link
            className="inline-flex min-h-11 items-center hover:underline"
            to="/policies/privacy"
          >
            Privacy policy
          </Link>
          <Link
            className="inline-flex min-h-11 items-center hover:underline"
            to="/contact"
          >
            Contact & support
          </Link>
        </nav>
        <div className="footer-wordmark" aria-hidden="true" data-reveal>
          Old Goods<span>Thrift.</span>
          <Icon name="leaf" />
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Old Goods Thrift</span>
          <span className="footer-payment-note">
            <Icon name="shield" size={16} /> Payments reviewed with care
          </span>
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            Back to top <Icon name="arrow" size={16} className="-rotate-90" />
          </button>
        </div>
      </div>
    </footer>
  );
}
