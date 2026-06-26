'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCrawlStatus } from './StatusProvider';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘' },
  { href: '/products', label: '商品列表' },
  { href: '/history', label: '价格变动' },
  { href: '/control', label: '控制面板' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const status = useCrawlStatus();

  const isRunning = status && status.running && !status.paused;
  const statusLabel = isRunning ? '运行中' : '暂停';
  const statusColor = isRunning ? 'bg-mint text-white' : 'bg-muted text-white';

  return (
    <header className="sticky top-[3px] z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-12 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-ink no-underline">
            闲鱼价格监控
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium no-underline transition-colors ${
                    isActive
                      ? 'bg-gold/10 text-gold'
                      : 'text-muted hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1 rounded-md text-sm font-medium no-underline whitespace-nowrap ${
                isActive
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
