'use client';

import { useState, useEffect } from 'react';
import type { CrawlHistoryEntry, CrawledItem } from '@/lib/types';
import Tag from './Tag';
import PriceDisplay from './PriceDisplay';

interface CrawlResultViewerProps {
  history: CrawlHistoryEntry[];
  crawlingNow: boolean;
  currentKeyword: string | null;
  currentKeywordIndex: number;
  currentRoundItems: CrawledItem[];
  totalKeywords: number;
}

export default function CrawlResultViewer({
  history,
  crawlingNow,
  currentKeyword,
  currentKeywordIndex,
  currentRoundItems,
  totalKeywords,
}: CrawlResultViewerProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Reset to "live" tab when a new crawl starts
  useEffect(() => {
    if (crawlingNow) {
      setActiveTab(-1); // -1 = live progress tab
    }
  }, [crawlingNow]);

  // Auto-switch to latest completed round when crawl finishes
  useEffect(() => {
    if (!crawlingNow && history.length > 0 && activeTab === -1) {
      setActiveTab(0);
    }
  }, [crawlingNow, history.length, activeTab]);

  const sortedHistory = [...history].sort((a, b) => b.round - a.round);

  // Determine which data to display
  const isLiveView = activeTab === -1 && crawlingNow;
  const displayItems = isLiveView ? currentRoundItems : (sortedHistory[activeTab]?.items || []);
  const displayTime = isLiveView ? '进行中…' : (sortedHistory[activeTab]?.time || '');
  const displayRound = isLiveView ? (history.length > 0 ? history[history.length - 1].round + 1 : 1) : (sortedHistory[activeTab]?.round || 0);

  const newItems = displayItems.filter(i => i.is_new);
  const changedItems = displayItems.filter(i => i.price_change !== null && i.price_change !== 0);
  const stableItems = displayItems.filter(i => !i.is_new && (i.price_change === null || i.price_change === 0));

  // Empty state: no history and not crawling
  if (history.length === 0 && !crawlingNow) {
    return (
      <div className="text-center py-6 text-muted text-sm">
        暂无爬取记录。启动监控后，每轮爬取结果会显示在这里。
      </div>
    );
  }

  return (
    <div>
      {/* Round tabs + live tab */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {/* Live progress tab (only when crawling) */}
        {crawlingNow && (
          <button
            onClick={() => setActiveTab(-1)}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
              activeTab === -1
                ? 'bg-gold text-white font-medium'
                : 'bg-gold/10 text-gold hover:bg-gold/20'
            }`}
          >
            ● 进行中
          </button>
        )}
        {/* Completed round tabs */}
        {sortedHistory.map((entry, idx) => (
          <button
            key={`${entry.time}-${entry.round}`}
            onClick={() => setActiveTab(idx)}
            className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
              idx === activeTab
                ? 'bg-gold text-white font-medium'
                : 'bg-ink/[0.04] text-muted hover:bg-ink/[0.08]'
            }`}
          >
            第{entry.round}轮
          </button>
        ))}
      </div>

      {/* Live progress indicator */}
      {isLiveView && currentKeyword && (
        <div className="mb-3 p-2 rounded bg-gold/[0.04] border border-gold/10 text-sm">
          <span className="text-gold font-medium">正在爬取:</span>{' '}
          <span className="text-ink">{currentKeyword}</span>
          <span className="text-muted ml-2">
            ({currentKeywordIndex + 1}/{totalKeywords} 关键词)
          </span>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 rounded bg-ink/[0.02]">
          <div className="text-lg font-bold text-ink">{displayItems.length}</div>
          <div className="text-xs text-muted">总商品</div>
        </div>
        <div className="text-center p-2 rounded bg-mint/[0.06]">
          <div className="text-lg font-bold text-mint">{newItems.length}</div>
          <div className="text-xs text-muted">新商品</div>
        </div>
        <div className="text-center p-2 rounded bg-gold/[0.06]">
          <div className="text-lg font-bold text-gold">{changedItems.length}</div>
          <div className="text-xs text-muted">价格变动</div>
        </div>
        <div className="text-center p-2 rounded bg-ink/[0.02]">
          <div className="text-lg font-bold text-muted">{stableItems.length}</div>
          <div className="text-xs text-muted">价格稳定</div>
        </div>
      </div>

      <div className="text-xs text-muted mb-2">
        {isLiveView ? `第${displayRound}轮 · ` : ''}爬取时间: {displayTime}
      </div>

      {/* Items list */}
      {displayItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted">商品</th>
                <th className="text-right py-1.5 px-2 font-medium text-muted">价格</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted">关键词</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted">状态</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-ink/[0.02]">
                  <td className="py-1.5 px-2 max-w-[250px] truncate">
                    {item.title.length > 35 ? item.title.substring(0, 35) + '…' : item.title}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <PriceDisplay price={item.price} />
                  </td>
                  <td className="py-1.5 px-2">
                    <Tag variant="keyword">{item.keyword}</Tag>
                  </td>
                  <td className="py-1.5 px-2">
                    {item.is_new ? (
                      <Tag variant="new">新商品</Tag>
                    ) : item.price_change !== null && item.price_change !== 0 ? (
                      <span className={`text-xs font-medium ${
                        item.price_change > 0 ? 'text-signal' : 'text-mint'
                      }`}>
                        {item.price_change > 0 ? '↑' : '↓'}
                        <PriceDisplay price={Math.abs(item.price_change)} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted">稳定</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 text-muted text-sm">
          {isLiveView ? '等待爬取结果…' : '暂无商品数据'}
        </div>
      )}
    </div>
  );
}
