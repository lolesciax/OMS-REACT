import Image from "./Image";
import { useEffect, useId, useState } from "react";
import Icon from "./Icon";

export default function UploadField({
  file,
  onChange,
  onError,
  disabled = false,
  label = "Upload an image",
}) {
  const id = useId();
  const [preview, setPreview] = useState("");
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
    if (
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        selected.type,
      )
    ) {
      onError("Choose a JPG, PNG, GIF, or WebP image.");
      return;
    }
    if (!selected.size || selected.size > 5 * 1024 * 1024) {
      onError("Choose an image smaller than 5 MB.");
      return;
    }
    onError("");
    onChange(selected);
  };
  return (
    <div className="upload-field">
      <label htmlFor={id}>{label}</label>
      {preview && <Image src={preview} alt="Selected proof preview" />}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={select}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`}>JPG, PNG, GIF, or WebP · Up to 5 MB</p>
      {file && (
        <div className="upload-file-name">
          <Icon name="check" size={15} />
          <span>{file.name}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
