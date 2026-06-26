'use client';

import { useCrawlStatus } from './StatusProvider';

export default function AppSidebar() {
  const status = useCrawlStatus();

  const nextCrawlShort = status?.next_crawl_time
    ? status.next_crawl_time.split(' ')[1]?.substring(0, 5)
    : '--';

  return (
    <aside className="hidden lg:block w-[210px] shrink-0 border-r border-border bg-card p-4 text-sm">
      <div className="space-y-4">
        {/* Crawl Status */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">爬取状态</div>
          <div className="font-medium">
            {status ? (
              status.running && !status.paused ? (
                <span className="text-mint">运行中</span>
              ) : (
                <span className="text-muted">已暂停</span>
              )
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>

        {/* Queue */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">关键词队列</div>
          <div className="font-medium">{status ? `${status.keywords.length} 个` : '—'}</div>
        </div>

        {/* Next Crawl */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">下次爬取</div>
          <div className="font-medium">{nextCrawlShort}</div>
        </div>

        {/* Interval */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">爬取间隔</div>
          <div className="font-medium">{status ? `${status.interval} 分钟` : '—'}</div>
        </div>

        {/* Cookies */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">登录状态</div>
          <div className="font-medium">
            {status ? (
              status.has_cookies ? (
                <span className="text-mint">已登录</span>
              ) : (
                <span className="text-signal">未登录</span>
              )
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>

        {/* Completed Rounds */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">已完成轮次</div>
          <div className="font-medium">
            {status ? (
              status.max_rounds != null
                ? `${status.completed_rounds}/${status.max_rounds}`
                : status.completed_rounds
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
