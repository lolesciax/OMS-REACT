import Icon from "./Icon";

export default function LikeButton({
  name,
  liked,
  pending,
  disabled,
  onClick,
  compact = false,
}) {
  return (
    <button
      type="button"
      className={`product-like-button ${compact ? "is-compact" : ""}`}
      aria-label={`${liked ? "Unlike" : "Like"} ${name}`}
      aria-pressed={liked}
      aria-busy={pending}
      disabled={disabled || pending}
      onClick={onClick}
    >
      <Icon name="heart" size={21} fill={liked ? "currentColor" : "none"} />
      {!compact && (
        <span>{pending ? "Saving…" : liked ? "Liked" : "Like this item"}</span>
      )}
    </button>
  );
}
