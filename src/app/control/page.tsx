'use client';

import { useCrawlStatus, useRefreshStatus } from '@/components/StatusProvider';
import PanelCard from '@/components/PanelCard';
import ControlActions from '@/components/ControlActions';
import KeywordManager from '@/components/KeywordManager';
import CrawlResultViewer from '@/components/CrawlResultViewer';
import type { KeywordEntry } from '@/lib/types';

export default function ControlPage() {
  const status = useCrawlStatus();
  const refresh = useRefreshStatus();

  const handleKeywordsUpdate = async (keywords: KeywordEntry[]) => {
    const res = await fetch('/api/crawl/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '更新关键词失败');
    }
    refresh();
  };

  const handleKeywordsSelect = async (selected: KeywordEntry[]) => {
    const res = await fetch('/api/crawl/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_keywords: selected }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '更新选中关键词失败');
    }
    refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">控制面板</h1>
        <p className="text-sm text-muted">启动/暂停监控、管理关键词、查看爬取结果</p>
      </div>

      {/* Control + Keywords side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PanelCard title="监控控制">
          <ControlActions />
        </PanelCard>

        <PanelCard
          title="关键词管理"
          badge={status ? `${status.selected_keywords.length}/${status.keywords.length} 已选` : ''}
        >
          {status ? (
            <KeywordManager
              keywords={status.keywords}
              selectedKeywords={status.selected_keywords}
              onUpdate={handleKeywordsUpdate}
              onSelect={handleKeywordsSelect}
            />
          ) : (
            <div className="text-center py-4 text-muted text-sm">加载中…</div>
          )}
        </PanelCard>
      </div>

      {/* Crawl Result Viewer */}
      <PanelCard title="爬取记录" className="mb-4">
        {status ? (
          <CrawlResultViewer
            history={status.crawl_history}
            crawlingNow={status.crawling_now}
            currentKeyword={status.current_keyword}
            currentKeywordIndex={status.current_keyword_index}
            currentRoundItems={status.current_round_items}
            totalKeywords={status.active_crawl_keyword_count || status.keywords.length}
          />
        ) : (
          <div className="text-center py-4 text-muted text-sm">加载中…</div>
        )}
      </PanelCard>
    </div>
  );
}
