import { toast } from "../services/feedback";
import Image from "./Image";
import { useEffect, useId, useState, useRef } from "react";
import Icon from "./Icon";
import FieldError from "./FieldError";
import { validateImageFile, rules } from "../utils/adminValidation";

export default function UploadField({
  file,
  onChange,
  onError,
  disabled = false,
  label = "Upload an image",
  previewAlt = "Selected image preview",
  name = "image",
  error = "",
  resetKey,
}) {
  const id = useId();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (resetKey === undefined) return;
    inputRef.current?.setCustomValidity("");
    if (inputRef.current) inputRef.current.value = "";
    setFileError("");
  }, [resetKey]);
  const clearSelection = () => {
    inputRef.current?.setCustomValidity("");
    setFileError("");
    onError("");
    onChange(null);
    toast.info("Image selection cleared. Save your changes to keep edits.");
  };
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const select = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const failure = validateImageFile(selected);
    event.target.setCustomValidity(failure);
    setFileError(failure);
    if (failure) {
      onError(failure);
      return;
    }
    onError("");
    onChange(selected);
    toast.info("Image selected. Save the form to upload it.");
  };
  return (
    <div className="upload-field">
      <label htmlFor={id}>{label}</label>
      {preview && <Image src={preview} alt={previewAlt} />}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={select}
        disabled={disabled}
        aria-invalid={!!(error || fileError)}
        aria-describedby={`${id}-hint${error || fileError ? ` ${id}-error` : ""}`}
      />
      <p id={`${id}-hint`}>
        JPG, PNG, GIF, or WebP · Up to {rules.image.maxBytes / 1024 / 1024} MB
        and {rules.image.maxPixels / 1_000_000} megapixels
      </p>
      <FieldError id={`${id}-error`} error={error || fileError} />
      {!file && fileError && (
        <button
          type="button"
          className="ui-button ui-button-light"
          disabled={disabled}
          onClick={clearSelection}
        >
          Clear selection
        </button>
      )}
      {file && (
        <div className="upload-file-name">
          <Icon name="check" size={15} />
          <span>{file.name}</span>
          <button type="button" disabled={disabled} onClick={clearSelection}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
