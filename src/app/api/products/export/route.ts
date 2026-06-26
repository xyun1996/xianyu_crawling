import { NextRequest, NextResponse } from 'next/server';
import { getProductsForExport, initDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  initDb();

  const { searchParams } = request.nextUrl;
  const keyword = searchParams.get('keyword') || '';
  const category = searchParams.get('category') || '';
  const activeOnly = searchParams.get('active_only') !== 'false';

  const data = getProductsForExport(keyword, category, activeOnly);

  // Build CSV
  const header =
    'ID,商品编码,标题,价格,卖家,地区,成色,搜索关键词,分类,首次发现,最后发现,在售状态,价格历史';

  const rows = data.map(p => {
    const status = p.is_active ? '在售' : '已下架';
    // Deduplicate: consecutive same-price merged to earliest, skip first (already in price column)
    const priceChanges = p.snapshots
      .filter((s, i) => i === 0 || Math.abs(s.price - p.snapshots[i - 1].price) > 0.01)
      .slice(1); // skip the first entry — it's the same as the price column
    const history = priceChanges
      .map(s => `${fmtCompactDate(s.captured_at)}:${s.price}`)
      .join(';');
    return [
      p.id,
      csvEscape(p.item_id),
      csvEscape(p.title),
      p.price,
      csvEscape(p.seller_name),
      csvEscape(p.location),
      csvEscape(p.condition),
      csvEscape(p.search_keyword),
      csvEscape(p.category),
      fmtExcelDate(p.first_seen_at),
      fmtExcelDate(p.last_seen_at),
      status,
      history ? `"${history}"` : '',
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  // UTF-8 BOM for Excel compatibility
  const bom = '﻿';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="xianyu-products-${dateStr}.csv"`,
    },
  });
}

/** Escape a CSV field that may contain commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Format datetime for Excel: YYYY/MM/DD HH:MM (most reliably parsed by Excel). */
function fmtExcelDate(t: string | null): string {
  if (!t) return '';
  const s = String(t).replace(/-/g, '/').substring(0, 16);
  return s;
}

/** Compact datetime for price history field: YYYYMMDDHHmm (no ambiguous chars). */
function fmtCompactDate(t: string | null): string {
  if (!t) return '';
  return String(t).replace(/[- :]/g, '').substring(0, 12);
}
