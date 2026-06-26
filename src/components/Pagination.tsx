import Link from 'next/link';

export default function Pagination({
  page,
  totalPages,
  baseUrl,
}: {
  page: number;
  totalPages: number;
  baseUrl: string;
}) {
  if (totalPages <= 1) return null;

  const getPageUrl = (p: number) => {
    const url = new URL(baseUrl, 'http://dummy');
    url.searchParams.set('page', String(p));
    return url.pathname + '?' + url.searchParams.toString();
  };

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-6">
      {page > 1 && (
        <Link
          href={getPageUrl(page - 1)}
          className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:text-ink no-underline"
        >
          ←
        </Link>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted">…</span>
        ) : (
          <Link
            key={p}
            href={getPageUrl(p)}
            className={`px-3 py-1.5 text-sm rounded-md no-underline ${
              p === page
                ? 'bg-gold text-white font-medium'
                : 'border border-border text-muted hover:text-ink'
            }`}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages && (
        <Link
          href={getPageUrl(page + 1)}
          className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:text-ink no-underline"
        >
          →
        </Link>
      )}
    </nav>
  );
}
