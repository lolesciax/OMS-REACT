import useContentEditor from "../../hooks/useContentEditor";
import { validateEmail } from "../../utils/validation";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

const fields = [
  ["email", "Store email", "email", 254],
  ["phone", "Store mobile number", "tel", 30],
  ["hours", "Support hours", "text", 150],
  ["location", "Store location", "text", 200],
  ["message", "Contact instructions", "textarea", 2000],
];
export default function SupportMaintenance() {
  const editor = useContentEditor("support");
  const { form, setForm, busy, validation } = editor;
  const submit = (event) => {
    const errors = {};
    fields.forEach(([field, label]) => {
      if (!form[field].trim())
        errors[field] = "Enter " + label.toLowerCase() + ".";
    });
    if (validateEmail(form.email)) errors.email = validateEmail(form.email);
    if (!/^(09\d{9}|\+?639\d{9})$/.test(form.phone.replace(/[\s()-]/g, "")))
      errors.phone = "Enter a valid Philippine mobile number.";
    editor.save(event, errors);
  };
  return (
    <MaintenancePanel
      title="Store contact information"
      description="These details appear on Contact us and in the footer. Use contact information the store actively monitors."
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label="Loading contact information" />
      ) : (
        form && (
          <form ref={validation.formRef} onSubmit={submit} noValidate>
            <fieldset
              disabled={busy}
              className="grid min-w-0 gap-5 border-0 sm:grid-cols-2"
            >
              {fields.map(([field, label, type, maxLength]) => (
                <div
                  key={field}
                  className={
                    "ui-field min-w-0 " +
                    (field === "message" ? "sm:col-span-2" : "")
                  }
                >
                  <label htmlFor={"support-" + field}>{label}</label>
                  {type === "textarea" ? (
                    <textarea
                      id={"support-" + field}
                      {...validation.bind(field)}
                      rows={4}
                      maxLength={maxLength}
                      value={form[field]}
                      onChange={(event) => {
                        setForm({ ...form, [field]: event.target.value });
                        validation.clear(field);
                      }}
                    />
                  ) : (
                    <input
                      id={"support-" + field}
                      {...validation.bind(field)}
                      type={type}
                      maxLength={maxLength}
                      value={form[field]}
                      onChange={(event) => {
                        setForm({ ...form, [field]: event.target.value });
                        validation.clear(field);
                      }}
                    />
                  )}
                  <FieldError
                    id={validation.errorId(field)}
                    error={validation.errors[field]}
                  />
                </div>
              ))}
            </fieldset>
            <details className="mt-6 rounded-xl border border-line bg-[#f7f8f3] px-5">
              <summary className="cursor-pointer py-4 text-body font-semibold text-forest">
                Preview contact details
              </summary>
              <div className="space-y-3 pb-5 text-body [overflow-wrap:anywhere]">
                <p className="font-semibold">{form.email}</p>
                <p>{form.phone}</p>
                <p className="text-muted">
                  {form.hours} · {form.location}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {form.message}
                </p>
              </div>
            </details>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={editor.discard}
              label="Publish contact details"
              busyLabel="Publishing…"
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
