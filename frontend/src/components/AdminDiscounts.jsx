import { toast } from "../services/feedback";
import useFormValidation from "../hooks/useFormValidation";
import FieldError from "./FieldError";
import { validateDiscount, rules, storeToday } from "../utils/adminValidation";
import { TableSkeleton } from "./Skeleton";
import TableScroll from "./TableScroll";
import { useEffect, useState, useMemo } from "react";
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

  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState("");
  const validation = useFormValidation("discount");
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
  const visible = useMemo(
    () =>
      discounts.filter((discount) =>
        [discount.code, discount.category].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
      ),
    [discounts, search],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (!validation.check(validateDiscount(form))) {
      setFormError("Review the highlighted fields before saving.");
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
      if (!response.ok || !data.success) {
        validation.reject(data);
        throw new Error(
          data.error || data.message || "The discount code couldn’t be saved.",
        );
      }
      setEditor(false);
      toast.success("Discount code saved.");
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
      toast.success("Discount code deleted.");
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
      description="Manage discount codes, minimum spend, and expiration dates."
      actions={
        <button
          className="ui-button ui-button-dark"
          onClick={() => {
            setEditor(true);
            validation.reset();
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
      <section className="admin-panel">
        <div className="admin-toolbar flex items-center justify-between gap-5 py-5 px-[22px] border-b border-line max-[650px]:flex-wrap max-[650px]:p-4 max-[650px]:gap-[14px]">
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
        <TableScroll label="Discount codes">
          <table className="admin-table" aria-busy={loading}>
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
                <TableSkeleton
                  columns={7}
                  label="Loading discount codes"
                  thumbnail={false}
                />
              ) : !visible.length ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    {search
                      ? "No codes match your search."
                      : "No discount codes yet."}
                  </td>
                </tr>
              ) : (
                visible
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map((discount) => {
                    const date = expiry(
                      discount.validUntil || discount.endDate,
                    );
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
              <div className="ui-field mb-5">
                <label htmlFor="discount-code">Code</label>
                <input
                  id="discount-code"
                  {...validation.bind("code")}
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
                <FieldError
                  id={validation.errorId("code")}
                  error={validation.errors.code}
                />
              </div>
              <div className="editor-fields grid grid-cols-[1fr_1fr] gap-[0_18px] max-[650px]:block">
                <div className="ui-field mb-5">
                  <label htmlFor="discount-type">Discount type</label>
                  <select
                    id="discount-type"
                    {...validation.bind("discountType")}
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
                  <FieldError
                    id={validation.errorId("discountType")}
                    error={validation.errors.discountType}
                  />
                </div>
                <div className="ui-field mb-5">
                  <label htmlFor="discount-value">
                    {form.discountType === "percentage"
                      ? "Percentage (%)"
                      : "Amount (PHP)"}
                  </label>
                  <input
                    id="discount-value"
                    {...validation.bind("value")}
                    type="number"
                    min="0.01"
                    max={
                      form.discountType === "percentage" ? 100 : rules.maxAmount
                    }
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
                  <FieldError
                    id={validation.errorId("value")}
                    error={validation.errors.value}
                  />
                </div>
                <div className="ui-field mb-5">
                  <label htmlFor="discount-minimum">Minimum order (PHP)</label>
                  <input
                    id="discount-minimum"
                    {...validation.bind("minPurchase")}
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
                  <FieldError
                    id={validation.errorId("minPurchase")}
                    error={validation.errors.minPurchase}
                  />
                </div>
                <div className="ui-field mb-5">
                  <label htmlFor="discount-expiry">
                    Expiration date{" "}
                    <span className="field-optional">(optional)</span>
                  </label>
                  <input
                    id="discount-expiry"
                    {...validation.bind("validUntil")}
                    type="date"
                    min={storeToday()}
                    value={form.validUntil}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        validUntil: event.target.value,
                      }))
                    }
                  />
                  <FieldError
                    id={validation.errorId("validUntil")}
                    error={validation.errors.validUntil}
                  />
                </div>
              </div>
              <div className="ui-field mb-5">
                <label htmlFor="discount-scope">Applies to</label>
                <select
                  id="discount-scope"
                  {...validation.bind("applyTo")}
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
                <FieldError
                  id={validation.errorId("applyTo")}
                  error={validation.errors.applyTo}
                />
              </div>
              {form.applyTo === "category" && (
                <div className="ui-field mb-5">
                  <label htmlFor="discount-category">Category</label>
                  <select
                    id="discount-category"
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
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <FieldError
                    id={validation.errorId("category")}
                    error={validation.errors.category}
                  />
                </div>
              )}
              <div className="editor-footer flex justify-end gap-3 pt-5 mt-2 border-t border-line">
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
