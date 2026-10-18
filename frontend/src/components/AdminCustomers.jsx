import { toast } from "../services/feedback";
import useFormValidation from "../hooks/useFormValidation";
import FieldError from "./FieldError";
import { validateAccount, rules } from "../utils/adminValidation";
import Skeleton, { TableSkeleton } from "./Skeleton";
import TableScroll from "./TableScroll";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import AdminLayout from "./AdminLayout";
import EditorDialog from "./EditorDialog";
import ConfirmDialog from "./ConfirmDialog";
import PasswordField from "./PasswordField";
import Pagination from "./Pagination";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";

const empty = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  roleId: "",
  isActive: true,
};
export default function AdminCustomers() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState("");
  const validation = useFormValidation("person");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [data, catalog] = await Promise.all(
          ["customers", "roles"].map(async (path) => {
            const response = await apiFetch(
              `${BACKEND_URL}/api/admin/${path}`,
              { signal: controller.signal },
            );
            const body = await response.json();
            if (!response.ok || !body.success)
              throw new Error(body.error || "Accounts could not be loaded.");
            return body;
          }),
        );
        setPeople(data.customers || []);
        setRoles(catalog.roles || []);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);
  const isSelf = (person) =>
    !!person &&
    typeof person === "object" &&
    ((!!person._id && person._id === user?._id) ||
      (!!person.username && person.username === user?.username));
  const visible = useMemo(
    () =>
      people.filter(
        (person) =>
          (role === "all" || person.roleId === role) &&
          [
            person.username,
            person.email,
            person.firstName,
            person.lastName,
            person.user_id,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          ),
      ),
    [people, role, search],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  const open = (person) => {
    validation.reset();
    setEditor(person || "new");
    setForm(
      person
        ? {
            ...empty,
            ...person,
            password: "",
            isActive: person.isActive !== false,
          }
        : {
            ...empty,
            roleId:
              roles.find((item) => item.code === "customer" && item.active)
                ?._id || "",
          },
    );
    setFormError("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (!validation.check(validateAccount(form, editor === "new"))) {
      setFormError("Review the highlighted fields before saving.");
      return;
    }
    setBusy(true);
    try {
      const payload = Object.fromEntries(
        Object.keys(empty).map((key) => [
          key,
          typeof form[key] === "string" && key !== "password"
            ? form[key].trim()
            : form[key],
        ]),
      );
      if (!payload.password) delete payload.password;
      const response = await apiFetch(
        `${BACKEND_URL}/api/admin/users${editor === "new" ? "" : `/${editor._id}`}`,
        {
          method: editor === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok || data.success === false) {
        validation.reject(data);
        throw new Error(data.error || "The account couldn’t be saved.");
      }
      setEditor(null);
      toast.success(
        editor === "new" ? "Account created." : "Account details updated.",
      );
      setRetry((value) => value + 1);
    } catch (failure) {
      setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const deletePerson = async () => {
    if (busy || isSelf(remove)) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `${BACKEND_URL}/api/admin/users/${remove._id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error(data.error || "The account couldn’t be removed.");
      setPeople((previous) =>
        previous.filter((person) => person._id !== remove._id),
      );
      setPage(1);
      setRemove(null);
      toast.success("The account has been removed.");
    } catch (failure) {
      setRemove(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminLayout
      title="People & accounts"
      description="Manage customer and administrator accounts with care."
      actions={
        <button className="ui-button ui-button-dark" onClick={() => open(null)}>
          <Icon name="user" size={17} />
          Add an account
        </button>
      }
    >
      <div className="admin-stat-grid compact">
        {[
          ["All accounts", people.length],
          ["Customers", people.filter((person) => !person.isAdmin).length],
          ["Administrators", people.filter((person) => person.isAdmin).length],
          [
            "Active accounts",
            people.filter((person) => person.isActive !== false).length,
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
              aria-label="Search accounts"
              placeholder="Search name, username, or email…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All accounts</option>
              {roles.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TableScroll label="Customer and administrator accounts">
          <table className="admin-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton
                  columns={5}
                  label="Loading accounts"
                  thumbnail={false}
                />
              ) : !visible.length ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search || role !== "all"
                      ? "No accounts match your filters."
                      : "No accounts to display."}
                  </td>
                </tr>
              ) : (
                visible
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map((person) => (
                    <tr key={person._id}>
                      <td>
                        <div className="admin-person-cell">
                          <strong>
                            {[person.firstName, person.lastName]
                              .filter(Boolean)
                              .join(" ") || person.username}
                            {isSelf(person) ? " (you)" : ""}
                          </strong>
                          <span>@{person.username}</span>
                        </div>
                      </td>
                      <td>{person.email}</td>
                      <td>
                        <span className="admin-badge">{person.roleLabel}</span>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${person.isActive === false ? "inactive" : "active"}`}
                        >
                          {person.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            aria-label={`Edit account ${person.username}`}
                            onClick={() => open(person)}
                          >
                            Edit
                          </button>
                          <button
                            aria-label={`Delete account ${person.username}`}
                            disabled={isSelf(person) || person.isAdmin}
                            title={
                              isSelf(person)
                                ? "You cannot delete your own account"
                                : undefined
                            }
                            onClick={() => setRemove(person)}
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
            editor === "new"
              ? "Welcome someone new."
              : "Update account details."
          }
          description="Choose the right access level and keep contact details current."
          busy={busy}
          onClose={() => setEditor(null)}
          wide
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
              <div className="editor-fields grid grid-cols-[1fr_1fr] gap-[0_18px] max-[650px]:block">
                {[
                  ["username", "Username", "text"],
                  ["email", "Email address", "email"],
                  ["firstName", "First name", "text"],
                  ["lastName", "Last name", "text"],
                  ["phone", "Mobile number", "tel"],
                ].map(([key, label, type]) => (
                  <div className="ui-field mb-5" key={key}>
                    <label htmlFor={`person-${key}`}>{label}</label>
                    <input
                      id={`person-${key}`}
                      {...validation.bind(key)}
                      type={type}
                      value={form[key]}
                      maxLength={
                        key === "username"
                          ? editor === "new"
                            ? 16
                            : 80
                          : key === "phone"
                            ? rules.phoneMaxLength
                            : key === "email"
                              ? rules.emailMaxLength
                              : rules.profileNameMaxLength
                      }
                      required={["username", "email"].includes(key)}
                      readOnly={key === "username" && editor !== "new"}
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
                    {key === "username" && editor !== "new" && (
                      <p className="ui-field-hint">
                        The username stays the same for this account.
                      </p>
                    )}
                  </div>
                ))}
                <div className="ui-field mb-5">
                  <label htmlFor="person-role">Account role</label>
                  <select
                    id="person-role"
                    {...validation.bind("roleId")}
                    disabled={isSelf(editor)}
                    value={form.roleId}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        roleId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose a role</option>
                    {roles
                      .filter((item) => item.active || item._id === form.roleId)
                      .map((item) => (
                        <option
                          key={item._id}
                          value={item._id}
                          disabled={!item.active}
                        >
                          {item.label}
                          {!item.active ? " (inactive)" : ""}
                        </option>
                      ))}
                  </select>
                  <FieldError
                    id={validation.errorId("roleId")}
                    error={validation.errors.roleId}
                  />
                  {isSelf(editor) && (
                    <p className="ui-field-hint">
                      Your own access level is protected.
                    </p>
                  )}
                </div>
              </div>
              <PasswordField
                id="person-password"
                name="password"
                error={validation.errors.password}
                label={
                  editor === "new"
                    ? "Temporary password"
                    : "New password (optional)"
                }
                autoComplete="new-password"
                value={form.password}
                maxLength={128}
                hint={
                  editor === "new"
                    ? "Use 8–128 characters. Share this password privately with the account owner."
                    : "Leave blank to keep the current password."
                }
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
              />
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  {...validation.bind("isActive")}
                  checked={form.isActive}
                  disabled={isSelf(editor)}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Account is active
              </label>
              <FieldError
                id={validation.errorId("isActive")}
                error={validation.errors.isActive}
              />
              <div className="editor-footer flex justify-end gap-3 pt-5 mt-2 border-t border-line">
                <button
                  type="button"
                  className="ui-button ui-button-light"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="ui-button ui-button-dark">
                  {busy
                    ? "Saving…"
                    : editor === "new"
                      ? "Create account"
                      : "Save changes"}
                </button>
              </div>
            </fieldset>
          </form>
        </EditorDialog>
      )}
      {remove && (
        <ConfirmDialog
          title="Delete this account?"
          description={`The account “${remove.username}” will be removed. This action can’t be undone.`}
          confirmLabel="Delete account"
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={deletePerson}
        />
      )}
    </AdminLayout>
  );
}
