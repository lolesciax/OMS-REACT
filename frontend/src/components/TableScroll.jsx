export default function TableScroll({ label, children }) {
  return (
    <>
      <p className="hidden border-b border-line bg-paper px-5 py-2 text-small text-muted max-[900px]:block">
        Scroll the table sideways to see all columns and actions.
      </p>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
