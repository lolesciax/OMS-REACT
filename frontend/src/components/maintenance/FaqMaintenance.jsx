import { toast } from "../../services/feedback";
import { useState } from "react";
import useContentEditor from "../../hooks/useContentEditor";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

export default function FaqMaintenance() {
  const editor = useContentEditor("faqs");
  const { form, setForm, busy, validation } = editor;
  const [expanded, setExpanded] = useState([]);
  const change = (index, field, value) => {
    setForm((items) =>
      items.map((item, current) =>
        current === index ? { ...item, [field]: value } : item,
      ),
    );
    validation.clear(field + "-" + index);
  };
  const move = (index, direction) => {
    setForm((items) => {
      const next = [...items];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
    validation.reset();
    toast.info("Question reordered in your draft. Publish to update the store.");
  };
  const submit = (event) => {
    const errors = {},
      invalid = [];
    form.forEach((item, index) => {
      if (!item.question.trim())
        errors["question-" + index] = "Enter a question.";
      if (!item.answer.trim()) errors["answer-" + index] = "Enter an answer.";
      if (!item.question.trim() || !item.answer.trim()) invalid.push(item.id);
    });
    if (invalid.length)
      setExpanded((previous) => [...new Set([...previous, ...invalid])]);
    editor.save(event, errors);
  };
  const add = () => {
    toast.info("Question added to your draft. Complete it before publishing.");
    const id = crypto.randomUUID();
    setForm((items) => [...items, { id, question: "", answer: "" }]);
    setExpanded((previous) => [...previous, id]);
    requestAnimationFrame(() =>
      document.getElementById("faq-question-" + id)?.focus(),
    );
  };
  return (
    <MaintenancePanel
      title="Questions & answers"
      description="Open a question to edit its answer. Reorder questions to match what customers ask most often. Changes go live only after publishing."
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label="Loading FAQs" />
      ) : (
        form && (
          <form ref={validation.formRef} onSubmit={submit} noValidate>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-body font-semibold">{form.length} questions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ui-button ui-button-light"
                  disabled={busy}
                  onClick={() =>
                    setExpanded(
                      expanded.length ? [] : form.map((item) => item.id),
                    )
                  }
                >
                  {expanded.length ? "Collapse all" : "Expand all"}
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-light"
                  disabled={busy || form.length >= 50}
                  onClick={add}
                >
                  + Add question
                </button>
              </div>
            </div>
            <FieldError error={validation.errors.items} />
            <fieldset disabled={busy} className="min-w-0 border-0 space-y-3">
              {form.map((item, index) => (
                <details
                  key={item.id}
                  className="rounded-xl border border-line bg-white"
                  open={expanded.includes(item.id)}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setExpanded((previous) =>
                      open
                        ? previous.includes(item.id)
                          ? previous
                          : [...previous, item.id]
                        : previous.filter((value) => value !== item.id),
                    );
                  }}
                >
                  <summary className="cursor-pointer px-5 py-4 text-body font-semibold [overflow-wrap:anywhere]">
                    <span className="mr-2 text-muted">{index + 1}.</span>
                    {item.question.trim() || "New question"}
                    {(validation.errors["question-" + index] ||
                      validation.errors["answer-" + index]) && (
                      <span className="ml-2 text-small text-[#943b2c]">
                        Needs attention
                      </span>
                    )}
                  </summary>
                  <div className="border-t border-line p-4 sm:p-5">
                    <div className="mb-5 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="ui-button ui-button-light"
                        disabled={index === 0}
                        aria-label={"Move question " + (index + 1) + " up"}
                        onClick={() => move(index, -1)}
                      >
                        ↑ Move up
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-light"
                        disabled={index === form.length - 1}
                        aria-label={"Move question " + (index + 1) + " down"}
                        onClick={() => move(index, 1)}
                      >
                        ↓ Move down
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-danger"
                        disabled={form.length === 1}
                        aria-label={"Remove question " + (index + 1)}
                        onClick={() => {
                          setForm((items) =>
                            items.filter((value) => value.id !== item.id),
                          );
                          setExpanded((values) =>
                            values.filter((value) => value !== item.id),
                          );
                          validation.reset();
                          toast.info("Question removed from your draft. Publish to update the store.");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="ui-field mb-5">
                      <label htmlFor={"faq-question-" + item.id}>
                        Question
                      </label>
                      <input
                        id={"faq-question-" + item.id}
                        {...validation.bind("question-" + index)}
                        maxLength={200}
                        value={item.question}
                        onChange={(event) =>
                          change(index, "question", event.target.value)
                        }
                      />
                      <FieldError
                        id={validation.errorId("question-" + index)}
                        error={validation.errors["question-" + index]}
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor={"faq-answer-" + item.id}>Answer</label>
                      <textarea
                        id={"faq-answer-" + item.id}
                        {...validation.bind("answer-" + index)}
                        rows={5}
                        maxLength={5000}
                        value={item.answer}
                        onChange={(event) =>
                          change(index, "answer", event.target.value)
                        }
                      />
                      <FieldError
                        id={validation.errorId("answer-" + index)}
                        error={validation.errors["answer-" + index]}
                      />
                      <p className="mt-2 text-small text-muted">
                        {item.answer.length.toLocaleString()}/5,000 characters
                      </p>
                    </div>
                  </div>
                </details>
              ))}
            </fieldset>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={() => {
                editor.discard();
                setExpanded([]);
              }}
              label="Publish FAQs"
              busyLabel="Publishing…"
              note={form.length + "/50 questions"}
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
