import { useState } from "react";
import Icon from "./Icon";

export default function PasswordField({
  id,
  label = "Password",
  error,
  hint,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <div className="ui-password">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
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
      {error ? (
        <p id={`${id}-error`} className="ui-field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="ui-field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
