export default function FieldError({ id, error }) {
  return error ? (
    <p id={id} className="ui-field-error">
      {error}
    </p>
  ) : null;
}
