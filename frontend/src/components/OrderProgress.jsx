import Icon from "./Icon";
import { progressState, progressSteps } from "../utils/orderProgress";

function ProgressSteps({ steps, current, complete = false, label }) {
  return (
    <ol
      className={`grid grid-cols-1 gap-3 p-0 list-none sm:grid-cols-3 ${steps.length === 6 ? "xl:grid-cols-6" : ""}`}
      aria-label={label}
    >
      {steps.map((step, index) => {
        const done = current >= 0 && (complete || index < current);
        const active = !complete && index === current;
        const date = step.at && new Date(step.at);
        return (
          <li
            key={step.label}
            className={`min-w-0 rounded-xl border p-3 ${active ? "border-primary bg-sage ring-1 ring-primary" : done ? "border-line bg-surface-soft" : "border-line bg-white"}`}
            aria-current={active ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-small font-bold ${done || active ? "bg-primary text-white" : "bg-[#eeeee5] text-muted"}`}
              >
                {done ? <Icon name="check" size={15} /> : index + 1}
              </span>
              <span className="text-body font-semibold text-ink break-words">
                {step.label}
              </span>
            </div>
            <p
              className={`mt-2 text-small ${active ? "font-semibold text-primary" : "text-muted"}`}
            >
              {date && Number.isFinite(date.getTime()) ? (
                <time dateTime={step.at}>
                  {date.toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              ) : done ? (
                "Completed"
              ) : active ? (
                "Current step"
              ) : (
                "Upcoming"
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderProgress({
  order,
  compact = false,
  open = false,
}) {
  const state = progressState(order);
  const content = (
    <div className="py-4">
      <p className="mb-4 text-body leading-relaxed text-muted">
        {state.detail}
      </p>
      <p className="mb-4 text-small font-semibold text-primary">
        {order.status === "completed"
          ? "Order complete"
          : state.current >= 0
            ? `Step ${state.current + 1} of 6 · ${progressSteps(order)[state.current].label}`
            : "Progress is temporarily unavailable"}
      </p>
      <ProgressSteps
        steps={progressSteps(order)}
        current={state.current}
        complete={order.status === "completed"}
        label="Order progress"
      />
    </div>
  );
  return compact ? (
    <details
      className="group mb-6 rounded-xl border border-line px-4"
      open={open || undefined}
    >
      <summary className="cursor-pointer py-4 text-body font-semibold text-primary">
        {state.title}
        <span className="ml-2 text-small font-normal text-muted group-open:hidden">
          View progress
        </span>
        <span className="ml-2 text-small font-normal text-muted hidden group-open:inline">
          Hide progress
        </span>
      </summary>
      {content}
    </details>
  ) : (
    <section className="mb-6 rounded-2xl border border-line bg-white px-5 pt-5">
      <h2 className="text-lead font-semibold">{state.title}</h2>
      {content}
    </section>
  );
}

export function CheckoutProgress({ step }) {
  const current = step === "review" ? 0 : step === "payment" ? 1 : 2;
  return (
    <div className="mb-7">
      <ProgressSteps
        steps={[
          { label: "Review & delivery" },
          { label: "Payment & proof" },
          { label: "Awaiting store review" },
        ]}
        current={current}
        label="Checkout progress"
      />
    </div>
  );
}
