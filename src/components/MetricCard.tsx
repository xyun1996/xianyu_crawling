export default function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon?: string;
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {icon && <span className="text-xl mb-1 block">{icon}</span>}
      <div className="text-xs text-muted uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-2xl font-bold text-ink">{value}</div>
      {note && <div className="text-xs text-muted mt-1">{note}</div>}
    </div>
  );
}
