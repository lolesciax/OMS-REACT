import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import AdminLayout from "./AdminLayout";
import EditorDialog from "./EditorDialog";
import ConfirmDialog from "./ConfirmDialog";
import PasswordField from "./PasswordField";
import Pagination from "./Pagination";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import {
  validateEmail,
  validateUsername,
  validatePassword,
} from "../utils/validation";

const empty = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  isAdmin: false,
  isActive: true,
};
export default function AdminCustomers() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
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
        const response = await apiFetch(`${BACKEND_URL}/api/admin/customers`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(
            data.error || "Accounts couldn’t be loaded. Please try again.",
          );
        setPeople(data.customers || []);
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
  const visible = people.filter(
    (person) =>
      (role === "all" ||
        (role === "admin" ? person.isAdmin : !person.isAdmin)) &&
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
  );
  const open = (person) => {
    setEditor(person || "new");
    setForm(
      person
        ? {
            ...empty,
            ...person,
            password: "",
            isActive: person.isActive !== false,
          }
        : empty,
    );
    setFormError("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    const validation =
      (!form.username.trim()
        ? "Enter a username."
        : editor === "new"
          ? validateUsername(form.username.trim())
          : "") ||
      validateEmail(form.email) ||
      (editor === "new" || form.password
        ? validatePassword(form.password)
        : "");
    if (validation) {
      setFormError(validation);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
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
      if (!response.ok || data.success === false)
        throw new Error(data.error || "The account couldn’t be saved.");
      setEditor(null);
      setMessage(
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
      setMessage("The account has been removed.");
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
              <option value="customer">Customers</option>
              <option value="admin">Administrators</option>
            </select>
          </label>
        </div>
        <div
          className="admin-table-scroll"
          tabIndex={0}
          aria-label="Account table, scroll horizontally on smaller screens"
        >
          <table className="admin-table">
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
                <tr>
                  <td colSpan={5} className="admin-table-empty" role="status">
                    Loading accounts…
                  </td>
                </tr>
              ) : !visible.length ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {search || role !== "all"
                      ? "No accounts match your filters."
                      : "No accounts to display."}
                  </td>
                </tr>
              ) : (
                visible.slice((page - 1) * 10, page * 10).map((person) => (
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
                      <span className="admin-badge">
                        {person.isAdmin ? "Administrator" : "Customer"}
                      </span>
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
                          disabled={isSelf(person)}
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
        </div>
        <Pagination count={visible.length} page={page} onChange={setPage} />
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
          <form onSubmit={save}>
            <fieldset className="ui-fieldset" disabled={busy}>
              <div className="editor-fields">
                {[
                  ["username", "Username", "text"],
                  ["email", "Email address", "email"],
                  ["firstName", "First name", "text"],
                  ["lastName", "Last name", "text"],
                  ["phone", "Mobile number", "tel"],
                ].map(([key, label, type]) => (
                  <div className="ui-field" key={key}>
                    <label htmlFor={`person-${key}`}>{label}</label>
                    <input
                      id={`person-${key}`}
                      type={type}
                      value={form[key]}
                      maxLength={
                        key === "username" ? 16 : key === "phone" ? 16 : 254
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
                    {key === "username" && editor !== "new" && (
                      <p className="ui-field-hint">
                        The username stays the same for this account.
                      </p>
                    )}
                  </div>
                ))}
                <div className="ui-field">
                  <label htmlFor="person-role">Account role</label>
                  <select
                    id="person-role"
                    disabled={isSelf(editor)}
                    value={form.isAdmin ? "admin" : "customer"}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        isAdmin: event.target.value === "admin",
                      }))
                    }
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Administrator</option>
                  </select>
                  {isSelf(editor) && (
                    <p className="ui-field-hint">
                      Your own access level is protected.
                    </p>
                  )}
                </div>
              </div>
              <PasswordField
                id="person-password"
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
              <div className="editor-footer">
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
