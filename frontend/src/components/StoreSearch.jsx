import { useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";

export default function StoreSearch({ value, onChange, onSubmit }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(
    new URLSearchParams(search).get("q") || "",
  );
  const input = useRef(null);
  const id = useId();
  const current = value ?? draft;
  const change = onChange ?? setDraft;
  return (
    <form
      role="search"
      aria-label="Search products"
      className="col-span-full row-start-2 mt-3 flex min-w-0 items-center gap-1 rounded-xl border border-line bg-white pl-3 text-primary transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 min-[1280px]:col-span-1 min-[1280px]:col-start-2 min-[1280px]:row-start-1 min-[1280px]:mt-0"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
        if (pathname === "/") {
          document.getElementById("collection")?.scrollIntoView();
        } else {
          const query = new URLSearchParams();
          if (current.trim()) query.set("q", current.trim());
          navigate({
            pathname: "/",
            search: query.toString(),
            hash: "#collection",
          });
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search the collection
      </label>
      <input
        ref={input}
        id={id}
        name="q"
        type="search"
        value={current}
        maxLength={200}
        onChange={(event) => change(event.target.value)}
        placeholder="Search styles, brands, sizes…"
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-11 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent py-2 text-body text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {current && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            change("");
            input.current?.focus();
          }}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-primary-soft hover:text-primary"
        >
          <Icon name="close" size={17} />
        </button>
      )}
      <button
        type="submit"
        aria-label="Search products"
        className="m-1 grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-white transition-colors hover:bg-ink"
      >
        <Icon name="search" size={19} />
      </button>
    </form>
  );
}
