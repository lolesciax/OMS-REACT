import { useState } from "react";
import Icon from "./Icon";
import FieldTooltip from "./FieldTooltip";

export default function PasswordField({
  id,
  label = "Password",
  error,
  hint,
  tooltip = false,
  compact = false,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const descriptionId = tooltip
    ? `${id}-feedback`
    : error
      ? `${id}-error`
      : hint
        ? `${id}-hint`
        : undefined;
  return (
    <div className={`ui-field min-w-0 ${compact ? "" : "mb-5"}`}>
      {tooltip ? (
        <FieldTooltip
          id={descriptionId}
          htmlFor={id}
          label={label}
          message={error || hint || "Re-enter the same password."}
          invalid={!!error}
          active={focused && !!error}
        />
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <div className="ui-password relative">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={descriptionId}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          <Icon name="eye" size={18} />
          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
      {!tooltip &&
        (error ? (
          <p id={`${id}-error`} className="ui-field-error">
            {error}
          </p>
        ) : (
          hint && (
            <p id={`${id}-hint`} className="ui-field-hint">
              {hint}
            </p>
          )
        ))}
    </div>
  );
}
