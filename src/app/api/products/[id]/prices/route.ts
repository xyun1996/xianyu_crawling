import { NextResponse } from 'next/server';
import { getPriceHistory } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const history = getPriceHistory(productId);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: 'Failed to get price history' }, { status: 500 });
  }
}
