import { useEffect, useRef, useState } from "react";
import ProductMedia from "./ProductMedia";
import Icon from "./Icon";
import { imageURL } from "../utils/images";
import "../styles/product-photo.css";

export default function ProductPhoto(props) {
  return <Photo key={imageURL(props.src)} {...props} />;
}

function Photo({
  src,
  name = "Product",
  className = "",
  hint = "View larger",
  caption = "The complete image, without cropping. Zoom in to inspect the details.",
  onUnavailable,
}) {
  const [unavailable, setUnavailable] = useState(
    imageURL(src) === "/product-placeholder.svg",
  );
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const stage = useRef(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const photoButton = trigger.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (photoButton?.isConnected) photoButton.focus();
    };
  }, [open]);
  const close = () => {
    setOpen(false);
    setZoomed(false);
  };
  return (
    <div className={`product-photo ${className}`}>
      <button
        ref={trigger}
        type="button"
        className="product-photo-trigger"
        disabled={unavailable || !ready}
        aria-label={
          unavailable
            ? `Photo unavailable for ${name}`
            : `Enlarge photo of ${name}`
        }
        onClick={() => setOpen(true)}
      >
        <ProductMedia
          src={src}
          name={name}
          alt={name}
          loading="eager"
          onReady={() => setReady(true)}
          onUnavailable={() => {
            setUnavailable(true);
            onUnavailable?.();
          }}
        />
        {ready && !unavailable && (
          <span className="product-photo-hint">
            <Icon name="search" size={18} /> <span>{hint}</span>
          </span>
        )}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="product-photo-viewer"
          aria-label={`Photo of ${name}`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="product-photo-toolbar">
            <strong>{name}</strong>
            <button
              type="button"
              className="ui-button ui-button-light"
              aria-pressed={zoomed}
              onClick={() => {
                setZoomed(!zoomed);
                stage.current.scrollTo(0, 0);
              }}
            >
              <Icon name="search" size={18} />{" "}
              {zoomed ? "Fit photo" : "Zoom in"}
            </button>
            <button
              type="button"
              className="product-photo-close"
              aria-label="Close enlarged photo"
              onClick={close}
            >
              <Icon name="close" />
            </button>
          </div>
          <div
            ref={stage}
            className={`product-photo-stage ${zoomed ? "is-zoomed" : ""}`}
            tabIndex={0}
            aria-label="Product photo; scroll to explore when zoomed"
          >
            <ProductMedia src={src} name={name} alt={name} loading="eager" />
          </div>
          <p>
            {zoomed
              ? "Scroll to inspect the details. Choose Fit photo to see the whole item."
              : caption}
          </p>
        </dialog>
      )}
    </div>
  );
}
