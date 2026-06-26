import { NextResponse } from 'next/server';
import { getCrawlManager } from '@/lib/crawl-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const manager = getCrawlManager();

    // Update keyword library if provided
    if (body.keywords !== undefined) {
      const keywords = body.keywords;
      if (!Array.isArray(keywords)) {
        return NextResponse.json(
          { error: '关键词格式错误' },
          { status: 400 }
        );
      }
      const normalized = keywords.map((item: any) => ({
        keyword: String(item.keyword || '').trim(),
        category: String(item.category || '').trim(),
      })).filter((item: any) => item.keyword !== '');

      if (normalized.length === 0) {
        return NextResponse.json(
          { error: '关键词不能为空' },
          { status: 400 }
        );
      }
      manager.setKeywords(normalized);
    }

    // Update selected keywords if provided
    if (body.selected_keywords !== undefined) {
      const selected = body.selected_keywords;
      if (!Array.isArray(selected)) {
        return NextResponse.json(
          { error: '选中关键词格式错误' },
          { status: 400 }
        );
      }
      const normalized = selected.map((item: any) => ({
        keyword: String(item.keyword || '').trim(),
        category: String(item.category || '').trim(),
      })).filter((item: any) => item.keyword !== '');
      manager.setSelectedKeywords(normalized);
    }

    return NextResponse.json(manager.getStatus());
  } catch {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
}
