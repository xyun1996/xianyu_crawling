import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST() {
  const manager = getCrawlManager();

  if (manager.getStatus().login_in_progress) {
    return NextResponse.json(
      { error: '登录已在进行中' },
      { status: 409 }
    );
  }

  // Start login in background (don't await — return immediately)
  manager.login().catch((e) => {
    console.error('[Login] Error:', e);
  });

  return NextResponse.json({ message: '登录已启动' });
}
