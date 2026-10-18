import { useState } from "react";
import Image from "./Image";
import Icon from "./Icon";
import { formatPrice } from "../utils/catalog";
import Skeleton, { SkeletonRegion } from "./Skeleton";

export default function LandingHero({ products, loading, onSelect }) {
  const [failed, setFailed] = useState([]);
  const featured = products
    .filter((product) => product.image && !failed.includes(product.image))
    .slice(0, 3);
  const primary = featured[0];

  return (
    <section className="landing-hero" aria-labelledby="shop-title">
      <div className="landing-hero-copy">
        <span className="landing-kicker">
          <span /> A fresh take on secondhand
        </span>
        <h1 id="shop-title">
          Good style.
          <br />
          Great <em>second acts.</em>
        </h1>
        <p>
          Pre-loved pieces with character. Find your next favorite and make it
          yours.
        </p>
        <a href="#collection" className="landing-shop-link">
          Find your next favorite{" "}
          <span>
            <Icon name="arrow" size={22} />
          </span>
        </a>
        <div className="landing-hero-values">
          <Icon name="leaf" size={18} /> Pre-loved pieces. Plenty of
          possibility.
        </div>
      </div>
      <div
        className="landing-composition"
        aria-label="A selection from the available collection"
        aria-busy={loading}
      >
        <div className="landing-orbit" aria-hidden="true" />
        <span className="landing-photo-index" aria-hidden="true">
          THE GOOD GOODS EDIT
        </span>
        {loading ? (
          <SkeletonRegion
            label="Loading featured pieces"
            className="landing-featured"
          >
            <div className="flex h-full flex-col gap-4">
              <Skeleton className="min-h-0 flex-1 rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </SkeletonRegion>
        ) : primary ? (
          <button
            className="landing-featured"
            onClick={() => onSelect(primary)}
            aria-label={`View ${primary.name}, ${formatPrice(primary.price)}`}
          >
            <div className="landing-featured-photo">
              <Image
                src={primary.image}
                alt={primary.name}
                fetchPriority="high"
                onError={() =>
                  setFailed((previous) => [...previous, primary.image])
                }
              />
            </div>
            <div className="landing-featured-caption">
              <span>
                <small>Yours to rediscover</small>
                <strong>{primary.name}</strong>
              </span>
              <span>
                {formatPrice(primary.price)}
                <Icon name="arrow" size={18} />
              </span>
            </div>
          </button>
        ) : (
          <div
            className="landing-featured landing-featured-empty"
            role="status"
          >
            <Icon name="leaf" size={52} />
            <span className="font-serif text-3xl">
              Good things take
              <br />a little finding.
            </span>
            <p>Our next chapter is on its way.</p>
          </div>
        )}
        {loading &&
          [1, 2].map((index) => (
            <div
              key={index}
              className={`landing-mini landing-mini-${index}`}
              aria-hidden="true"
            >
              <Skeleton className="size-full flex-1 rounded-lg" />
            </div>
          ))}
        {!loading &&
          featured.slice(1).map((product, index) => (
            <button
              key={product._id || product.id}
              className={`landing-mini landing-mini-${index + 1}`}
              onClick={() => onSelect(product)}
              aria-label={`View ${product.name}, ${formatPrice(product.price)}`}
            >
              <Image
                src={product.image}
                alt={product.name}
                onError={() =>
                  setFailed((previous) => [...previous, product.image])
                }
              />
              <span>
                {product.category || "A good find"}
                <Icon name="arrow" size={14} />
              </span>
            </button>
          ))}
        <div className="landing-seal" aria-hidden="true">
          <Icon name="leaf" size={22} />
          <span>
            OLD GOODS
            <br />
            NEW STORIES
          </span>
        </div>
      </div>
      <a className="landing-scroll" href="#collection">
        <span>Explore the collection</span>
        <Icon name="arrow" size={18} className="rotate-90" />
      </a>
    </section>
  );
}
