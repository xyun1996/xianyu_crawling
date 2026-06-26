import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const maxRounds = body.max_rounds;

    if (maxRounds !== null && (typeof maxRounds !== 'number' || maxRounds < 1)) {
      return NextResponse.json(
        { error: '轮次限制最少 1 轮' },
        { status: 400 }
      );
    }

    const manager = getCrawlManager();
    manager.setMaxRounds(maxRounds);
    return NextResponse.json(manager.getStatus());
  } catch {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
}
