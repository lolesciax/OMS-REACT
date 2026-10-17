import { imageURL } from "../utils/images";

export default function Image({
  src,
  alt = "",
  fallback = "/product-placeholder.svg",
  onError,
  ...props
}) {
  return (
    <img
      {...props}
      src={imageURL(src, fallback)}
      alt={alt}
      decoding="async"
      onError={(event) => {
        const element = event.currentTarget;
        const previous = element.getAttribute("src");
        onError?.(event);
        if (element.getAttribute("src") === previous && previous !== fallback)
          element.src = fallback;
      }}
    />
  );
}
