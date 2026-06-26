import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST() {
  const manager = getCrawlManager();
  const result = manager.startCrawl();
  if (!result.started) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(manager.getStatus());
}
