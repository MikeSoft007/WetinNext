import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  engine?: string;
};
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Results pagination">
      <span role="status">
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 results"}
      </span>
      <div>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ←
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </nav>
  );
}
function normalise(value: unknown) {
  return (
    JSON.stringify(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  );
}
function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = next;
  }
  return previous[b.length];
}
export function LocalCollection<T>({
  items,
  label,
  children,
  pageSize = 6,
  searchable = true,
  searchText,
}: {
  items: T[];
  label: string;
  children: (items: T[]) => ReactNode;
  pageSize?: number;
  searchable?: boolean;
  searchText?: (item: T) => unknown;
}) {
  const [query, setQuery] = useState(""),
    [requestedPage, setPage] = useState(1);
  const terms = normalise(query).slice(0, 12);
  const filtered = items.filter((item) => {
    const words = normalise(searchText ? searchText(item) : item);
    return terms.every((term) =>
      words.some(
        (word) =>
          word === term ||
          word.startsWith(term) ||
          (term.length >= 4 &&
            Math.abs(term.length - word.length) <= 1 &&
            distance(term, word) <= 1),
      ),
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    page = Math.min(requestedPage, pages);
  return (
    <div className="collection">
      {searchable && (
        <label className="collection-search">
          <span className="sr-only">Search {label}</span>
          <input
            type="search"
            maxLength={100}
            value={query}
            placeholder={`Search ${label}…`}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
      )}
      {children(filtered.slice((page - 1) * pageSize, page * pageSize))}
      {!filtered.length && items.length > 0 && (
        <p role="status">No results. Try another keyword.</p>
      )}
      <Pagination
        page={page}
        pages={pages}
        total={filtered.length}
        pageSize={pageSize}
        onPage={setPage}
      />
    </div>
  );
}
export function CatalogCollection<T>({
  kind,
  country,
  query = "",
  status = "all",
  admin = false,
  liveOnly = false,
  lowDataOnly = false,
  refreshToken,
  endpoint,
  children,
}: {
  endpoint?: string;
  kind: "resources" | "opportunities";
  country?: string;
  query?: string;
  status?: string;
  admin?: boolean;
  liveOnly?: boolean;
  lowDataOnly?: boolean;
  refreshToken?: unknown;
  children: (items: T[], total: number) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(1),
    [data, setData] = useState<Page<T> | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const scope = JSON.stringify([
    endpoint,
    kind,
    country,
    query,
    status,
    admin,
    liveOnly,
    lowDataOnly,
  ]);
  const [lastScope, setLastScope] = useState(scope);
  // Reset before rendering a changed filter, so there is no request for an old page.
  if (scope !== lastScope) {
    setLastScope(scope);
    setPage(1);
    setData(null);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        kind,
        q: query,
        status,
        page: String(requestedPage),
        page_size: admin ? "10" : "6",
        live_only: String(liveOnly),
        low_data_only: String(lowDataOnly),
      });
      if (country) params.set("country", country);
      api<Page<T>>(`${endpoint || `${admin ? "/admin" : ""}/search`}?${params}`)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((e) => {
          if (active) setError((e as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scope, requestedPage, refreshToken]);
  return (
    <div className="collection" aria-busy={loading}>
      {error ? (
        <p role="alert">Search is temporarily unavailable. {error}</p>
      ) : loading ? (
        <p role="status">Loading results…</p>
      ) : (
        data && (
          <>
            {children(data.items, data.total)}
            {data.total === 0 && (
              <p role="status">No results. Try another keyword or filter.</p>
            )}
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              pageSize={data.page_size}
              onPage={setPage}
            />
          </>
        )
      )}
    </div>
  );
}
