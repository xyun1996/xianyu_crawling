import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function GET() {
  const manager = getCrawlManager();
  return NextResponse.json(manager.getStatus());
}
