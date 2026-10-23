import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useMaintenanceEditor from "../../hooks/useMaintenanceEditor";
import { policySections } from "../../utils/help";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

function PolicyEditor({ kind, onDirty }) {
  const section = policySections.find((value) => value.kind === kind);
  const editor = useMaintenanceEditor({
    loadPath: "/policies/" + kind,
    savePath: "/admin/maintenance/policies/" + kind,
    prefix: "policy-" + kind,
    select: (data) => ({ title: data.policy.title, body: data.policy.body }),
    serialize: (form, source) => ({ ...form, version: source.policy._id }),
    successMessage:
      "New version published. Earlier acceptance records keep their original terms.",
  });
  const { form, setForm, busy, validation } = editor;
  useEffect(() => {
    onDirty(kind, editor.dirty);
  }, [kind, editor.dirty, onDirty]);
  const save = (event) =>
    editor.save(event, {
      ...(!form.title.trim() ? { title: "Enter a policy title." } : {}),
      ...(!form.body.trim()
        ? { body: "Enter the information customers need to review." }
        : {}),
    });
  return (
    <MaintenancePanel
      title={section.title}
      description="Publishing creates a new version. Existing accounts and orders keep the version they accepted."
      actions={
        <Link
          className="ui-button ui-button-light"
          to={section.path}
          target="_blank"
          rel="noopener noreferrer"
        >
          View published page ↗
        </Link>
      }
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label={"Loading " + section.title} />
      ) : (
        form && (
          <form
            ref={validation.formRef}
            onSubmit={save}
            noValidate
            onChange={(event) => validation.clear(event.target.name)}
          >
            <p className="mb-5 text-small text-muted">
              Last published{" "}
              {new Date(editor.source.policy.publishedAt).toLocaleDateString(
                "en-PH",
                { year: "numeric", month: "short", day: "numeric" },
              )}
            </p>
            <fieldset disabled={busy} className="min-w-0 border-0">
              <div className="ui-field mb-5">
                <label htmlFor={"policy-" + kind + "-title"}>
                  Policy title
                </label>
                <input
                  id={"policy-" + kind + "-title"}
                  {...validation.bind("title")}
                  maxLength={150}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
                <FieldError
                  id={validation.errorId("title")}
                  error={validation.errors.title}
                />
              </div>
              <div className="ui-field">
                <label htmlFor={"policy-" + kind + "-body"}>
                  Policy content
                </label>
                <textarea
                  id={"policy-" + kind + "-body"}
                  {...validation.bind("body")}
                  rows={12}
                  maxLength={20000}
                  value={form.body}
                  onChange={(event) =>
                    setForm({ ...form, body: event.target.value })
                  }
                />
                <FieldError
                  id={validation.errorId("body")}
                  error={validation.errors.body}
                />
                <p className="mt-2 text-small text-muted">
                  {form.body.length.toLocaleString()}/20,000 characters. Plain
                  text; blank lines separate paragraphs.
                </p>
              </div>
            </fieldset>
            <details className="mt-6 rounded-xl border border-line bg-surface-soft px-5">
              <summary className="cursor-pointer py-4 text-body font-semibold text-primary">
                Preview draft
              </summary>
              <div className="pb-5">
                <h3 className="mb-4 text-lead font-semibold">{form.title}</h3>
                <p className="whitespace-pre-wrap text-body leading-relaxed [overflow-wrap:anywhere]">
                  {form.body}
                </p>
              </div>
            </details>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={editor.discard}
              label="Publish new version"
              busyLabel="Publishing…"
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
export default function PolicyMaintenance() {
  const [selected, setSelected] = useState("account");
  const [visited, setVisited] = useState(["account"]);
  const [dirty, setDirty] = useState({});
  const onDirty = useCallback(
    (kind, value) =>
      setDirty((previous) =>
        previous[kind] === value ? previous : { ...previous, [kind]: value },
      ),
    [],
  );
  return (
    <div className="min-w-0 space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label="Policy editors">
        {policySections.map((section) => (
          <button
            type="button"
            key={section.kind}
            aria-pressed={selected === section.kind}
            className={
              "ui-button " +
              (selected === section.kind ? "ui-button-dark" : "ui-button-light")
            }
            onClick={() => {
              setSelected(section.kind);
              setVisited((previous) =>
                previous.includes(section.kind)
                  ? previous
                  : [...previous, section.kind],
              );
            }}
          >
            {section.title}
            {dirty[section.kind] && (
              <span
                aria-label="Unsaved changes"
                className="size-2 rounded-full bg-[#bf8d4c]"
              />
            )}
          </button>
        ))}
      </nav>
      {visited.map((kind) => (
        <div key={kind} hidden={selected !== kind}>
          <PolicyEditor kind={kind} onDirty={onDirty} />
        </div>
      ))}
    </div>
  );
}
