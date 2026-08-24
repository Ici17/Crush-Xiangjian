import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 匿名事件上报端点（无 PII）。
 *
 * - 仅接受白名单内的事件名，其余静默忽略。
 * - props 只允许 string / number / boolean，且长度受限，杜绝任何敏感字段注入。
 * - 不读取请求 IP / x-forwarded-for 等可识别信息。
 * - 零配置：事件打到 Vercel 函数日志（Dashboard → Functions → Logs 立即可见）。
 * - 配置 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 后，自动写入 Redis 列表
 *   `cx_events`，供聚合看板读取（见 ANALYTICS.md）。
 */

const ALLOWED = new Set([
  'page_view',
  'test_start',
  'test_complete',
  'result_view',
  'share_card_generate',
  'friend_match_start',
  'friend_match_complete',
]);

type PropValue = string | number | boolean;

function sanitizeProps(input: unknown): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const key = String(k).slice(0, 32);
        out[key] = typeof v === 'string' ? (v.slice(0, 64) as string) : v;
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('bad request', { status: 400 });
  }

  const { event, props, sessionId, path, ts } = body || {};
  if (typeof event !== 'string' || !ALLOWED.has(event)) {
    return new NextResponse(null, { status: 204 }); // 静默忽略未知事件
  }

  const record = {
    event,
    props: sanitizeProps(props),
    sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 64) : '',
    path: typeof path === 'string' ? path.slice(0, 200) : '',
    ts: typeof ts === 'number' ? ts : Date.now(),
    receivedAt: Date.now(),
  };

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      await fetch(`${url}/lpush/cx_events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify([JSON.stringify(record)]),
      });
    } catch (e) {
      console.error('[analytics] upstash push failed', e);
    }
  } else {
    // 零配置降级：写入函数日志
    console.log('[event]', JSON.stringify(record));
  }

  return new NextResponse(null, { status: 204 });
}
