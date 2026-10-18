const priceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export const formatPrice = (value) =>
  value === null ||
  value === undefined ||
  value === "" ||
  !Number.isFinite(Number(value))
    ? "—"
    : priceFormatter.format(Number(value));

export const isProductAvailable = (product) =>
  product.is_active !== false &&
  product.isActive !== false &&
  Number.isFinite(Number(product.stock)) &&
  Number(product.stock) > 0;

export function filterProducts(
  products,
  {
    search = "",
    category = "All",
    sort = "featured",
    inStockOnly = false,
  } = {},
) {
  const query = search.trim().toLowerCase();
  const result = products.filter((product) => {
    const text = [
      product.name,
      product.description,
      product.category,
      product.size,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!query || text.includes(query)) &&
      (category === "All" || product.category === category) &&
      (!inStockOnly || isProductAvailable(product))
    );
  });
  return result.sort((a, b) => {
    const availability =
      Number(Number(b.stock) > 0) - Number(Number(a.stock) > 0);
    if (availability) return availability;
    if (sort === "price-asc") return Number(a.price) - Number(b.price);
    if (sort === "price-desc") return Number(b.price) - Number(a.price);
    if (sort === "name") return String(a.name).localeCompare(String(b.name));
    return 0;
  });
}
