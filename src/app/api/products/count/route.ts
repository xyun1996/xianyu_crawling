import { NextRequest, NextResponse } from 'next/server';
import { countProductsForDelete, countAllForDelete, initDb } from '@/lib/db';

/**
 * Count products and snapshots for delete preview.
 * Query params: mode=clear_all | keyword=... | category=...
 */
export async function GET(request: NextRequest) {
  initDb();

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('mode');
  const keyword = searchParams.get('keyword') || '';
  const category = searchParams.get('category') || '';

  if (mode === 'clear_all') {
    return NextResponse.json(countAllForDelete());
  }

  if (keyword) {
    return NextResponse.json(countProductsForDelete('by_keyword', keyword));
  }

  if (category) {
    return NextResponse.json(countProductsForDelete('by_category', category));
  }

  return NextResponse.json({ product_count: 0, snapshot_count: 0 });
}
