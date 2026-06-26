import { NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
