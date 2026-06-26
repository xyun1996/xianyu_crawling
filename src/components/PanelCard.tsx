export default function PanelCard({
  title,
  badge,
  children,
  className = '',
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="font-semibold text-sm text-ink">{title}</span>
        {badge && <span className="text-xs text-muted">{badge}</span>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </article>
  );
}
