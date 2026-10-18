// Decode before accepting a selection; the server independently validates uploads.
export function inspectImageFile(file, maxPixels, env = window) {
  return new Promise((resolve) => {
    const url = env.URL.createObjectURL(file);
    const image = new env.Image();
    const finish = (message) => {
      env.clearTimeout(timer);
      image.onload = image.onerror = null;
      env.URL.revokeObjectURL(url);
      resolve(message);
    };
    const timer = env.setTimeout(
      () => finish("The image took too long to open. Try a smaller image."),
      15000,
    );
    image.onload = () =>
      finish(
        !image.naturalWidth || !image.naturalHeight
          ? "This image could not be opened. Choose another file."
          : image.naturalWidth * image.naturalHeight > maxPixels
            ? `Choose an image up to ${maxPixels / 1_000_000} megapixels.`
            : "",
      );
    image.onerror = () =>
      finish(
        "This image could not be opened. Choose a valid JPG, PNG, GIF or WebP file.",
      );
    image.src = url;
  });
}
