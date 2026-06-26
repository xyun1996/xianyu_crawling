import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST() {
  const manager = getCrawlManager();
  manager.pauseCrawl();
  return NextResponse.json(manager.getStatus());
}
