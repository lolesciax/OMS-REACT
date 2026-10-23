import { Link } from "react-router-dom";
import Icon from "./Icon";
import ProductMedia from "./ProductMedia";
import Skeleton, { SkeletonRegion } from "./Skeleton";
import { formatPrice, isProductAvailable } from "../utils/catalog";
import useScrollReveal from "../hooks/useScrollReveal";

export default function StorefrontPromotions({
  products,
  loading,
  onCategory,
  onAffordable,
}) {
  const available = products.filter(isProductAvailable);
  const labels = [
    ...new Set(available.map((p) => p.category).filter(Boolean)),
  ].slice(0, 4);
  const startingPrice = available.reduce(
    (price, p) => Math.min(price, Number(p.price)),
    Infinity,
  );
  const root = useScrollReveal(products);
  return (
    <div className="storefront-discovery" ref={root}>
      {(loading || labels.length > 0) && (
        <section
          aria-labelledby="shop-labels-title"
          className="storefront-labels"
          data-reveal
        >
          <div className="storefront-section-heading">
            <div>
              <span className="ui-eyebrow">Find your favorites</span>
              <h2 id="shop-labels-title">
                Labels you love. Finds you’ll keep.
              </h2>
            </div>
            <a href="#collection">
              Shop everything <Icon name="arrow" size={18} />
            </a>
          </div>
          {loading ? (
            <SkeletonRegion
              label="Loading available labels"
              className="storefront-label-grid"
            >
              {[0, 1, 2, 3].map((i) => (
                <Skeleton className="aspect-[4/3] rounded-2xl" key={i} />
              ))}
            </SkeletonRegion>
          ) : (
            <div className="storefront-label-grid">
              {labels.map((label) => {
                const pieces = available.filter((p) => p.category === label);
                return (
                  <button
                    type="button"
                    className="storefront-label-card"
                    key={label}
                    onClick={() => onCategory(label)}
                  >
                    <div className="storefront-label-photo">
                      <ProductMedia
                        src={pieces[0].image}
                        name={label}
                        alt={`Available ${label} clothing`}
                      />
                    </div>
                    <div>
                      <span>
                        <strong>{label}</strong>
                        <small>
                          {pieces.length}{" "}
                          {pieces.length === 1 ? "find" : "finds"} available
                        </small>
                      </span>
                      <span className="storefront-circle-arrow">
                        <Icon name="arrow" size={20} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
      <section className="storefront-promos" aria-label="Explore the store">
        <article
          className="storefront-promo storefront-promo-value"
          data-reveal
        >
          <span className="storefront-promo-overline">
            GOOD STYLE. LESS SPEND.
          </span>
          <h2>
            A small price.
            <br />A great find.
          </h2>
          <p>
            {!loading && Number.isFinite(startingPrice)
              ? `Explore available pieces from ${formatPrice(startingPrice)}. Start with the lower-priced finds and make them your own.`
              : "Explore pre-loved pieces at prices that leave room for more."}
          </p>
          <button type="button" onClick={onAffordable}>
            Explore affordable finds <Icon name="arrow" size={19} />
          </button>
          <Icon name="bag" size={140} className="storefront-promo-art" />
        </article>
        <article
          className="storefront-promo storefront-promo-story"
          data-reveal
          data-reveal-delay="100"
        >
          <span className="storefront-promo-overline">A BETTER SECOND ACT</span>
          <h2>
            Already loved.
            <br />
            Ready for you.
          </h2>
          <p>
            Check the photos, size, and condition. Save what you love, then
            follow your order all the way home.
          </p>
          <Link to="/help">
            Your guide to shopping pre-loved <Icon name="arrow" size={19} />
          </Link>
          <Icon name="leaf" size={140} className="storefront-promo-art" />
        </article>
      </section>
    </div>
  );
}
