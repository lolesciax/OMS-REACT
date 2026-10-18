import { useState } from "react";
import { imageURL } from "../utils/images";
import Icon from "./Icon";
import "../styles/product-media.css";

// Stable dimensions belong to the parent (card, preview or viewer).
export default function ProductMedia(props) {
  return <Media key={imageURL(props.src)} {...props} />;
}

function Media({
  src,
  name = "Product",
  alt = "",
  loading = "lazy",
  onReady,
  onUnavailable,
}) {
  const [status, setStatus] = useState(
    imageURL(src) === "/product-placeholder.svg" ? "unavailable" : "loading",
  );
  return (
    <div
      className="product-media"
      data-media-state={status}
      aria-busy={status === "loading"}
    >
      {status === "unavailable" ? (
        <div
          className="product-media-empty"
          role="img"
          aria-label={`Photo unavailable for ${name}`}
        >
          <span className="product-media-empty-icon">
            <Icon name="photo" size={28} />
          </span>
          <span className="product-media-empty-label">Photo unavailable</span>
        </div>
      ) : (
        <img
          src={imageURL(src)}
          alt={alt}
          loading={loading}
          decoding="async"
          data-image-state={status}
          onLoad={() => {
            setStatus("ready");
            onReady?.();
          }}
          onError={() => {
            setStatus("unavailable");
            onUnavailable?.();
          }}
        />
      )}
    </div>
  );
}
