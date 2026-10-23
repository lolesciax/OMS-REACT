import useMaintenanceEditor from "../../hooks/useMaintenanceEditor";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

const catalogFields = [
  ["categories", "Categories"],
  ["sizes", "Sizes"],
  ["materials", "Materials"],
];

const parseChoices = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export default function CatalogOptionsMaintenance() {
  const editor = useMaintenanceEditor({
    loadPath: "/admin/catalog-options",
    savePath: "/admin/catalog-options",
    prefix: "catalog-options",
    select: (data) =>
      Object.fromEntries(
        catalogFields.map(([key]) => [key, data[key].join("\n")]),
      ),
    serialize: (form) =>
      Object.fromEntries(
        catalogFields.map(([key]) => [key, parseChoices(form[key])]),
      ),
    successMessage: "Product catalog choices saved.",
  });
  const { form, setForm, busy, validation } = editor;
  const choices = form
    ? Object.fromEntries(
        catalogFields.map(([key]) => [key, parseChoices(form[key])]),
      )
    : {};

  const submit = (event) => {
    const errors = {};
    for (const [key, label] of catalogFields) {
      const values = choices[key] || [];
      if (
        values.length < 1 ||
        values.length > 50 ||
        values.some((value) => value.length > 80) ||
        new Set(values.map((value) => value.toLocaleLowerCase())).size !==
          values.length
      ) {
        errors[key] =
          `${label} must contain 1–50 unique values, up to 80 characters each.`;
      }
    }
    editor.save(event, errors);
  };

  return (
    <MaintenancePanel
      title="Product catalog choices"
      description="These choices appear in the product editor. Existing products keep their saved details if a choice is later removed."
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label="Loading product catalog choices" />
      ) : (
        form !== null && (
          <form ref={validation.formRef} noValidate onSubmit={submit}>
            <div className="grid min-w-0 gap-6 xl:grid-cols-3">
              {catalogFields.map(([key, label]) => (
                <div className="ui-field min-w-0" key={key}>
                  <label htmlFor={`catalog-options-${key}`}>
                    {label}{" "}
                    <span className="field-optional">(one per line)</span>
                  </label>
                  <textarea
                    id={`catalog-options-${key}`}
                    {...validation.bind(key)}
                    rows={10}
                    maxLength={5000}
                    disabled={busy}
                    value={form[key]}
                    onChange={(event) => {
                      setForm({ ...form, [key]: event.target.value });
                      validation.clear(key);
                    }}
                  />
                  <FieldError
                    id={validation.errorId(key)}
                    error={validation.errors[key]}
                  />
                  <p className="mt-2 text-small text-muted">
                    {choices[key]?.length || 0}/50 options. Each may be up to 80
                    characters.
                  </p>
                  <div
                    className="mt-3 flex min-h-10 flex-wrap content-start gap-2"
                    aria-label={`${label} preview`}
                  >
                    {choices[key]?.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="max-w-full rounded-full border border-line bg-surface-soft px-3 py-1.5 text-small [overflow-wrap:anywhere]"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={editor.discard}
              label="Save catalog choices"
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
