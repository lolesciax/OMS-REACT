import useMaintenanceEditor from "../../hooks/useMaintenanceEditor";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

export default function ProfileOptionsMaintenance() {
  const editor = useMaintenanceEditor({
    loadPath: "/admin/account-options",
    savePath: "/admin/account-options",
    prefix: "profile-options",
    select: (data) => data.genders.join("\n"),
    serialize: (form) => ({
      genders: form
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    }),
    successMessage: "Profile choices saved.",
  });
  const { form, setForm, busy, validation } = editor;
  const choices = (form || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const submit = (event) => {
    const failure =
      !choices.length ||
      choices.length > 20 ||
      choices.some((value) => value.length > 30) ||
      new Set(choices.map((value) => value.toLowerCase())).size !==
        choices.length;
    editor.save(
      event,
      failure
        ? { genders: "Enter 1–20 unique choices, up to 30 characters each." }
        : {},
    );
  };
  return (
    <MaintenancePanel
      title="Customer profile choices"
      description="Manage gender choices shown on Account. Leaving the selection blank stays available; historical customer selections are preserved."
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label="Loading profile choices" />
      ) : (
        form !== null && (
          <form ref={validation.formRef} noValidate onSubmit={submit}>
            <div className="grid min-w-0 gap-6 min-[1350px]:grid-cols-2">
              <div className="ui-field">
                <label htmlFor="profile-options-genders">
                  One choice per line
                </label>
                <textarea
                  id="profile-options-genders"
                  {...validation.bind("genders")}
                  rows={8}
                  maxLength={1000}
                  disabled={busy}
                  value={form}
                  onChange={(event) => {
                    setForm(event.target.value);
                    validation.clear("genders");
                  }}
                />
                <FieldError
                  id={validation.errorId("genders")}
                  error={validation.errors.genders}
                />
                <p className="mt-2 text-small text-muted">
                  Up to 20 unique choices. Maximum 30 characters per choice.
                </p>
              </div>
              <aside className="rounded-xl border border-line bg-surface-soft p-5">
                <h3 className="text-body font-semibold">
                  Customer choices preview
                </h3>
                <p className="my-3 text-small text-muted">
                  {choices.length}/20 choices. Order matches the list on the
                  left.
                </p>
                <div className="flex flex-wrap gap-2">
                  {choices.map((value, index) => (
                    <span
                      key={index}
                      className="max-w-full rounded-full border border-line bg-white px-3 py-2 text-small [overflow-wrap:anywhere]"
                    >
                      {value}
                    </span>
                  ))}
                </div>
                {!choices.length && (
                  <p className="text-body text-muted">
                    Add a choice to see it here.
                  </p>
                )}
              </aside>
            </div>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={editor.discard}
              label="Save profile choices"
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
