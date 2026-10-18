import { toast } from "../services/feedback";
import { Link } from "react-router-dom";
import useFormValidation from "../hooks/useFormValidation";
import FieldError from "./FieldError";
import { validateProduct, rules } from "../utils/adminValidation";
import Skeleton, { TableSkeleton } from "./Skeleton";
import TableScroll from "./TableScroll";
import ProductPhoto from "./ProductPhoto";
import { useEffect, useState, useMemo } from "react";
import AdminLayout from "./AdminLayout";
import EditorDialog from "./EditorDialog";
import ConfirmDialog from "./ConfirmDialog";
import Pagination from "./Pagination";
import UploadField from "./UploadField";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import { imageURL } from "../utils/images";

const empty = {
  name: "",
  category: "",
  price: "",
  stock: "",
  condition: "Good",
  size: "",
  material: "",
  description: "",
};
export default function AdminProducts({ outOfStockOnly = false }) {
  const [products, setProducts] = useState([]);
  const [catalogOptions, setCatalogOptions] = useState(null);
  const [failedPhotos, setFailedPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState("");
  const validation = useFormValidation("product");
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [productsResponse, optionsResponse] = await Promise.all([
          apiFetch(`${BACKEND_URL}/api/admin/products`, {
            signal: controller.signal,
          }),
          apiFetch(`${BACKEND_URL}/api/admin/catalog-options`, {
            signal: controller.signal,
          }),
        ]);
        const [data, options] = await Promise.all([
          productsResponse.json(),
          optionsResponse.json(),
        ]);
        if (
          !productsResponse.ok ||
          !Array.isArray(data.products) ||
          !optionsResponse.ok ||
          options.success === false
        )
          throw new Error(
            data.error ||
              options.error ||
              "Products and catalog choices couldn’t be loaded. Please try again.",
          );
        setProducts(data.products);
        setCatalogOptions({
          categories: options.categories,
          sizes: options.sizes,
          materials: options.materials,
        });
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);
  const categories = [
    ...new Set([
      ...(catalogOptions?.categories || []),
      ...products.map((product) => product.category).filter(Boolean),
    ]),
  ].sort();
  const visible = useMemo(
    () =>
      products.filter(
        (product) =>
          (outOfStockOnly
            ? Number(product.stock) <= 0
            : Number(product.stock) > 0) &&
          (category === "all" || product.category === category) &&
          [
            product.name,
            product.category,
            product.product_id,
            product.size,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          ),
      ),
    [products, category, search, outOfStockOnly],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  const openEditor = (product) => {
    validation.reset();
    setEditor(product || "new");
    setForm(
      product
        ? {
            ...empty,
            ...product,
            price: String(product.price),
            stock: String(product.stock),
          }
        : empty,
    );
    setImage(null);
    setFormError("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (
      !validation.check(
        validateProduct(form, editor !== "new" ? editor.condition : undefined),
      )
    ) {
      setFormError("Review the highlighted fields before saving.");
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      for (const key of Object.keys(empty))
        data.append(key, String(form[key] ?? "").trim());
      if (image) data.append("image", image);
      const response = await apiFetch(
        `${BACKEND_URL}/api/products/${editor === "new" ? "" : editor._id}`,
        { method: editor === "new" ? "POST" : "PUT", body: data },
      );
      const result = await response.json();
      if (!response.ok || result.success === false) {
        validation.reject(result);
        throw new Error(
          result.error || result.message || "The product couldn’t be saved.",
        );
      }
      setEditor(null);
      toast.success(
        editor === "new"
          ? "Product added to the collection."
          : "Product details updated.",
      );
      setRetry((value) => value + 1);
    } catch (failure) {
      setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteProduct = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `${BACKEND_URL}/api/products/${remove._id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error(data.error || "This product couldn’t be deleted.");
      setProducts((previous) =>
        previous.filter((product) => product._id !== remove._id),
      );
      setPage(1);
      setRemove(null);
      toast.success("The product has been removed from the catalog.");
    } catch (failure) {
      setRemove(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminLayout
      title={outOfStockOnly ? "Out-of-stock products" : "Products & inventory"}
      description={
        outOfStockOnly
          ? "Review sold-out pieces and update their stock to put them back in the collection."
          : "Keep your pieces, prices, and available quantities up to date."
      }
      actions={
        outOfStockOnly ? (
          <Link className="ui-button ui-button-light" to="/admin/products">
            <Icon name="bag" size={17} />
            All products
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="ui-button ui-button-light"
              to="/admin/out-of-stock"
            >
              <Icon name="bag" size={17} />
              Out of stock (
              {products.filter((product) => Number(product.stock) <= 0).length})
            </Link>
            <button
              className="ui-button ui-button-dark"
              onClick={() => openEditor(null)}
            >
              <Icon name="bag" size={17} />
              Add a product
            </button>
          </div>
        )
      }
    >
      <div className="admin-stat-grid compact">
        {[
          ["Catalog pieces", products.length],
          [
            "Available",
            products.filter((product) => Number(product.stock) > 0).length,
          ],
          [
            "Low stock",
            products.filter(
              (product) =>
                Number(product.stock) > 0 && Number(product.stock) <= 3,
            ).length,
          ],
          [
            "Out of stock",
            products.filter((product) => Number(product.stock) <= 0).length,
          ],
        ].map(([label, value]) => (
          <div className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>
              {loading ? (
                <Skeleton className="my-1 h-8 w-20 max-w-full" />
              ) : (
                value
              )}
            </strong>
          </div>
        ))}
      </div>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
          <button
            className="ui-button ui-button-light"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar flex items-center justify-between gap-5 py-5 px-[22px] border-b border-line max-[650px]:flex-wrap max-[650px]:p-4 max-[650px]:gap-[14px]">
          <div className="admin-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label={
                outOfStockOnly
                  ? "Search out-of-stock products"
                  : "Search products"
              }
              value={search}
              placeholder={
                outOfStockOnly
                  ? "Search sold-out pieces…"
                  : "Search name, size, or category…"
              }
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <label>
            Category
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <TableScroll label="Products and inventory">
          <table className="admin-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Inventory</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton
                  columns={5}
                  label="Loading catalog"
                  thumbnail={true}
                />
              ) : !visible.length ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {outOfStockOnly && !search && category === "all"
                      ? "No sold-out products. Your active collection is in stock."
                      : !outOfStockOnly && !search && category === "all"
                        ? "No in-stock products are available. Check the Out of stock module."
                        : search || category !== "all"
                          ? "No products match your filters."
                          : "Your collection starts here. Add your first product."}
                  </td>
                </tr>
              ) : (
                visible
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map((product) => (
                    <tr key={product._id}>
                      <td>
                        <div className="admin-product-cell">
                          <ProductPhoto
                            className="admin-product-thumbnail"
                            src={product.image}
                            name={product.name}
                            onUnavailable={() =>
                              setFailedPhotos((previous) =>
                                previous[product._id] ===
                                imageURL(product.image)
                                  ? previous
                                  : {
                                      ...previous,
                                      [product._id]: imageURL(product.image),
                                    },
                              )
                            }
                          />
                          <div>
                            <strong>{product.name}</strong>
                            <span>
                              {product.condition || "Pre-loved"}
                              {product.size ? ` · Size ${product.size}` : ""}
                            </span>
                            {(imageURL(product.image) ===
                              "/product-placeholder.svg" ||
                              failedPhotos[product._id] ===
                                imageURL(product.image)) && (
                              <p className="mt-2 text-small font-medium text-accent">
                                Photo unavailable. Edit to add a replacement.
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{product.category || "—"}</td>
                      <td className="admin-number">
                        {formatPrice(product.price)}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${Number(product.stock) <= 0 ? "empty" : Number(product.stock) <= 3 ? "low" : "active"}`}
                        >
                          {Number(product.stock) <= 0
                            ? "Out of stock"
                            : `${product.stock} available`}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            onClick={() => openEditor(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setRemove(product)}
                            aria-label={`Delete ${product.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </TableScroll>
        <Pagination
          loading={loading}
          count={visible.length}
          page={currentPage}
          onChange={setPage}
        />
      </section>
      {editor && (
        <EditorDialog
          title={
            editor === "new" ? "Add a new find." : "Give this piece an update."
          }
          description="Clear details and a good photo help customers choose with confidence."
          busy={busy}
          onClose={() => setEditor(null)}
          wide
          className="product-editor-dialog"
        >
          {formError && (
            <div className="ui-message error" role="alert">
              {formError}
            </div>
          )}
          <form
            ref={validation.formRef}
            noValidate
            onSubmit={save}
            onChange={(event) => {
              validation.clear(event.target.name);
              setFormError("");
            }}
          >
            <fieldset
              className="ui-fieldset min-w-0 border-0 p-0 m-0"
              disabled={busy}
            >
              <div className="product-editor-layout">
                <aside className="product-editor-media">
                  <h3>Product photo</h3>
                  <p>
                    Show the whole piece in good light, with a simple
                    background.
                  </p>
                  <UploadField
                    label={
                      editor === "new"
                        ? "Add a photo (optional)"
                        : "Product photo"
                    }
                    currentSrc={editor !== "new" ? editor.image : ""}
                    description="Keep the fit, print, and any signs of wear visible."
                    error={validation.errors.image}
                    file={image}
                    onChange={setImage}
                    onError={(message) => {
                      setFormError(message);
                      if (!message) validation.clear("image");
                    }}
                    disabled={busy}
                    previewAlt="Selected product photo"
                  />
                  <p className="product-editor-note">
                    <Icon name="photo" size={18} /> Photos are shown without
                    cropping. Preview your image before saving.
                  </p>
                </aside>
                <div className="product-editor-details">
                  <h3>Product details</h3>
                  <p className="ui-field-hint mb-5">
                    Add a clear name, accurate sizing, and an honest condition
                    description.
                  </p>
                  <div className="editor-fields grid grid-cols-[1fr_1fr] gap-[0_18px] max-[650px]:block">
                    <div className="ui-field mb-5 editor-field-full">
                      <label htmlFor="product-name">Product name</label>
                      <input
                        id="product-name"
                        {...validation.bind("name")}
                        value={form.name}
                        placeholder="e.g. Forest green cotton graphic tee"
                        required
                        maxLength={rules.productText.name}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                      />
                      <FieldError
                        id={validation.errorId("name")}
                        error={validation.errors.name}
                      />
                    </div>
                    <div className="ui-field mb-5">
                      <label htmlFor="product-category">Category</label>
                      <select
                        id="product-category"
                        {...validation.bind("category")}
                        required
                        value={form.category}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            category: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a category</option>
                        {[
                          ...new Set([
                            ...(catalogOptions?.categories || []),
                            ...(editor !== "new" && editor.category
                              ? [editor.category]
                              : []),
                          ]),
                        ].map((value) => (
                          <option value={value} key={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <FieldError
                        id={validation.errorId("category")}
                        error={validation.errors.category}
                      />
                      <p className="ui-field-hint">
                        Manage category choices in Maintenance → Product catalog
                        choices.
                      </p>
                    </div>
                    <div className="ui-field mb-5">
                      <label htmlFor="product-condition">Condition</label>
                      <select
                        id="product-condition"
                        {...validation.bind("condition")}
                        value={form.condition}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            condition: event.target.value,
                          }))
                        }
                      >
                        {[
                          ...new Set([form.condition, ...rules.conditions]),
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      <FieldError
                        id={validation.errorId("condition")}
                        error={validation.errors.condition}
                      />
                    </div>
                    {[
                      ["price", "Price (PHP)", "0.01"],
                      ["stock", "Available stock", "1"],
                    ].map(([key, label, step]) => (
                      <div className="ui-field mb-5" key={key}>
                        <label htmlFor={`product-${key}`}>{label}</label>
                        <input
                          id={`product-${key}`}
                          {...validation.bind(key)}
                          type="number"
                          min={0}
                          max={
                            key === "price" ? rules.maxAmount : rules.maxStock
                          }
                          step={step}
                          required
                          value={form[key]}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <FieldError
                          id={validation.errorId(key)}
                          error={validation.errors[key]}
                        />
                      </div>
                    ))}
                    {[
                      ["size", "Size", "sizes"],
                      ["material", "Material", "materials"],
                    ].map(([key, label, optionKey]) => (
                      <div className="ui-field mb-5" key={key}>
                        <label htmlFor={`product-${key}`}>
                          {label}{" "}
                          <span className="field-optional">(optional)</span>
                        </label>
                        <select
                          id={`product-${key}`}
                          {...validation.bind(key)}
                          value={form[key]}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              [key]: event.target.value,
                            }))
                          }
                        >
                          <option value="">No {label.toLowerCase()}</option>
                          {[
                            ...new Set([
                              ...(catalogOptions?.[optionKey] || []),
                              ...(editor !== "new" && editor[key]
                                ? [editor[key]]
                                : []),
                            ]),
                          ].map((value) => (
                            <option value={value} key={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <FieldError
                          id={validation.errorId(key)}
                          error={validation.errors[key]}
                        />
                      </div>
                    ))}
                    <div className="ui-field mb-5 editor-field-full">
                      <label htmlFor="product-description">Description</label>
                      <textarea
                        id="product-description"
                        {...validation.bind("description")}
                        rows={5}
                        maxLength={rules.productText.description}
                        value={form.description}
                        placeholder="Fit, fabric, and any wear customers should know about…"
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            description: event.target.value,
                          }))
                        }
                      />
                      <div className="product-description-help">
                        <span>
                          Include the fit, fabric, measurements, and any flaws.
                        </span>
                        <span>
                          {String(form.description || "").length}/
                          {rules.productText.description}
                        </span>
                      </div>
                      <FieldError
                        id={validation.errorId("description")}
                        error={validation.errors.description}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="editor-footer flex justify-end gap-3 pt-5 mt-2 border-t border-line">
                <button
                  className="ui-button ui-button-light"
                  type="button"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button className="ui-button ui-button-dark" type="submit">
                  {busy
                    ? "Saving…"
                    : editor === "new"
                      ? "Add product"
                      : "Save changes"}
                </button>
              </div>
            </fieldset>
          </form>
        </EditorDialog>
      )}
      {remove && (
        <ConfirmDialog
          title="Delete this product?"
          description={`“${remove.name}” will be removed from your catalog. Past orders keep their saved product details. This action can’t be undone.`}
          confirmLabel="Delete product"
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={deleteProduct}
        />
      )}
    </AdminLayout>
  );
}
