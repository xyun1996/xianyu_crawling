import Link from 'next/link';

export default function EmptyState({
  message,
  description,
  actionLabel,
  actionHref,
}: {
  message: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-bold text-ink mb-2">{message}</p>
      {description && <p className="text-sm text-muted mb-4">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="px-4 py-2 bg-gold text-white rounded-md text-sm font-medium no-underline hover:bg-gold-dim transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
