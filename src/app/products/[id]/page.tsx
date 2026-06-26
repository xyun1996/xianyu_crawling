import { getProductById, getPriceHistory, initDb } from '@/lib/db';
import { notFound } from 'next/navigation';
import PanelCard from '@/components/PanelCard';
import Tag from '@/components/Tag';
import PriceDisplay from '@/components/PriceDisplay';
import PriceChart from '@/components/PriceChart';
import Link from 'next/link';

type PageParams = Promise<{ id: string }>;

export default async function ProductDetailPage({
  params,
}: {
  params: PageParams;
}) {
  initDb();

  const { id } = await params;
  const productId = parseInt(id, 10);
  if (isNaN(productId)) notFound();

  const product = getProductById(productId);
  if (!product) notFound();

  const priceHistory = getPriceHistory(productId);

  // Prepare chart data
  const chartLabels = priceHistory.map(h =>
    h.captured_at ? h.captured_at.substring(5, 16) : ''
  );
  const chartValues = priceHistory.map(h => h.price);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">商品详情</h1>
        <p className="text-sm text-muted">查看商品信息、价格走势与历史记录</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Product Info */}
        <PanelCard title="商品信息">
          {product.image_url && (
            <img
              className="w-full max-h-48 object-contain mb-3 rounded"
              src={`https:${product.image_url}`}
              alt={product.title}
              loading="lazy"
            />
          )}
          <h3 className="font-semibold text-ink mb-3">{product.title}</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="text-muted py-1 w-20">价格</td>
                <td className="py-1 text-lg font-bold">
                  <PriceDisplay price={product.price} />
                </td>
              </tr>
              <tr>
                <td className="text-muted py-1">地区</td>
                <td className="py-1">{product.location || '-'}</td>
              </tr>
              <tr>
                <td className="text-muted py-1">关键词</td>
                <td className="py-1"><Tag variant="keyword">{product.search_keyword}</Tag></td>
              </tr>
              {product.category && (
                <tr>
                  <td className="text-muted py-1">分类</td>
                  <td className="py-1"><Tag variant="category">{product.category}</Tag></td>
                </tr>
              )}
              <tr>
                <td className="text-muted py-1">状态</td>
                <td className="py-1">
                  {product.is_active ? <Tag variant="new">在售</Tag> : <Tag variant="inactive">已下架</Tag>}
                </td>
              </tr>
              <tr>
                <td className="text-muted py-1">首次发现</td>
                <td className="py-1">{product.first_seen_at ? product.first_seen_at.substring(0, 19) : '-'}</td>
              </tr>
              <tr>
                <td className="text-muted py-1">最近发现</td>
                <td className="py-1">{product.last_seen_at ? product.last_seen_at.substring(0, 19) : '-'}</td>
              </tr>
              {product.item_id && (
                <tr>
                  <td className="text-muted py-1">闲鱼链接</td>
                  <td className="py-1">
                    <a
                      href={`https://www.goofish.com/item?id=${product.item_id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-gold no-underline hover:underline"
                    >
                      查看商品 ↗
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </PanelCard>

        {/* Price Chart */}
        <PanelCard title="价格走势">
          {priceHistory.length > 0 ? (
            <PriceChart labels={chartLabels} values={chartValues} />
          ) : (
            <div className="text-center py-8 text-muted">暂无价格记录</div>
          )}
        </PanelCard>
      </div>

      {/* Price Snapshot Table */}
      {priceHistory.length > 0 && (
        <PanelCard
          title="价格记录"
          badge={`${priceHistory.length} 条`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted">#</th>
                  <th className="text-right py-2 px-2 font-medium text-muted">价格</th>
                  <th className="text-left py-2 px-2 font-medium text-muted">记录时间</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((h, i) => (
                  <tr key={h.id ?? i} className="border-b border-border/50">
                    <td className="py-2 px-2 text-muted">{i + 1}</td>
                    <td className="py-2 px-2 text-right">
                      <PriceDisplay price={h.price} />
                    </td>
                    <td className="py-2 px-2 text-muted">
                      {h.captured_at ? h.captured_at.substring(0, 19) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      <div className="mt-4">
        <Link
          href="/products"
          className="inline-flex items-center px-4 py-2 border border-border rounded-md text-sm text-muted no-underline hover:text-ink hover:border-ink/20 transition-colors"
        >
          ← 返回列表
        </Link>
      </div>
    </div>
  );
}
