import { getProductsPaginated, getAllCategories, initDb } from '@/lib/db';
import { loadKeywords } from '@/lib/config';
import ProductsClient from './ProductsClient';
import { PER_PAGE } from '@/lib/config';

type SearchParams = Promise<{
  keyword?: string;
  category?: string;
  active_only?: string;
  sort?: string;
  order?: string;
  page?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  initDb();

  const params = await searchParams;
  const keyword = params.keyword || '';
  const category = params.category || '';
  const activeOnly = params.active_only !== 'false';
  const sortBy = params.sort || 'last_seen_at';
  const order = params.order || 'desc';
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const { products, totalCount } = getProductsPaginated(
    keyword,
    category,
    activeOnly,
    sortBy,
    order,
    page,
    PER_PAGE
  );

  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const keywords = loadKeywords();
  const categories = getAllCategories();

  const baseUrl = `/products?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}&active_only=${activeOnly}&sort=${sortBy}&order=${order}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">商品列表</h1>
        <p className="text-sm text-muted">浏览所有监控商品，支持筛选与排序</p>
      </div>

      <ProductsClient
        products={products}
        totalCount={totalCount}
        keywords={keywords}
        categories={categories}
        currentKeyword={keyword}
        currentCategory={category}
        currentActiveOnly={activeOnly}
        currentSort={sortBy}
        currentOrder={order}
        currentPage={page}
        totalPages={totalPages}
        baseUrl={baseUrl}
        perPage={PER_PAGE}
      />
    </div>
  );
}
