'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';
import FilterBar from '@/components/FilterBar';
import SortableTable from '@/components/SortableTable';
import Pagination from '@/components/Pagination';
import PanelCard from '@/components/PanelCard';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ProductsClientProps {
  products: Product[];
  totalCount: number;
  keywords: { keyword: string }[];
  categories: string[];
  currentKeyword: string;
  currentCategory: string;
  currentActiveOnly: boolean;
  currentSort: string;
  currentOrder: string;
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  perPage: number;
}

type DeleteMode = 'batch' | 'by_keyword' | 'by_category' | 'clear_all';

interface DeletePreview {
  mode: DeleteMode;
  label: string;
  productCount: number;
  snapshotCount: number;
  payload: Record<string, unknown>;
}

export default function ProductsClient({
  products,
  totalCount,
  keywords,
  categories,
  currentKeyword,
  currentCategory,
  currentActiveOnly,
  currentSort,
  currentOrder,
  currentPage,
  totalPages,
  baseUrl,
}: ProductsClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selection handlers
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (products.every(p => prev.has(p.id!))) {
        // Deselect all on current page
        return new Set();
      }
      // Select all on current page
      return new Set(products.map(p => p.id!));
    });
  }, [products]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    const params = new URLSearchParams();
    if (currentKeyword) params.set('keyword', currentKeyword);
    if (currentCategory) params.set('category', currentCategory);
    params.set('active_only', currentActiveOnly ? 'true' : 'false');
    window.open(`/api/products/export?${params.toString()}`, '_blank');
  }, [currentKeyword, currentCategory, currentActiveOnly]);

  // Delete preview — fetch counts before showing dialog
  const showDeletePreview = useCallback(async (mode: DeleteMode, payload: Record<string, unknown>, label: string) => {
    try {
      const params = new URLSearchParams();
      if (mode === 'by_keyword') params.set('keyword', String(payload.keyword));
      else if (mode === 'by_category') params.set('category', String(payload.category));
      else if (mode === 'clear_all') params.set('mode', 'clear_all');
      else if (mode === 'batch') {
        // For batch, we can count locally
        const ids = payload.ids as number[];
        setDeletePreview({
          mode,
          label,
          productCount: ids.length,
          snapshotCount: 0, // unknown, but acceptable
          payload,
        });
        return;
      }

      const res = await fetch(`/api/products/count?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDeletePreview({
          mode,
          label,
          productCount: data.product_count ?? 0,
          snapshotCount: data.snapshot_count ?? 0,
          payload,
        });
      } else {
        // Fallback: show dialog without counts
        setDeletePreview({ mode, label, productCount: 0, snapshotCount: 0, payload });
      }
    } catch {
      setDeletePreview({ mode, label, productCount: 0, snapshotCount: 0, payload });
    }
  }, []);

  // Delete by filter
  const handleDeleteByFilter = useCallback(() => {
    if (currentKeyword) {
      showDeletePreview('by_keyword', { keyword: currentKeyword }, `关键词「${currentKeyword}」的商品`);
    } else if (currentCategory) {
      showDeletePreview('by_category', { category: currentCategory }, `分类「${currentCategory}」的商品`);
    }
  }, [currentKeyword, currentCategory, showDeletePreview]);

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    showDeletePreview('batch', { ids: Array.from(selectedIds) }, `选中的 ${selectedIds.size} 件商品`);
  }, [selectedIds, showDeletePreview]);

  // Clear all
  const handleClearAll = useCallback(() => {
    showDeletePreview('clear_all', {}, '所有商品');
  }, [showDeletePreview]);

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePreview) return;
    setDeleting(true);

    try {
      const body: Record<string, unknown> = { mode: deletePreview.mode, ...deletePreview.payload };
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setToast({
          message: `已删除 ${data.deleted_products} 件商品和 ${data.deleted_snapshots} 条价格快照`,
          type: 'success',
        });
        setSelectedIds(new Set());
        setDeletePreview(null);
        // Refresh page data
        router.refresh();
      } else {
        const data = await res.json();
        setToast({ message: data.error || '删除失败', type: 'error' });
        setDeletePreview(null);
      }
    } catch {
      setToast({ message: '网络错误，删除失败', type: 'error' });
      setDeletePreview(null);
    } finally {
      setDeleting(false);
    }
  }, [deletePreview, router]);

  const hasFilter = !!(currentKeyword || currentCategory);

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg transition-opacity ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}

      <FilterBar
        keywords={keywords}
        categories={categories}
        currentKeyword={currentKeyword}
        currentCategory={currentCategory}
        currentActiveOnly={currentActiveOnly}
        onExportCsv={handleExportCsv}
        onDeleteByFilter={handleDeleteByFilter}
        hasFilter={hasFilter}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted">
          共 {totalCount} 件商品
          {selectedIds.size > 0 && (
            <span className="ml-2 text-gold-dim">已选 {selectedIds.size} 件</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 text-sm border border-red-200 rounded-md text-red-600 hover:bg-red-50"
            >
              删除选中 ({selectedIds.size})
            </button>
          )}
          {totalCount > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1 text-sm border border-red-200 rounded-md text-red-600 hover:bg-red-50"
            >
              清空全部
            </button>
          )}
        </div>
      </div>

      <PanelCard title="" className="">
        {products.length > 0 ? (
          <>
            <SortableTable
              products={products}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />
            <Pagination page={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
          </>
        ) : (
          <div className="text-center py-8 text-muted">暂无匹配商品</div>
        )}
      </PanelCard>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!deletePreview}
        title="确认删除"
        message={
          deletePreview
            ? `将删除${deletePreview.label}（${deletePreview.productCount} 件商品${deletePreview.snapshotCount > 0 ? `、${deletePreview.snapshotCount} 条价格快照` : ''}），此操作不可撤销。`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletePreview(null)}
        loading={deleting}
      />
    </>
  );
}
