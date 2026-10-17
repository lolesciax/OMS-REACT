import Image from "./Image";
import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import EditorDialog from "./EditorDialog";
import ConfirmDialog from "./ConfirmDialog";
import Pagination from "./Pagination";
import UploadField from "./UploadField";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";

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
export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState("");
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/products`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.products))
          throw new Error(
            data.error || "Products couldn’t be loaded. Please try again.",
          );
        setProducts(data.products);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort();
  const suggestions = [
    ...new Set([
      ...categories,
      "Tops",
      "Bottoms",
      "Outerwear",
      "Dresses",
      "Footwear",
      "Accessories",
    ]),
  ];
  const visible = products.filter(
    (product) =>
      (category === "all" || product.category === category) &&
      [product.name, product.category, product.product_id, product.size].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
  );
  const openEditor = (product) => {
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
      !form.name.trim() ||
      !form.category.trim() ||
      form.price === "" ||
      form.stock === ""
    ) {
      setFormError("Add a name, category, price, and stock quantity.");
      return;
    }
    if (
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0 ||
      !Number.isInteger(Number(form.stock)) ||
      Number(form.stock) < 0
    ) {
      setFormError(
        "Price must be zero or more. Stock must be a whole number of zero or more.",
      );
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
      if (!response.ok || result.success === false)
        throw new Error(
          result.error || result.message || "The product couldn’t be saved.",
        );
      setEditor(null);
      setMessage(
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
      setMessage("The product has been removed from the catalog.");
    } catch (failure) {
      setRemove(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminLayout
      title="Products & inventory"
      description="Keep your pieces, prices, and available quantities up to date."
      actions={
        <button
          className="ui-button ui-button-dark"
          onClick={() => openEditor(null)}
        >
          <Icon name="bag" size={17} />
          Add a product
        </button>
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
            <strong>{loading ? "—" : value}</strong>
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
      {message && (
        <div className="ui-message success" role="status">
          {message}
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
          <div className="admin-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="Search products"
              value={search}
              placeholder="Search name, size, or category…"
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
        <div
          className="admin-table-scroll"
          tabIndex={0}
          aria-label="Product table, scroll horizontally on smaller screens"
        >
          <table className="admin-table">
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
                <tr>
                  <td colSpan={5} className="admin-table-empty" role="status">
                    Loading the catalog…
                  </td>
                </tr>
              ) : !visible.length ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search || category !== "all"
                      ? "No products match your filters."
                      : "Your collection starts here. Add your first product."}
                  </td>
                </tr>
              ) : (
                visible.slice((page - 1) * 10, page * 10).map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="admin-product-cell">
                        <Image
                          src={product.image || "/product-placeholder.svg"}
                          alt=""
                        />
                        <div>
                          <strong>{product.name}</strong>
                          <span>
                            {product.condition || "Pre-loved"}
                            {product.size ? ` · Size ${product.size}` : ""}
                          </span>
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
        </div>
        <Pagination
          count={visible.length}
          page={Math.min(page, Math.max(1, Math.ceil(visible.length / 10)))}
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
        >
          {formError && (
            <div className="ui-message error" role="alert">
              {formError}
            </div>
          )}
          <form onSubmit={save}>
            <fieldset className="ui-fieldset" disabled={busy}>
              <div className="editor-fields">
                <div className="ui-field editor-field-full">
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    value={form.name}
                    required
                    maxLength={150}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="product-category">Category</label>
                  <input
                    id="product-category"
                    list="product-categories"
                    value={form.category}
                    required
                    maxLength={80}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        category: event.target.value,
                      }))
                    }
                  />
                  <datalist id="product-categories">
                    {suggestions.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </datalist>
                  <p className="ui-field-hint">
                    Choose an existing category or type a new one.
                  </p>
                </div>
                <div className="ui-field">
                  <label htmlFor="product-condition">Condition</label>
                  <select
                    id="product-condition"
                    value={form.condition}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        condition: event.target.value,
                      }))
                    }
                  >
                    {[
                      ...new Set([
                        form.condition,
                        "Like New",
                        "Excellent",
                        "Good",
                        "Fair",
                        "Used",
                      ]),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                {[
                  ["price", "Price (PHP)", "0.01"],
                  ["stock", "Available stock", "1"],
                ].map(([key, label, step]) => (
                  <div className="ui-field" key={key}>
                    <label htmlFor={`product-${key}`}>{label}</label>
                    <input
                      id={`product-${key}`}
                      type="number"
                      min={0}
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
                  </div>
                ))}
                {[
                  ["size", "Size"],
                  ["material", "Material"],
                ].map(([key, label]) => (
                  <div className="ui-field" key={key}>
                    <label htmlFor={`product-${key}`}>
                      {label} <span className="field-optional">(optional)</span>
                    </label>
                    <input
                      id={`product-${key}`}
                      maxLength={80}
                      value={form[key]}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="ui-field editor-field-full">
                  <label htmlFor="product-description">Description</label>
                  <textarea
                    id="product-description"
                    rows={3}
                    maxLength={2000}
                    value={form.description}
                    placeholder="Fit, fabric, and any wear customers should know about…"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              {editor !== "new" && editor.image && !image && (
                <div className="admin-current-image">
                  <Image src={editor.image} alt="Current product photo" />
                  <span>
                    Current product photo. Choose a new image to replace it.
                  </span>
                </div>
              )}
              <UploadField
                label={
                  editor === "new"
                    ? "Product photo"
                    : "Replace product photo (optional)"
                }
                file={image}
                onChange={setImage}
                onError={setFormError}
                disabled={busy}
              />
              <div className="editor-footer">
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
