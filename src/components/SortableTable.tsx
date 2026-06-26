'use client';

import { useState } from 'react';
import type { Product } from '@/lib/types';
import Tag from './Tag';
import PriceDisplay from './PriceDisplay';
import Link from 'next/link';

type SortCol = 'price' | 'last_seen_at' | 'first_seen_at' | 'is_active';
type SortDir = 'asc' | 'desc';

interface SortableTableProps {
  products: Product[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
}

function fmtTime(t: string | null): string {
  if (!t) return '-';
  const s = String(t);
  return s.substring(0, 16);
}

export default function SortableTable({
  products: initialProducts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: SortableTableProps) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sorted = sortCol
    ? [...initialProducts].sort((a, b) => {
        let va: number | string | boolean = a[sortCol] ?? '';
        let vb: number | string | boolean = b[sortCol] ?? '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : initialProducts;

  const allSelected = initialProducts.length > 0 && initialProducts.every(p => selectedIds.has(p.id!));

  const SortHeader = ({ col, label, align = 'left' }: { col: SortCol; label: string; align?: 'left' | 'right' }) => (
    <th
      className={`py-2 px-2 font-medium cursor-pointer select-none hover:text-gold whitespace-nowrap ${
        sortCol === col ? 'text-gold' : 'text-muted'
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(col)}
    >
      {label}
      {sortCol === col && (sortDir === 'asc' ? ' ▲' : ' ▼')}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 px-2 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="accent-gold"
              />
            </th>
            <th className="text-left py-2 px-2 font-medium text-muted">商品</th>
            <SortHeader col="price" label="价格" align="right" />
            <th className="text-left py-2 px-2 font-medium text-muted">关键词</th>
            <th className="text-left py-2 px-2 font-medium text-muted">分类</th>
            <th className="text-left py-2 px-2 font-medium text-muted">地区</th>
            <SortHeader col="is_active" label="状态" />
            <SortHeader col="first_seen_at" label="发现时间" />
            <th className="text-center py-2 px-2 font-medium text-muted">链接</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const isSelected = selectedIds.has(p.id!);
            return (
              <tr
                key={p.id}
                className={`border-b border-border/50 hover:bg-ink/[0.02] ${isSelected ? 'bg-gold/5' : ''}`}
              >
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(p.id!)}
                    className="accent-gold"
                  />
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-ink no-underline hover:text-gold"
                  >
                    {p.title.length > 40 ? p.title.substring(0, 40) + '…' : p.title}
                  </Link>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  <PriceDisplay price={p.price} />
                </td>
                <td className="py-2 px-2">
                  <Tag variant="keyword">{p.search_keyword}</Tag>
                </td>
                <td className="py-2 px-2">
                  {p.category ? <Tag variant="category">{p.category}</Tag> : '—'}
                </td>
                <td className="py-2 px-2 text-muted">{p.location || '-'}</td>
                <td className="py-2 px-2">
                  {p.is_active ? <Tag variant="new">在售</Tag> : <Tag variant="inactive">已下架</Tag>}
                </td>
                <td className="py-2 px-2 text-muted whitespace-nowrap">
                  {fmtTime(p.first_seen_at)}
                </td>
                <td className="py-2 px-2 text-center">
                  {p.item_id ? (
                    <a
                      href={`https://www.goofish.com/item?id=${p.item_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold no-underline hover:underline text-xs"
                    >
                      查看 ↗
                    </a>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
