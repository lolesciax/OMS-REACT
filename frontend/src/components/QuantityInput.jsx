import { useState, useEffect } from "react";

export default function QuantityInput({
  value,
  max,
  disabled,
  onChange,
  name,
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const commit = () => {
    const number = Number(draft);
    if (Number.isInteger(number) && number >= 1 && number <= max) {
      if (number !== value) onChange(number);
    } else setDraft(String(value));
  };
  return (
    <div className="quantity-stepper">
      <button
        type="button"
        aria-label={`Decrease quantity of ${name}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        aria-label={`Quantity for ${name}`}
        value={draft}
        min={1}
        max={max}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        aria-label={`Increase quantity of ${name}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
