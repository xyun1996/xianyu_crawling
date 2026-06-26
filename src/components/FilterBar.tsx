'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface FilterBarProps {
  keywords: { keyword: string }[];
  categories: string[];
  currentKeyword: string;
  currentCategory: string;
  currentActiveOnly: boolean;
  basePath?: string;
  showActiveOnly?: boolean;
  onExportCsv?: () => void;
  onDeleteByFilter?: () => void;
  hasFilter?: boolean;
}

export default function FilterBar({
  keywords,
  categories,
  currentKeyword,
  currentCategory,
  currentActiveOnly,
  basePath = '/products',
  showActiveOnly = true,
  onExportCsv,
  onDeleteByFilter,
  hasFilter = false,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Filters */}
      <select
        value={currentKeyword}
        onChange={e => updateFilter('keyword', e.target.value)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-card text-ink focus:outline-none focus:ring-1 focus:ring-gold"
      >
        <option value="">全部关键词</option>
        {keywords.map(kw => (
          <option key={kw.keyword} value={kw.keyword}>
            {kw.keyword}
          </option>
        ))}
      </select>

      <select
        value={currentCategory}
        onChange={e => updateFilter('category', e.target.value)}
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-card text-ink focus:outline-none focus:ring-1 focus:ring-gold"
      >
        <option value="">全部分类</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {showActiveOnly && (
        <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={currentActiveOnly}
            onChange={e => updateFilter('active_only', e.target.checked ? 'true' : 'false')}
            className="accent-gold"
          />
          仅在售
        </label>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      {onExportCsv && (
        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 text-sm border border-border rounded-md text-ink hover:bg-ink/5 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          导出 CSV
        </button>
      )}

      {onDeleteByFilter && hasFilter && (
        <button
          onClick={onDeleteByFilter}
          className="px-3 py-1.5 text-sm border border-red-200 rounded-md text-red-600 hover:bg-red-50 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除筛选结果
        </button>
      )}
    </div>
  );
}
