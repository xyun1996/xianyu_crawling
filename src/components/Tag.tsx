export default function Tag({
  variant = 'default',
  children,
  className = '',
  onClick,
  title,
}: {
  variant?: 'default' | 'new' | 'inactive' | 'keyword' | 'category' | 'gold';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const styles: Record<string, string> = {
    default: 'bg-ink/5 text-ink',
    new: 'bg-mint/10 text-mint',
    inactive: 'bg-ink/5 text-muted',
    keyword: 'bg-gold/10 text-gold-dim',
    category: 'bg-ink/8 text-ink-light',
    gold: 'bg-gold/10 text-gold-dim',
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[variant] || styles.default} ${className}`}
      onClick={onClick}
      title={title}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {children}
    </span>
  );
}
