import { toast } from "../../services/feedback";
import { useEffect, useState } from "react";
import { apiFetch } from "../../services/http";
import { API_BASE_URL } from "../../services/config";
import useFormValidation from "../../hooks/useFormValidation";
import RoleEditorDialog from "./RoleEditorDialog";
import ConfirmDialog from "../ConfirmDialog";
import { useMaintenanceDraft } from "./MaintenanceWorkspace";
import {
  MaintenancePanel,
  MaintenanceFeedback,
  MaintenanceLoading,
} from "./MaintenanceUI";

import Icon from "../Icon";

const empty = { code: "", label: "", active: true, permissions: [] };

export default function RolesMaintenance() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const validation = useFormValidation("role");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const roleDirty =
    !!editor &&
    JSON.stringify(form) !== JSON.stringify(editor === "new" ? empty : editor);
  useMaintenanceDraft(roleDirty, busy);
  const visible = roles.filter(
    (role) =>
      (filter === "all" || role.active === (filter === "active")) &&
      (role.label + " " + role.code)
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    apiFetch(`${API_BASE_URL}/admin/roles`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.success === false)
          throw new Error(data.error || "Roles could not be loaded.");
        if (!controller.signal.aborted) {
          setRoles(data.roles);
          setPermissions(data.permissions);
          setError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const open = (role) => {
    setEditor(role || "new");
    setForm(role ? { ...role } : { ...empty });
    validation.reset();
    setError("");
  };
  const mutate = async (path, method, body) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/${path}`, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      validation.reject(data);
      throw new Error(data.error || "Changes could not be saved.");
    }
    return data;
  };
  const saveRole = async (event) => {
    event.preventDefault();
    if (busy || !roleDirty) return;
    const errors = {};
    if (!form.label.trim() || form.label.length > 80)
      errors.label = "Enter a role name up to 80 characters.";
    if (editor === "new" && !/^[a-z][a-z0-9_-]{1,39}$/.test(form.code))
      errors.code =
        "Use 2–40 lowercase letters, numbers, hyphens or underscores.";
    if (!validation.check(errors)) return;
    setBusy(true);
    setError("");

    try {
      const data = await mutate(
        `roles${editor === "new" ? "" : `/${editor._id}`}`,
        editor === "new" ? "POST" : "PUT",
        form,
      );
      setRoles(data.roles);
      setEditor(null);
      toast.success(
        "Role saved. Access changes apply to the next API request.",
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteRole = async () => {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const data = await mutate(`roles/${removing._id}`, "DELETE");
      setRoles(data.roles);
      setRemoving(null);
      toast.success("Role removed.");
    } catch (failure) {
      setRemoving(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MaintenancePanel
      title="Roles & store access"
      description="Review assigned accounts and maintain role access. Built-in role permissions and your own administrator access remain protected."
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="font-semibold text-body">
            {roles.length} account roles
          </p>
          <p className="admin-help">
            Create roles, maintain access and review account assignments.
          </p>
        </div>
        <button
          className="ui-button ui-button-dark"
          disabled={loading || busy || (!!error && roles.length === 0)}
          onClick={() => open(null)}
        >
          <Icon name="user" size={18} />
          Add role
        </button>
      </div>
      <MaintenanceFeedback
        error={!editor ? error : ""}

        onRetry={
          !editor && error ? () => setRetry((value) => value + 1) : undefined
        }
        busy={busy}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="ui-field">
          <label htmlFor="maintenance-role-search">Search roles</label>
          <input
            id="maintenance-role-search"
            type="search"
            value={search}
            maxLength={80}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or code"
          />
        </div>
        <div className="ui-field">
          <label htmlFor="maintenance-role-status">Availability</label>
          <select
            id="maintenance-role-status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      {loading ? (
        <MaintenanceLoading label="Loading account roles" />
      ) : (
        <>
          <div className="grid gap-4 min-[1350px]:grid-cols-2">
            {visible.map((role) => (
              <article
                key={role._id}
                className="min-w-0 rounded-xl border border-line bg-[#fafbf7] p-5 [overflow-wrap:anywhere]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-lead">{role.label}</h3>
                  <span className="admin-badge">
                    {role.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-small text-muted mt-2">
                  {role.assignedAccounts} assigned{" "}
                  {role.assignedAccounts === 1 ? "account" : "accounts"} ·{" "}
                  {role.system ? "Built-in role" : role.code}
                </p>
                <p className="text-body mt-3">
                  {role.permissions.includes("admin.access")
                    ? "Can manage the store and its accounts."
                    : "Storefront access only."}
                </p>
                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    className="ui-button ui-button-light"
                    disabled={busy}
                    onClick={() => open(role)}
                  >
                    Edit role
                  </button>
                  {!role.system && (
                    <button
                      className="ui-button ui-button-danger"
                      disabled={busy || role.assignedAccounts > 0}
                      title={
                        role.assignedAccounts
                          ? "Reassign these accounts before removing the role."
                          : undefined
                      }
                      onClick={() => setRemoving(role)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="ui-empty">
              <h3>No matching roles</h3>
              <p>Try a different name or availability filter.</p>
            </div>
          )}
        </>
      )}
      {editor && (
        <RoleEditorDialog
          editor={editor}
          form={form}
          setForm={setForm}
          validation={validation}
          permissions={permissions}
          busy={busy}
          error={error}
          dirty={roleDirty}
          onClose={() => !busy && setEditor(null)}
          onSubmit={saveRole}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.label}?`}
          description="Only unassigned custom roles can be removed."
          confirmLabel="Remove role"
          busy={busy}
          onClose={() => setRemoving(null)}
          onConfirm={deleteRole}
        />
      )}
    </MaintenancePanel>
  );
}
