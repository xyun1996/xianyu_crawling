import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const minutes = body.minutes;

    if (typeof minutes !== 'number' || minutes < 3) {
      return NextResponse.json(
        { error: '爬取间隔最少 3 分钟' },
        { status: 400 }
      );
    }

    const manager = getCrawlManager();
    manager.setInterval(minutes);
    return NextResponse.json(manager.getStatus());
  } catch {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
}
