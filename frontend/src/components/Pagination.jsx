export default function Pagination({ count, page, onChange, size = 10 }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="admin-pagination">
      <span>
        {count
          ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} of ${count}`
          : "0 results"}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
