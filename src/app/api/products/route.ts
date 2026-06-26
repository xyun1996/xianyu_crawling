import { NextRequest, NextResponse } from 'next/server';
import {
  deleteProduct,
  deleteProducts,
  deleteProductsByKeyword,
  deleteProductsByCategory,
  deleteAllProducts,
  initDb,
} from '@/lib/db';

type DeleteRequest =
  | { mode: 'single'; id: number }
  | { mode: 'batch'; ids: number[] }
  | { mode: 'by_keyword'; keyword: string }
  | { mode: 'by_category'; category: string }
  | { mode: 'clear_all' };

export async function DELETE(request: NextRequest) {
  initDb();

  let body: DeleteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || !body.mode) {
    return NextResponse.json({ error: 'Missing mode field' }, { status: 400 });
  }

  let result: { deleted_products: number; deleted_snapshots: number };

  try {
    switch (body.mode) {
      case 'single': {
        if (typeof body.id !== 'number') {
          return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        result = deleteProduct(body.id);
        if (result.deleted_products === 0) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        break;
      }
      case 'batch': {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
        }
        result = deleteProducts(body.ids);
        break;
      }
      case 'by_keyword': {
        if (!body.keyword) {
          return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
        }
        result = deleteProductsByKeyword(body.keyword);
        break;
      }
      case 'by_category': {
        if (!body.category) {
          return NextResponse.json({ error: 'category is required' }, { status: 400 });
        }
        result = deleteProductsByCategory(body.category);
        break;
      }
      case 'clear_all': {
        result = deleteAllProducts();
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...result });
}
