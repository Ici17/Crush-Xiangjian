import { NextRequest, NextResponse } from 'next/server';
import { normalizeEvent } from '@/lib/analytics/events';
import { recordEvent } from '@/lib/analytics/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 匿名事件上报端点（无 PII）。
 *
 * - 仅接受白名单事件名，其余返回 204 静默忽略。
 * - props 经 sanitizeProps 清洗：只留标量、key 限字符集、value 限长。
 * - 不读取请求 IP / x-forwarded-for / UA，不做任何身份关联。
 * - 写入由 lib/analytics/store 决定：Vercel KV（线上）→ 本地文件（dev）→ 日志降级。
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const normalized = normalizeEvent(body);
  if (!normalized) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await recordEvent({ ...normalized, receivedAt: Date.now() });
  } catch {
    // 埋点永远不能影响主流程
  }

  return new NextResponse(null, { status: 204 });
}
