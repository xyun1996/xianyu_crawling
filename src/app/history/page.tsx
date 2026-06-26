import { getProductsWithPriceHistory, getAllCategories, initDb } from '@/lib/db';
import { loadKeywords } from '@/lib/config';
import PanelCard from '@/components/PanelCard';
import Tag from '@/components/Tag';
import PriceDisplay from '@/components/PriceDisplay';
import FilterBar from '@/components/FilterBar';
import MetricCard from '@/components/MetricCard';
import HistoryTable from '@/components/HistoryTable';
import Link from 'next/link';

type SearchParams = Promise<{
  keyword?: string;
  category?: string;
}>;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  initDb();

  const params = await searchParams;
  const keyword = params.keyword || '';
  const category = params.category || '';

  const allProducts = getProductsWithPriceHistory(keyword, 200);
  const keywords = loadKeywords();
  const categories = getAllCategories();

  // Split into changed and stable
  const changed = allProducts.filter(p => p.history.length > 1 && Math.abs(p.price - p.history[0].price) > 0.01);
  const stable = allProducts.filter(p => p.history.length <= 1 || Math.abs(p.price - p.history[0].price) <= 0.01);

  // Further filter by category if specified
  const filteredChanged = category ? changed.filter(p => p.category === category) : changed;
  const filteredStable = category ? stable.filter(p => p.category === category) : stable;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">价格变动</h1>
        <p className="text-sm text-muted">追踪商品价格区间、涨跌方向与历史快照</p>
      </div>

      <FilterBar
        keywords={keywords}
        categories={categories}
        currentKeyword={keyword}
        currentCategory={category}
        currentActiveOnly={true}
        basePath="/history"
        showActiveOnly={false}
      />

      {/* Summary Stats */}
      {filteredChanged.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="变动商品" value={filteredChanged.length} />
          <MetricCard label="价格稳定" value={filteredStable.length} />
          <MetricCard label="监控总数" value={filteredChanged.length + filteredStable.length} />
        </div>
      )}

      {/* Changed Products — client-side sortable */}
      {filteredChanged.length > 0 && (
        <PanelCard
          title="价格变动商品"
          badge={`${filteredChanged.length} 件`}
          className="mb-4"
        >
          <HistoryTable products={filteredChanged} />
        </PanelCard>
      )}

      {/* Stable Products */}
      {filteredStable.length > 0 && (
        <PanelCard
          title="价格稳定"
          badge={`${filteredStable.length} 件`}
          className="mb-4"
        >
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted font-medium py-2 px-3 hover:text-ink">
              点击展开
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted">商品</th>
                    <th className="text-right py-2 px-2 font-medium text-muted">价格</th>
                    <th className="text-left py-2 px-2 font-medium text-muted">关键词</th>
                    <th className="text-left py-2 px-2 font-medium text-muted">分类</th>
                    <th className="text-left py-2 px-2 font-medium text-muted">地区</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStable.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-ink/[0.02]">
                      <td className="py-2 px-2">
                        <Link href={`/products/${p.id}`} className="text-ink no-underline hover:text-gold">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </PanelCard>
      )}

      {/* Empty state */}
      {filteredChanged.length === 0 && filteredStable.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-bold text-ink mb-2">暂无价格变动记录</p>
          <p className="text-sm text-muted mb-2">
            运行多次抓取后，价格发生变化的商品会出现在这里。
          </p>
          <p className="text-xs text-muted">
            前往 <Link href="/control" className="text-gold no-underline hover:underline">控制面板</Link> 启动监控。
          </p>
        </div>
      )}
    </div>
  );
}
