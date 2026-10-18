import { imageURL } from "../utils/images";
import { useState } from "react";

export default function Image(props) {
  const source = imageURL(props.src, props.fallback);
  return <ResolvedImage key={source} {...props} src={source} />;
}

function ResolvedImage({
  src,
  alt = "",
  fallback = "/product-placeholder.svg",
  onError,
  ...props
}) {
  const [status, setStatus] = useState(
    src === fallback ? "unavailable" : "loading",
  );
  return (
    <img
      {...props}
      src={src}
      alt={alt}
      decoding="async"
      data-image-state={status}
      aria-busy={status === "loading"}
      onLoad={(event) => {
        setStatus(
          event.currentTarget.getAttribute("src") === fallback
            ? "unavailable"
            : "ready",
        );
        props.onLoad?.(event);
      }}
      onError={(event) => {
        const element = event.currentTarget;
        const previous = element.getAttribute("src");
        onError?.(event);
        setStatus("unavailable");
        if (element.getAttribute("src") === previous && previous !== fallback)
          element.src = fallback;
      }}
    />
  );
}
