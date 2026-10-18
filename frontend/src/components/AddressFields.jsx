import { philippineLocations } from "../utils/locations";

export default function AddressFields({
  value,
  onChange,
  errors = {},
  disabled = false,
  prefix = "delivery",
}) {
  const labels = {
    recipient: "Recipient name",
    contact: "Mobile number",
    street: "House number, building & street",
    barangay: "Barangay",
    city: "City or municipality",
    province: "Province",
  };
  const autocomplete = {
    recipient: "name",
    contact: "tel",
    street: "address-line1",
    barangay: "address-line2",
    city: "address-level2",
    province: "address-level1",
  };
  const provinces =
    philippineLocations.provinces.includes(value.province) || !value.province
      ? philippineLocations.provinces
      : [value.province, ...philippineLocations.provinces];
  return (
    <div className="address-fields">
      {Object.entries(labels).map(([key, label]) => (
        <div
          className={`ui-field mb-5 ${key === "street" ? "field-full" : ""}`}
          key={key}
        >
          <label htmlFor={`${prefix}-${key}`}>{label}</label>
          {key === "province" ? (
            <select
              id={`${prefix}-${key}`}
              value={value[key] || ""}
              disabled={disabled}
              onChange={(event) => onChange(key, event.target.value)}
              autoComplete={autocomplete[key]}
              aria-invalid={!!errors[key]}
              aria-describedby={
                errors[key] ? `${prefix}-${key}-error` : undefined
              }
            >
              <option value="">Select your province</option>
              {provinces.map((province) => (
                <option key={province}>{province}</option>
              ))}
            </select>
          ) : (
            <input
              id={`${prefix}-${key}`}
              type={key === "contact" ? "tel" : "text"}
              autoComplete={autocomplete[key]}
              value={value[key] || ""}
              disabled={disabled}
              maxLength={key === "contact" ? 16 : 200}
              onChange={(event) => onChange(key, event.target.value)}
              aria-invalid={!!errors[key]}
              aria-describedby={
                errors[key] ? `${prefix}-${key}-error` : undefined
              }
              list={key === "city" ? `${prefix}-cities` : undefined}
              placeholder={key === "contact" ? "09XX XXX XXXX" : undefined}
            />
          )}
          {errors[key] && (
            <p className="ui-field-error" id={`${prefix}-${key}-error`}>
              {errors[key]}
            </p>
          )}
        </div>
      ))}
      <datalist id={`${prefix}-cities`}>
        {(philippineLocations.cities[value.province] || []).map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </div>
  );
}
