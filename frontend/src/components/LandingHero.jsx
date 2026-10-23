import { useState } from "react";
import Icon from "./Icon";
import { Link } from "react-router-dom";
import { formatPrice, isProductAvailable } from "../utils/catalog";
import ProductMedia from "./ProductMedia";
import Skeleton, { SkeletonRegion } from "./Skeleton";

export default function LandingHero({ products, loading, onSelect }) {
  const [failed, setFailed] = useState([]);
  const featured = products
    .filter(
      (product) =>
        isProductAvailable(product) &&
        product.image &&
        !failed.includes(product.image),
    )
    .slice(0, 2);
  return (
    <section className="landing-hero" aria-labelledby="shop-title">
      <div className="landing-hero-copy">
        <span className="landing-kicker">
          <Icon name="leaf" size={16} /> OLD GOODS. NEW POSSIBILITIES.
        </span>
        <h1 id="shop-title">
          Find your
          <br />
          <span>kind of good.</span>
        </h1>
        <p>
          A little character. A lot to love. Discover pre-loved pieces worth
          making room for.
        </p>
        <div className="landing-actions">
          <a href="#collection" className="landing-shop-link">
            Shop the collection <Icon name="arrow" size={20} />
          </a>
          <Link to="/help" className="landing-help-link">
            Our story <Icon name="arrow" size={17} />
          </Link>
        </div>
        <div className="landing-hero-values">
          <Icon name="truck" size={20} />
          <span>
            Thoughtfully pre-loved.
            <strong>Delivered across the Philippines.</strong>
          </span>
        </div>
      </div>
      <div
        className="landing-showcase"
        aria-label="Available pieces from our collection"
        aria-busy={loading}
      >
        <div className="landing-showcase-heading">
          <span>THE GOOD FINDS EDIT</span>
          <span>
            Available now <span className="landing-stock-dot" />
          </span>
        </div>
        {loading ? (
          <SkeletonRegion
            label="Loading featured pieces"
            className="landing-rack"
          >
            {[0, 1].map((index) => (
              <div key={index} className="landing-rack-card">
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
            className={`landing-rack ${featured.length === 1 ? "landing-rack-single" : ""}`}
          >
            {featured.map((product) => (
              <button
                key={product._id || product.id}
                className="landing-rack-card"
                type="button"
                onClick={() => onSelect(product)}
                aria-label={`View ${product.name}, ${formatPrice(product.price)}`}
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
                    {product.category || "A good find"}
                    {product.size ? ` / ${product.size}` : ""}
                  </span>
                  <strong>{product.name}</strong>
                  <span className="landing-rack-price">
                    {formatPrice(product.price)}
                    <span aria-hidden="true">
                      <Icon name="arrow" size={18} />
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="landing-rack-empty" role="status">
            <Icon name="bag" size={40} />
            <h2>Good finds are on their way.</h2>
            <p>Our next collection is getting ready for its second act.</p>
          </div>
        )}
        <p className="landing-rack-note">
          <Icon name="leaf" size={16} /> Good pieces deserve another chapter.
        </p>
      </div>
      <div className="landing-bottom">
        <span>A fresh perspective on secondhand.</span>
        <a href="#collection">
          Explore the finds{" "}
          <Icon name="arrow" size={18} className="rotate-90" />
        </a>
      </div>
    </section>
  );
}
