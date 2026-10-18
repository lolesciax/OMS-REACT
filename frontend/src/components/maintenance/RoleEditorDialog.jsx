import EditorDialog from "../EditorDialog";
import FieldError from "../FieldError";

export default function RoleEditorDialog({
  editor,
  form,
  setForm,
  validation,
  permissions,
  busy,
  error,
  onClose,
  onSubmit,
  dirty,
}) {
  return (
    <EditorDialog
      title={editor === "new" ? "Create account role" : "Edit account role"}
      busy={busy}
      onClose={onClose}
    >
      <form
        ref={validation.formRef}
        onSubmit={onSubmit}
        noValidate
        onChange={(event) => validation.clear(event.target.name)}
      >
        {error && (
          <div className="ui-message error mb-4" role="alert">
            {error}
          </div>
        )}
        <div className="ui-field mb-5">
          <label htmlFor="role-label">Role name</label>
          <input
            id="role-label"
            {...validation.bind("label")}
            value={form.label}
            maxLength={80}
            disabled={busy}
            onChange={(event) =>
              setForm({ ...form, label: event.target.value })
            }
          />
          <FieldError
            id={validation.errorId("label")}
            error={validation.errors.label}
          />
        </div>
        <div className="ui-field mb-5">
          <label htmlFor="role-code">Role code</label>
          <input
            id="role-code"
            {...validation.bind("code")}
            value={form.code}
            maxLength={40}
            disabled={busy || editor !== "new"}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
          <FieldError
            id={validation.errorId("code")}
            error={validation.errors.code}
          />
          <p className="ui-field-hint">
            A permanent identifier, such as store_staff.
          </p>
        </div>
        <fieldset className="mb-5" disabled={busy || form.system}>
          <legend className="font-semibold mb-3">Store permissions</legend>
          {Object.entries(permissions).map(([key, label]) => (
            <label className="admin-checkbox" key={key}>
              <input
                type="checkbox"
                {...validation.bind("permissions")}
                checked={form.permissions.includes(key)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    permissions: event.target.checked
                      ? [...form.permissions, key]
                      : form.permissions.filter((value) => value !== key),
                  })
                }
              />
              {label}
            </label>
          ))}
          <FieldError
            id={validation.errorId("permissions")}
            error={validation.errors.permissions}
          />
        </fieldset>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={form.active}
            disabled={busy || form.system}
            onChange={(event) =>
              setForm({ ...form, active: event.target.checked })
            }
          />
          Role is active
        </label>
        <p className="admin-help my-4">
          Inactive roles cannot be assigned and lose store management access.
          Built-in role access is protected.
        </p>
        <div className="editor-footer">
          <button
            type="button"
            className="ui-button ui-button-light"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="ui-button ui-button-dark"
            disabled={busy || !dirty}
          >
            {busy ? "Saving…" : "Save role"}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
