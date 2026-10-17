import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import EditorDialog from "./EditorDialog";
import ConfirmDialog from "./ConfirmDialog";
import Pagination from "./Pagination";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
const empty = {
  code: "",
  discountType: "percentage",
  value: "",
  minPurchase: "",
  validUntil: "",
  applyTo: "all",
  category: "",
};
const expiry = (value) =>
  value ? new Date(String(value).slice(0, 10) + "T23:59:59") : null;

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/admin/discounts`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(
            data.error ||
              "Discount codes couldn’t be loaded. Please try again.",
          );
        setDiscounts(data.discounts || []);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    apiFetch(`${BACKEND_URL}/api/products`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted)
          setCategories(
            [
              ...new Set(
                (data.products || [])
                  .map((product) => product.category)
                  .filter(Boolean),
              ),
            ].sort(),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [retry]);
  const visible = discounts.filter((discount) =>
    [discount.code, discount.category].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  );
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (
      !form.code.trim() ||
      !Number.isFinite(Number(form.value)) ||
      Number(form.value) <= 0 ||
      (form.discountType === "percentage" && Number(form.value) > 100) ||
      Number(form.minPurchase) < 0
    ) {
      setFormError(
        "Enter a code and a valid discount amount. Percentage discounts can be up to 100%.",
      );
      return;
    }
    if (form.applyTo === "category" && !form.category) {
      setFormError("Choose a category for this code.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/admin/discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          code: form.code.trim().toUpperCase(),
          category: form.applyTo === "category" ? form.category : "",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          data.error || data.message || "The discount code couldn’t be saved.",
        );
      setEditor(false);
      setMessage("Discount code saved.");
      setRetry((value) => value + 1);
    } catch (failure) {
      setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteDiscount = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `${BACKEND_URL}/api/admin/discounts/${remove._id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "The code couldn’t be deleted.");
      setDiscounts((previous) =>
        previous.filter((discount) => discount._id !== remove._id),
      );
      setRemove(null);
      setPage(1);
      setMessage("Discount code deleted.");
    } catch (failure) {
      setRemove(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminLayout
      title="Discount codes"
      description="Keep discount codes, limits, and dates in one place."
      actions={
        <button
          className="ui-button ui-button-dark"
          onClick={() => {
            setEditor(true);
            setForm(empty);
            setFormError("");
          }}
        >
          <Icon name="shield" size={17} />
          Create a code
        </button>
      }
    >
      <div className="admin-notice discount-availability">
        <Icon name="shield" size={18} />
        <p>
          Customers can apply active codes at checkout. Minimum spend, category
          restrictions and expiration dates are checked before an order is
          created.
        </p>
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
              aria-label="Search discount codes"
              placeholder="Search code or category…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="admin-help" style={{ margin: 0 }}>
            {discounts.length} saved {discounts.length === 1 ? "code" : "codes"}
          </span>
        </div>
        <div
          className="admin-table-scroll"
          tabIndex={0}
          aria-label="Discount codes table, scroll horizontally on smaller screens"
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Discount</th>
                <th scope="col">Scope</th>
                <th scope="col">Minimum order</th>
                <th scope="col">Expires</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty" role="status">
                    Loading discount codes…
                  </td>
                </tr>
              ) : !visible.length ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    {search
                      ? "No codes match your search."
                      : "No discount codes yet."}
                  </td>
                </tr>
              ) : (
                visible.slice((page - 1) * 10, page * 10).map((discount) => {
                  const date = expiry(discount.validUntil || discount.endDate);
                  const expired = date && date < new Date();
                  return (
                    <tr key={discount._id}>
                      <td>
                        <strong className="admin-discount-code">
                          {discount.code}
                        </strong>
                      </td>
                      <td className="admin-number">
                        {(discount.discountType || discount.type) ===
                        "percentage"
                          ? `${discount.value}%`
                          : formatPrice(discount.value)}
                      </td>
                      <td>
                        {discount.applyTo === "category"
                          ? discount.category
                          : "All products"}
                      </td>
                      <td className="admin-number">
                        {formatPrice(
                          discount.minPurchase ?? discount.minOrder ?? 0,
                        )}
                      </td>
                      <td>
                        {date && !Number.isNaN(date.getTime())
                          ? date.toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No expiry"}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${expired || discount.isActive === false ? "inactive" : "active"}`}
                        >
                          {expired
                            ? "Expired"
                            : discount.isActive === false
                              ? "Inactive"
                              : "Active"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-table-action"
                          aria-label={`Delete code ${discount.code}`}
                          onClick={() => setRemove(discount)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination count={visible.length} page={page} onChange={setPage} />
      </section>
      {editor && (
        <EditorDialog
          title="Create a discount code."
          description="Set a clear value, scope, and expiration date."
          busy={busy}
          onClose={() => setEditor(false)}
        >
          {formError && (
            <div className="ui-message error" role="alert">
              {formError}
            </div>
          )}
          <form onSubmit={save}>
            <fieldset className="ui-fieldset" disabled={busy}>
              <div className="ui-field">
                <label htmlFor="discount-code">Code</label>
                <input
                  id="discount-code"
                  autoComplete="off"
                  maxLength={40}
                  required
                  value={form.code}
                  placeholder="A memorable code…"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="editor-fields">
                <div className="ui-field">
                  <label htmlFor="discount-type">Discount type</label>
                  <select
                    id="discount-type"
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        discountType: event.target.value,
                        value: "",
                      }))
                    }
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount (PHP)</option>
                  </select>
                </div>
                <div className="ui-field">
                  <label htmlFor="discount-value">
                    {form.discountType === "percentage"
                      ? "Percentage (%)"
                      : "Amount (PHP)"}
                  </label>
                  <input
                    id="discount-value"
                    type="number"
                    min="0.01"
                    max={form.discountType === "percentage" ? 100 : undefined}
                    step="0.01"
                    required
                    value={form.value}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        value: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="discount-minimum">Minimum order (PHP)</label>
                  <input
                    id="discount-minimum"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.minPurchase}
                    placeholder="0.00"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        minPurchase: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="discount-expiry">
                    Expiration date{" "}
                    <span className="field-optional">(optional)</span>
                  </label>
                  <input
                    id="discount-expiry"
                    type="date"
                    min={new Date().toLocaleDateString("en-CA")}
                    value={form.validUntil}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        validUntil: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="ui-field">
                <label htmlFor="discount-scope">Applies to</label>
                <select
                  id="discount-scope"
                  value={form.applyTo}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      applyTo: event.target.value,
                    }))
                  }
                >
                  <option value="all">All products</option>
                  <option value="category" disabled={!categories.length}>
                    One category
                  </option>
                </select>
              </div>
              {form.applyTo === "category" && (
                <div className="ui-field">
                  <label htmlFor="discount-category">Category</label>
                  <select
                    id="discount-category"
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
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="editor-footer">
                <button
                  className="ui-button ui-button-light"
                  type="button"
                  onClick={() => setEditor(false)}
                >
                  Cancel
                </button>
                <button className="ui-button ui-button-dark" type="submit">
                  {busy ? "Saving…" : "Save discount code"}
                </button>
              </div>
            </fieldset>
          </form>
        </EditorDialog>
      )}
      {remove && (
        <ConfirmDialog
          title="Delete this discount code?"
          description={`“${remove.code}” will be removed from your saved codes. This action can’t be undone.`}
          confirmLabel="Delete code"
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={deleteDiscount}
        />
      )}
    </AdminLayout>
  );
}
