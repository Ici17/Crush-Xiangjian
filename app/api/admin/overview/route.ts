import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminEnabled, isProduction, isValidAdminCookie } from '@/lib/admin/auth';
import { readRange, type DayResult, type StoredEvent } from '@/lib/analytics/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Counts = Record<string, number>;

const EVENT_LABEL: Record<string, string> = {
  page_view: '页面访问',
  test_start: '开始测试',
  test_complete: '完成测试',
  result_view: '查看他人结果',
  share_card_generate: '生成分享图',
  share_guide_open: '打开分享引导',
  share_click: '点击分享',
  download_card: '下载分享图',
  friend_match_start: '好友匹配开始',
  friend_match_complete: '好友匹配完成',
  daily_draw: '香签揭笺',
  codex_view: '香气图鉴',
  pay_modal_open: '解锁弹窗曝光',
  pay_method_select: '选择支付方式',
  pay_claim: '点击去支付',
  unlock_success: '解锁成功',
};

function sumCounts(days: DayResult[]): Counts {
  const out: Counts = {};
  for (const d of days) {
    for (const [k, v] of Object.entries(d.counts ?? {})) {
      out[k] = (out[k] ?? 0) + Number(v || 0);
    }
  }
  return out;
}

function sumDim(days: DayResult[], key: string): Counts {
  const out: Counts = {};
  for (const d of days) {
    const dim = d.dims?.[key as keyof typeof d.dims];
    if (!dim) continue;
    for (const [k, v] of Object.entries(dim)) {
      out[k] = (out[k] ?? 0) + Number(v || 0);
    }
  }
  return out;
}

function topN(obj: Counts, n = 10): Array<{ name: string; count: number }> {
  return Object.entries(obj)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function buildFunnel(totals: Counts, steps: string[], baseKey: string) {
  const base = totals[baseKey] ?? 0;
  return steps.map((key, i) => {
    const count = totals[key] ?? 0;
    const prev = i === 0 ? count : totals[steps[i - 1]] ?? 0;
    return {
      key,
      label: EVENT_LABEL[key] ?? key,
      count,
      rateFromTop: base ? +((count / base) * 100).toFixed(1) : 0,
      rateFromPrev: prev ? +((count / prev) * 100).toFixed(1) : 0,
    };
  });
}

async function build(days: number) {
  const range = await readRange(days);
  const totals = sumCounts(range.days);
  const uvTotal = range.days.reduce((s, d) => s + (d.uv || 0), 0);
  const nvTotal = range.days.reduce((s, d) => s + (d.nv || 0), 0);

  const mainFunnel = buildFunnel(totals, ['page_view', 'test_start', 'test_complete', 'share_card_generate'], 'page_view');
  const socialFunnel = buildFunnel(totals, ['friend_match_start', 'friend_match_complete'], 'friend_match_start');
  const payFunnel = buildFunnel(totals, ['pay_modal_open', 'pay_claim', 'unlock_success'], 'pay_modal_open');

  const trend = range.days.map((d) => ({
    date: d.date,
    pv: Number(d.counts?.page_view ?? 0),
    uv: d.uv ?? 0,
    nv: d.nv ?? 0,
    start: Number(d.counts?.test_start ?? 0),
    done: Number(d.counts?.test_complete ?? 0),
    share: Number(d.counts?.share_card_generate ?? 0),
  }));

  return {
    driver: range.driver,
    from: range.from,
    to: range.to,
    intervalUv: range.intervalUv,
    uvTotal,
    nvTotal,
    totals,
    trend,
    funnel: { main: mainFunnel, social: socialFunnel, pay: payFunnel },
    top: {
      personality: topN(sumDim(range.days, 'personality'), 16),
      ref: topN(sumDim(range.days, 'ref'), 10),
      path: topN(sumDim(range.days, 'path'), 10),
      method: topN(sumDim(range.days, 'method'), 6),
      price: topN(sumDim(range.days, 'price'), 6),
      tier: topN(sumDim(range.days, 'tier'), 6),
      scene: topN(sumDim(range.days, 'scene'), 6),
      sign: topN(sumDim(range.days, 'sign'), 6),
    },
    recent: range.recent.slice(0, 100),
  };
}

function toCsv(data: Awaited<ReturnType<typeof build>>): string {
  const rows: string[][] = [];
  rows.push(['# Crush香鉴 数据导出']);
  rows.push(['区间', `${data.from} ~ ${data.to}`]);
  rows.push(['存储驱动', data.driver]);
  rows.push(['区间去重访客', String(data.intervalUv)]);
  rows.push([]);
  rows.push(['事件', '次数']);
  for (const [k, v] of Object.entries(data.totals).sort((a, b) => b[1] - a[1])) {
    rows.push([EVENT_LABEL[k] ?? k, String(v)]);
  }
  rows.push([]);
  rows.push(['日期', 'PV', 'UV', '新访客', '开始测试', '完成测试', '生成分享图']);
  for (const t of data.trend) {
    rows.push([t.date, String(t.pv), String(t.uv), String(t.nv), String(t.start), String(t.done), String(t.share)]);
  }
  rows.push([]);
  rows.push(['人格分布', '次数']);
  for (const p of data.top.personality) rows.push([p.name, String(p.count)]);
  rows.push([]);
  rows.push(['来源渠道', '次数']);
  for (const p of data.top.ref) rows.push([p.name, String(p.count)]);
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!adminEnabled()) {
    return NextResponse.json(
      { ok: false, error: '线上未配置 ADMIN_PASSWORD，后台已禁用' },
      { status: 503 },
    );
  }
  if (!isValidAdminCookie(cookie)) {
    return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 14) || 14, 1), 90);

  try {
    const data = await build(days);
    if (url.searchParams.get('format') === 'csv') {
      return new NextResponse('\uFEFF' + toCsv(data), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="crush-analytics-${data.from}_${data.to}.csv"`,
        },
      });
    }
    return NextResponse.json({ ok: true, production: isProduction(), ...data });
  } catch (e) {
    console.error('[admin] overview failed', e);
    return NextResponse.json({ ok: false, error: '数据读取失败' }, { status: 500 });
  }
}

export type { StoredEvent };
