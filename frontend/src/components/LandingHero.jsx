import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { formatPrice, isProductAvailable } from "../utils/catalog";
import ProductMedia from "./ProductMedia";
import Skeleton, { SkeletonRegion } from "./Skeleton";

export default function LandingHero({ products, loading, onSelect }) {
  const [failed, setFailed] = useState([]);
  const [paused, setPaused] = useState(false);
  const featured = products
    .filter(
      (p) => isProductAvailable(p) && p.image && !failed.includes(p.image),
    )
    .slice(0, 3);
  const lowestPrice = products
    .filter(isProductAvailable)
    .reduce((price, p) => Math.min(price, Number(p.price)), Infinity);
  return (
    <>
      <div className="store-announcement">
        <span>
          <Icon name="leaf" size={15} /> A fresh take on secondhand.
        </span>
        <a href="#collection">
          Find something good <Icon name="arrow" size={15} />
        </a>
      </div>
      <section className="landing-hero" aria-labelledby="shop-title">
        <div className="landing-hero-copy">
          <span className="landing-kicker">
            <span /> THE PRE-LOVED EDIT
          </span>
          <h1 id="shop-title">
            Good style.
            <br />
            <span>Great finds.</span>
          </h1>
          <p>
            Your next favorite is already out there. Shop pre-loved clothing
            with character, without the brand-new price tag.
          </p>
          <div className="landing-actions">
            <a href="#collection" className="landing-shop-link">
              Shop all finds <Icon name="arrow" size={20} />
            </a>
            <Link to="/help" className="landing-help-link">
              How it works <Icon name="arrow" size={17} />
            </Link>
          </div>
          <div className="landing-hero-values">
            <span>
              <Icon name="truck" size={18} /> Nationwide shipping
            </span>
            <span>
              <Icon name="heart" size={18} /> Pre-loved. Ready to re-love.
            </span>
          </div>
        </div>
        <div
          className="landing-showcase"
          aria-label="Shop available featured pieces"
          aria-busy={loading}
        >
          <span className="campaign-watermark" aria-hidden="true">
            RE / LOVE
          </span>
          <div className="campaign-stamp">
            <Icon name="leaf" size={22} />
            <span>
              OLD GOODS
              <br />
              NEW STORIES
            </span>
          </div>
          {loading ? (
            <SkeletonRegion
              label="Loading featured pieces"
              className="landing-rack"
            >
              {[0, 1, 2].map((index) => (
                <div className="landing-rack-card" key={index}>
                  <Skeleton className="landing-rack-photo" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </SkeletonRegion>
          ) : featured.length ? (
            <div
              className={`landing-rack landing-rack-count-${featured.length}`}
            >
              {featured.map((product) => (
                <button
                  type="button"
                  key={product._id || product.id}
                  className="landing-rack-card"
                  onClick={() => onSelect(product)}
                  aria-label={`Shop ${product.name}, ${formatPrice(product.price)}`}
                >
                  <div className="landing-rack-photo">
                    <ProductMedia
                      src={product.image}
                      name={product.name}
                      alt={product.name}
                      loading="eager"
                      onUnavailable={() =>
                        setFailed((previous) => [...previous, product.image])
                      }
                    />
                  </div>
                  <div className="landing-rack-caption">
                    <span className="landing-rack-category">
                      {product.category || "Pre-loved find"}
                      {product.size ? ` ? ${product.size}` : ""}
                    </span>
                    <strong>{product.name}</strong>
                    <span className="landing-rack-price">
                      {formatPrice(product.price)}
                      <Icon name="arrow" size={18} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="landing-rack-empty" role="status">
              <Icon name="bag" size={40} />
              <h2>A new chapter is coming.</h2>
              <p>We?re getting the next good finds ready. Check back soon.</p>
            </div>
          )}
          {!loading && Number.isFinite(lowestPrice) && (
            <a className="campaign-price-tag" href="#collection">
              <span>Good finds from</span>
              <strong>{formatPrice(lowestPrice)}</strong>
              <Icon name="arrow" size={20} />
            </a>
          )}
        </div>
        <div className="landing-bottom">
          <span>Less new. More you.</span>
          <a href="#collection">
            Explore the collection{" "}
            <Icon name="arrow" size={18} className="rotate-90" />
          </a>
        </div>
      </section>
      <div className="campaign-ribbon" data-paused={paused}>
        <div className="campaign-ribbon-window">
          <div className="campaign-ribbon-track">
            {[0, 1].map((copy) => (
              <div
                className="campaign-ribbon-copy"
                key={copy}
                aria-hidden={copy === 1 ? true : undefined}
              >
                <span>GOOD CLOTHES</span>
                <Icon name="leaf" size={20} />
                <span>SECOND CHANCES</span>
                <Icon name="leaf" size={20} />
                <span>YOUR NEXT FAVORITE</span>
                <Icon name="leaf" size={20} />
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="campaign-motion-toggle"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={
            paused
              ? "Play promotional ribbon animation"
              : "Pause promotional ribbon animation"
          }
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </>
  );
}
