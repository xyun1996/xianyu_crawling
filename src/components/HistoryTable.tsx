'use client';

import { useState } from 'react';
import type { ProductWithHistory } from '@/lib/types';
import Tag from './Tag';
import PriceDisplay from './PriceDisplay';
import Link from 'next/link';

type SortCol = 'price' | 'diff' | 'is_active';
type SortDir = 'asc' | 'desc';

interface HistoryTableProps {
  products: ProductWithHistory[];
}

export default function HistoryTable({ products }: HistoryTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('diff');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pre-compute diff for each product
  const withDiff = products.map(p => ({
    ...p,
    diff: p.history.length > 0 ? p.price - p.history[0].price : 0,
  }));

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'diff' ? 'desc' : 'asc');
    }
  };

  const sorted = [...withDiff].sort((a, b) => {
    let va: number | string | boolean;
    let vb: number | string | boolean;

    switch (sortCol) {
      case 'price':
        va = a.price;
        vb = b.price;
        break;
      case 'diff':
        va = a.diff;
        vb = b.diff;
        break;
      case 'is_active':
        va = a.is_active ? 1 : 0;
        vb = b.is_active ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ col, label, align = 'left' }: { col: SortCol; label: string; align?: 'left' | 'right' }) => (
    <th
      className={`py-2 px-2 font-medium cursor-pointer select-none hover:text-gold ${
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
            <th className="text-left py-2 px-2 font-medium text-muted">商品名</th>
            <SortHeader col="price" label="当前价格" align="right" />
            <th className="text-left py-2 px-2 font-medium text-muted">价格区间</th>
            <th className="text-left py-2 px-2 font-medium text-muted">关键词</th>
            <SortHeader col="is_active" label="状态" />
            <SortHeader col="diff" label="变动" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr key={p.id} className="border-b border-border/50 hover:bg-ink/[0.02]">
              <td className="py-2 px-2">
                <Link
                  href={`/products/${p.id}`}
                  className="text-ink no-underline hover:text-gold"
                >
                  {p.title.length > 45 ? p.title.substring(0, 45) + '…' : p.title}
                </Link>
              </td>
              <td className="py-2 px-2 text-right">
                <PriceDisplay price={p.price} />
              </td>
              <td className="py-2 px-2 text-muted">
                <PriceDisplay price={p.min_price} /> ~ <PriceDisplay price={p.max_price} />
              </td>
              <td className="py-2 px-2">
                <Tag variant="keyword">{p.search_keyword}</Tag>
              </td>
              <td className="py-2 px-2">
                {p.is_active ? <Tag variant="new">在售</Tag> : <Tag variant="inactive">已下架</Tag>}
              </td>
              <td className={`py-2 px-2 text-right font-medium ${
                p.diff > 0 ? 'text-signal' : p.diff < 0 ? 'text-mint' : 'text-muted'
              }`}>
                {p.diff > 0 ? '+' : ''}<PriceDisplay price={Math.abs(p.diff)} />
                {p.diff > 0 ? ' ↑' : p.diff < 0 ? ' ↓' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
