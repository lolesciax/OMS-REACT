import { useRef, useState } from "react";

export default function useFormValidation(prefix) {
  const formRef = useRef(null);
  const [errors, setErrors] = useState({});
  const errorId = (name) => `${prefix}-${name}-error`;
  const focus = (next) =>
    requestAnimationFrame(() => {
      const element = formRef.current?.elements.namedItem(Object.keys(next)[0]);
      // Invalid controls can live in collapsed maintenance editors.
      for (
        let parent = element?.parentElement;
        parent;
        parent = parent.parentElement
      )
        if (parent.tagName === "DETAILS") parent.open = true;
      element?.focus?.();
    });
  const check = (next) => {
    next = { ...next };
    for (const control of formRef.current?.elements || []) {
      if (control.name && control.validity?.customError)
        next[control.name] = control.validationMessage;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      focus(next);
      return false;
    }
    return true;
  };
  return {
    formRef,
    errors,
    errorId,
    check,
    reset: () => setErrors({}),
    reject: (data, namespace = "") => {
      const next = Object.fromEntries(
        Object.entries(data.fields || {}).map(([key, value]) => [
          namespace + key,
          value,
        ]),
      );
      if (Object.keys(next).length) {
        setErrors(next);
        focus(next);
      }
    },
    clear: (name) =>
      setErrors((previous) => {
        const next = { ...previous };
        delete next[name];
        return next;
      }),
    bind: (name) => ({
      name,
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? errorId(name) : undefined,
    }),
  };
}
