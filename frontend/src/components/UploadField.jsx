import { toast } from "../services/feedback";
import ProductPhoto from "./ProductPhoto";
import { useEffect, useId, useState, useRef } from "react";
import Icon from "./Icon";
import FieldError from "./FieldError";
import { validateImageFile, rules } from "../utils/adminValidation";
import { inspectImageFile } from "../utils/imageUpload";
import "../styles/image-upload.css";

export default function UploadField({
  file,
  onChange,
  onError = () => {},
  disabled = false,
  label = "Upload an image",
  previewAlt = "Selected image preview",
  name = "image",
  error = "",
  resetKey,
  currentSrc = "",
  description = "Choose a clear image. You can review it before submitting.",
}) {
  const id = useId();
  const inputRef = useRef(null);
  const revision = useRef(0);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [checking, setChecking] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    revision.current += 1;
    inputRef.current?.setCustomValidity("");
    if (inputRef.current) inputRef.current.value = "";
    setFileError("");
    setChecking(false);
    return () => {
      revision.current += 1;
    };
  }, [resetKey]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const clearSelection = () => {
    revision.current += 1;
    inputRef.current?.setCustomValidity("");
    setChecking(false);
    setFileError("");
    onError("");
    onChange(null);
    toast.info(
      currentSrc
        ? "Replacement removed. Your saved image is unchanged."
        : "Image selection cleared.",
    );
  };
  const select = async (files) => {
    if (disabled || !files?.length) return;
    const request = ++revision.current;
    const selected = files[0];
    let failure =
      files.length > 1
        ? "Choose one image at a time."
        : validateImageFile(selected);
    setDragging(false);
    if (!failure) {
      setChecking(true);
      inputRef.current?.setCustomValidity(
        "Please wait while the image is checked.",
      );
      failure = await inspectImageFile(selected, rules.image.maxPixels);
    }
    if (request !== revision.current) return;
    setChecking(false);
    inputRef.current?.setCustomValidity(failure);
    setFileError(failure);
    onError(failure);
    if (failure) return;
    onChange(selected);
    toast.info(
      "Image selected. Review the preview, then submit the form to upload it.",
    );
  };
  const visibleError = error || fileError;
  const source = file ? preview : currentSrc;
  return (
    <div className="image-upload" data-dragging={dragging} aria-busy={checking}>
      <div className="image-upload-heading">
        <label htmlFor={id}>{label}</label>
        {(file || currentSrc) && (
          <span className="image-upload-status">
            {file ? "Not uploaded yet" : "Saved image"}
          </span>
        )}
      </div>
      <p id={`${id}-description`} className="image-upload-description">
        {description}
      </p>
      {source && (
        <ProductPhoto
          className="image-upload-preview"
          src={source}
          name={file ? previewAlt : label}
          caption="Review the complete image before submitting. Zoom in to check that details are readable."
        />
      )}
      <div
        className="image-upload-dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && event.dataTransfer.types.includes("Files"))
            setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void select(event.dataTransfer.files);
        }}
      >
        <span className="image-upload-icon">
          <Icon name="photo" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <strong>
            {checking
              ? "Checking your image…"
              : source
                ? "Choose a replacement"
                : "Add your image"}
          </strong>
          <p>Choose a file or drop one here.</p>
        </div>
        <button
          type="button"
          className="ui-button ui-button-light"
          disabled={disabled || checking}
          onClick={() => inputRef.current?.click()}
        >
          {source ? "Change image" : "Choose image"}
        </button>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          className="image-upload-input"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => {
            const files = [...event.target.files];
            event.target.value = "";
            void select(files);
          }}
          disabled={disabled}
          aria-invalid={!!visibleError}
          aria-describedby={`${id}-description ${id}-hint${visibleError ? ` ${id}-error` : ""}`}
        />
      </div>
      <p id={`${id}-hint`} className="image-upload-hint">
        JPG, PNG, GIF or WebP. Up to {rules.image.maxBytes / 1024 / 1024} MB and{" "}
        {rules.image.maxPixels / 1_000_000} megapixels. Images keep their
        original proportions.
      </p>
      <FieldError id={`${id}-error`} error={visibleError} />
      <div role="status" className="image-upload-file">
        {checking ? (
          <span>Checking that the image can be opened…</span>
        ) : file ? (
          <>
            <Icon name="check" size={18} />
            <span>
              <strong>{file.name}</strong>
              <small>
                {(file.size / 1024 / 1024).toFixed(2)} MB · Ready to submit
              </small>
            </span>
          </>
        ) : null}
        {(file || fileError) && (
          <button
            type="button"
            className="ui-button ui-button-light"
            disabled={disabled}
            onClick={clearSelection}
          >
            {file ? "Remove selection" : "Clear error"}
          </button>
        )}
      </div>
    </div>
  );
}
