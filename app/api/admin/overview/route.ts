import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminEnabled, isProduction, isValidAdminCookie } from '@/lib/admin/auth';
import { readRange, type DayResult, type StoredEvent } from '@/lib/analytics/store';
import { EVENT_LABEL } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Counts = Record<string, number>;

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

  // 主漏斗：访问 → 开始测试 → 完成测试 → 生成分享图
  const mainFunnel = buildFunnel(totals, ['page_view', 'test_start', 'test_complete', 'share_card_generate'], 'page_view');
  // 答题漏斗：分步留存。要定位「掉在第几题」必须看 question_view 的逐步衰减
  const quizFunnel = buildFunnel(
    totals,
    ['question_view', 'question_answer', 'test_complete'],
    'question_view',
  );
  const socialFunnel = buildFunnel(totals, ['friend_match_start', 'friend_match_complete'], 'friend_match_start');
  // 裂变漏斗（2026-09-16 新增）：分享页访问 → 站内点击 → 开始测试，用于估算传播效率
  const growthFunnel = buildFunnel(
    totals,
    ['shared_landing_view', 'shared_cta_click', 'test_start'],
    'shared_landing_view',
  );
  // 付费漏斗（2026-09-16 修复）：起点从「弹窗打开」上移到「付费墙曝光」，
  // 否则看不到流失最大的那一段（看到付费墙 → 打开弹窗）。
  const payFunnel = buildFunnel(
    totals,
    ['paywall_view', 'pay_modal_open', 'pay_claim', 'unlock_success'],
    'paywall_view',
  );
  // 留存回访（2026-09-16 第 2 批）：香签曝光 → 揭笺 → 连续静候
  const retentionFunnel = buildFunnel(totals, ['daily_view', 'daily_draw', 'daily_streak'], 'daily_view');

  const trend = range.days.map((d) => ({
    date: d.date,
    pv: Number(d.counts?.page_view ?? 0),
    uv: d.uv ?? 0,
    nv: d.nv ?? 0,
    start: Number(d.counts?.test_start ?? 0),
    done: Number(d.counts?.test_complete ?? 0),
    share: Number(d.counts?.share_card_generate ?? 0),
  }));

  // 会话口径（第 2 批）：会话数独立于访客，按 sid 去重
  const sessionsTotal = range.days.reduce((s, d) => s + (d.sessions || 0), 0);
  const intervalSessions = range.intervalSessions ?? 0;

  return {
    driver: range.driver,
    from: range.from,
    to: range.to,
    intervalUv: range.intervalUv,
    intervalSessions,
    uvTotal,
    nvTotal,
    sessionsTotal,
    totals,
    trend,
    funnel: {
      main: mainFunnel,
      quiz: quizFunnel,
      social: socialFunnel,
      growth: growthFunnel,
      pay: payFunnel,
      retention: retentionFunnel,
    },
    top: {
      personality: topN(sumDim(range.days, 'personality'), 16),
      ref: topN(sumDim(range.days, 'ref'), 10),
      path: topN(sumDim(range.days, 'path'), 10),
      method: topN(sumDim(range.days, 'method'), 6),
      price: topN(sumDim(range.days, 'price'), 6),
      tier: topN(sumDim(range.days, 'tier'), 6),
      scene: topN(sumDim(range.days, 'scene'), 6),
      sign: topN(sumDim(range.days, 'sign'), 6),
      // 答题漏斗：哪一步掉人最多 / 哪个选项被选得最多（改题的直接依据）
      step: topN(sumDim(range.days, 'step'), 12),
      choice: topN(sumDim(range.days, 'choice'), 20),
      // 裂变：落地页哪个 CTA 真的被点
      cta: topN(sumDim(range.days, 'cta'), 8),
      // 香气探索（第 2 批）：tab / action / perfume 分布
      tab: topN(sumDim(range.days, 'tab'), 6),
      action: topN(sumDim(range.days, 'action'), 8),
      perfume: topN(sumDim(range.days, 'perfume'), 12),
      // 留存回访（第 2 批）：裸值返回，分桶交给看板端（裸值不可逆，分桶可逆）
      days: topN(sumDim(range.days, 'days'), 40),
      litCount: topN(sumDim(range.days, 'litCount'), 40),
      hasDrawn: topN(sumDim(range.days, 'hasDrawn'), 4),
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
