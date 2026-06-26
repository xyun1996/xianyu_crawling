import { getStats, getLatestProducts, getStatsByCategory, getProductsWithPriceHistory } from '@/lib/db';
import { getCrawlManager } from '@/lib/crawl-manager';
import MetricCard from '@/components/MetricCard';
import PanelCard from '@/components/PanelCard';
import Tag from '@/components/Tag';
import PriceDisplay from '@/components/PriceDisplay';
import Link from 'next/link';
import { initDb } from '@/lib/db';

export default async function DashboardPage() {
  // Ensure DB is initialized
  initDb();

  const stats = getStats();
  const recentProducts = getLatestProducts('', 5);
  const categoryStats = getStatsByCategory();
  const crawlStatus = getCrawlManager().getStatus();
  const productsWithHistory = getProductsWithPriceHistory('', 100);
  const changedCount = productsWithHistory.length;

  const maxCategoryCount = Math.max(1, ...Object.values(categoryStats).map(s => s.count));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">仪表盘</h1>
        <p className="text-sm text-muted">商品规模、分类价格与最近发现概览</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon="▤"
          label="商品总数"
          value={stats.total_products}
          note={`累计 ${stats.total_snapshots} 条价格快照`}
        />
        <MetricCard
          icon="⌁"
          label="价格变动"
          value={changedCount}
          note="已记录两次以上价格"
        />
        <MetricCard
          icon="⚡"
          label="售中商品"
          value={stats.active_products}
          note={`下架 ${stats.total_products - stats.active_products} 件`}
        />
        <MetricCard
          icon="◔"
          label="爬取状态"
          value={
            <span className="text-base font-semibold">
              {crawlStatus.running && !crawlStatus.paused ? '运行中' : '暂停'}
            </span>
          }
          note={`间隔 ${crawlStatus.interval} 分钟`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Trend Chart - static SVG placeholder */}
        <PanelCard title="爬取数据趋势" badge={<Tag variant="new">实时数据</Tag>}>
          <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="w-full h-48" aria-label="数据趋势">
            <line x1="0" y1="40" x2="700" y2="40" className="stroke-border" strokeWidth="1" />
            <line x1="0" y1="90" x2="700" y2="90" className="stroke-border" strokeWidth="1" />
            <line x1="0" y1="140" x2="700" y2="140" className="stroke-border" strokeWidth="1" />
            <line x1="0" y1="190" x2="700" y2="190" className="stroke-border" strokeWidth="1" />
            <path
              d="M0 190 L100 176 L200 158 L300 140 L400 118 L500 86 L600 50 L700 18 L700 220 L0 220 Z"
              className="fill-gold/10"
            />
            <path
              d="M0 190 L100 176 L200 158 L300 140 L400 118 L500 86 L600 50 L700 18"
              className="stroke-gold"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </PanelCard>

        {/* Category Bar Chart */}
        <PanelCard title="分类占比" badge={`${Object.keys(categoryStats).length} 类`}>
          <div className="space-y-2">
            {Object.entries(categoryStats).map(([category, data]) => (
              <div key={category} className="flex items-center gap-3">
                <span className="text-sm text-ink w-16 shrink-0 truncate">
                  {category || '未分类'}
                </span>
                <div className="flex-1 h-5 bg-ink/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-gold/60 rounded"
                    style={{ width: `${(data.count / maxCategoryCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted w-8 text-right">{data.count}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {/* Recent Products */}
      {recentProducts.length > 0 && (
        <PanelCard
          title="最新商品"
          badge={
            <Link href="/products" className="text-gold no-underline hover:underline">
              查看全部 ›
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted">商品</th>
                  <th className="text-right py-2 px-2 font-medium text-muted">价格</th>
                  <th className="text-left py-2 px-2 font-medium text-muted">关键词</th>
                  <th className="text-left py-2 px-2 font-medium text-muted">分类</th>
                  <th className="text-left py-2 px-2 font-medium text-muted">地区</th>
                  <th className="text-left py-2 px-2 font-medium text-muted">时间</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-ink/[0.02]">
                    <td className="py-2 px-2">
                      <Link
                        href={`/products/${p.id}`}
                        className="text-ink no-underline hover:text-gold"
                      >
                        {p.title.length > 40 ? p.title.substring(0, 40) + '…' : p.title}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <PriceDisplay price={p.price} />
                    </td>
                    <td className="py-2 px-2">
                      <Tag variant="keyword">{p.search_keyword}</Tag>
                    </td>
                    <td className="py-2 px-2">
                      {p.category ? <Tag variant="category">{p.category}</Tag> : '—'}
                    </td>
                    <td className="py-2 px-2 text-muted">{p.location || '-'}</td>
                    <td className="py-2 px-2 text-muted">
                      {p.last_seen_at ? p.last_seen_at.substring(0, 16) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      {/* Empty state */}
      {!recentProducts.length && !Object.keys(categoryStats).length && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-bold text-ink mb-2">暂无数据</p>
          <p className="text-sm text-muted mb-4">请先添加关键词并启动监控</p>
          <Link
            href="/control"
            className="px-4 py-2 bg-gold text-white rounded-md text-sm font-medium no-underline hover:bg-gold-dim"
          >
            前往控制面板
          </Link>
        </div>
      )}
    </div>
  );
}
