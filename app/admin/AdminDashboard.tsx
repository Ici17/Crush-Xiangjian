'use client';

/**
 * Crush香鉴 · 匿名数据看板（/admin）
 *
 * 数据来自 /api/admin/overview，底层为 Vercel KV（线上）/ 本地文件（dev）。
 * 全站埋点无 PII：不采集 IP、openid、手机号，仅匿名 sessionId 做去重。
 */

import { useCallback, useEffect, useState } from 'react';

type FunnelStep = {
  key: string;
  label: string;
  count: number;
  rateFromTop: number;
  rateFromPrev: number;
};

type TrendPoint = {
  date: string;
  pv: number;
  uv: number;
  nv: number;
  start: number;
  done: number;
  share: number;
};

type TopItem = { name: string; count: number };

type Overview = {
  ok: boolean;
  driver: 'supabase' | 'kv' | 'file' | 'log';
  truncated?: boolean;
  from: string;
  to: string;
  intervalUv: number;
  uvTotal: number;
  nvTotal: number;
  totals: Record<string, number>;
  trend: TrendPoint[];
  funnel: { main: FunnelStep[]; social: FunnelStep[]; pay: FunnelStep[] };
  top: {
    personality: TopItem[];
    ref: TopItem[];
    path: TopItem[];
    method: TopItem[];
    price: TopItem[];
    tier: TopItem[];
    scene: TopItem[];
    sign: TopItem[];
  };
  recent: Array<{
    event: string;
    props?: Record<string, string | number | boolean>;
    path: string;
    ts: number;
  }>;
  production?: boolean;
};

const INK = '#2C1810';
const GOLD = '#A8884E';
const CREAM = '#FAF3EA';
const GOLD_SOFT = '#EBDCC4';

const RANGES = [
  { days: 7, label: '近 7 天' },
  { days: 14, label: '近 14 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' },
];

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

function pct(a: number, b: number): string {
  if (!b) return '—';
  return `${((a / b) * 100).toFixed(1)}%`;
}

function num(n: number): string {
  return (n ?? 0).toLocaleString('zh-CN');
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', { cache: 'no-store' });
      const json = (await res.json()) as { ok: boolean; enabled: boolean };
      setEnabled(json.enabled !== false);
      setAuthed(!!json.ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/overview?days=${d}`, { cache: 'no-store' });
      if (res.status === 401) {
        setAuthed(false);
        setData(null);
        return;
      }
      const json = (await res.json()) as Overview;
      if (json.ok) setData(json);
    } catch {
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authed) void load(days);
  }, [authed, days, load]);

  const login = async () => {
    setError('');
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setPassword('');
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error || '登录失败');
    }
  };

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAuthed(false);
    setData(null);
  };

  // —— 登录 / 未启用 ——
  if (authed === false || !enabled) {
    return (
      <Shell>
        <div className="max-w-sm mx-auto mt-24">
          <h1 className="text-2xl mb-1" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>
            Crush香鉴 · 数据后台
          </h1>
          <p className="text-xs mb-6" style={{ color: '#8A7355' }}>
            匿名埋点看板 · 不采集任何个人身份信息
          </p>
          {!enabled ? (
            <div className="rounded-xl border p-4 text-sm" style={{ borderColor: GOLD_SOFT, background: '#fff', color: INK }}>
              线上环境未配置 <code>ADMIN_PASSWORD</code>，后台已禁用。
              <br />
              在 Vercel → Settings → Environment Variables 添加后重新部署即可。
            </div>
          ) : (
            <div className="rounded-xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
              <label className="block text-xs mb-2" style={{ color: '#8A7355' }}>
                管理口令
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void login()}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: GOLD_SOFT, color: INK }}
                placeholder="请输入口令"
                autoFocus
              />
              {error && <p className="mt-2 text-xs" style={{ color: '#B4433C' }}>{error}</p>}
              <button
                onClick={() => void login()}
                className="mt-4 w-full rounded-full py-2.5 text-sm text-white"
                style={{ background: INK }}
              >
                进入看板
              </button>
              <p className="mt-3 text-[11px] leading-relaxed" style={{ color: '#A08D72' }}>
                本地开发默认口令 <code>crush2026</code>；线上请用环境变量 ADMIN_PASSWORD 覆盖。
              </p>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  if (authed === null) {
    return (
      <Shell>
        <div className="py-24 text-center text-sm" style={{ color: '#8A7355' }}>加载中…</div>
      </Shell>
    );
  }

  const totals = data?.totals ?? {};
  const done = totals.test_complete ?? 0;
  const started = totals.test_start ?? 0;
  const share = totals.share_card_generate ?? 0;

  return (
    <Shell>
      {/* 顶部 */}
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[26px] leading-tight" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>
            数据后台
          </h1>
          <p className="text-xs mt-1" style={{ color: '#8A7355' }}>
            {data ? `${data.from} ~ ${data.to}` : '—'} · 存储：{data?.driver === 'supabase' ? 'Supabase Postgres' : data?.driver === 'kv' ? 'Vercel KV / Redis' : data?.driver === 'file' ? '本地文件（dev）' : '仅日志'}
            {data?.truncated && (
              <span style={{ color: '#B4433C' }}> · 区间内事件超过单次读取上限，计数可能偏低</span>
            )}
            {data?.driver === 'file' && (
              <span style={{ color: '#B4433C' }}> · 未接数据库，数据不持久</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border overflow-hidden" style={{ borderColor: GOLD_SOFT }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className="px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: days === r.days ? INK : 'transparent',
                  color: days === r.days ? CREAM : '#6B563C',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load(days)}
            className="rounded-full border px-3 py-1.5 text-xs"
            style={{ borderColor: GOLD_SOFT, color: '#6B563C' }}
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
          <a
            href={`/api/admin/overview?days=${days}&format=csv`}
            className="rounded-full px-3 py-1.5 text-xs text-white"
            style={{ background: GOLD }}
          >
            导出 CSV
          </a>
          <button onClick={() => void logout()} className="text-xs underline" style={{ color: '#A08D72' }}>
            退出
          </button>
        </div>
      </header>

      {/* 概览卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card label="去重访客" value={num(data?.intervalUv ?? 0)} hint="区间内合并基数" />
        <Card label="累计访客" value={num(data?.uvTotal ?? 0)} hint="按天累加，含回访" />
        <Card label="新访客" value={num(data?.nvTotal ?? 0)} hint="首次出现" />
        <Card label="页面访问 PV" value={num(totals.page_view ?? 0)} />
        <Card label="完成测试" value={num(done)} hint={`开始 ${num(started)}`} />
        <Card label="完成率" value={pct(done, started)} hint={`分享率 ${pct(share, done)}`} />
      </section>

      {/* 趋势 + 漏斗 */}
      <section className="grid lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-1" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>每日趋势</h2>
          <p className="text-[11px] mb-4" style={{ color: '#A08D72' }}>金色＝页面访问 PV，墨色＝完成测试</p>
          <TrendChart trend={data?.trend ?? []} />
        </div>
        <div className="lg:col-span-2 rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>核心漏斗</h2>
          <Funnel steps={data?.funnel.main ?? []} />
        </div>
      </section>

      {/* 人格 + 来源 */}
      <section className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>人格分布</h2>
          <Bars items={data?.top.personality ?? []} color={GOLD} />
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>来源渠道</h2>
          <Bars items={data?.top.ref ?? []} color={INK} />
        </div>
      </section>

      {/* 社交 + 付费 */}
      <section className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>好友匹配</h2>
          <Funnel steps={data?.funnel.social ?? []} />
          <div className="mt-4">
            <Bars items={data?.top.tier ?? []} color="#7C6A52" />
          </div>
        </div>
        <div className="rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
          <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>付费转化</h2>
          <Funnel steps={data?.funnel.pay ?? []} />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] mb-2" style={{ color: '#A08D72' }}>档位</p>
              <Bars items={data?.top.price ?? []} color={GOLD} />
            </div>
            <div>
              <p className="text-[11px] mb-2" style={{ color: '#A08D72' }}>入口场景</p>
              <Bars items={data?.top.scene ?? []} color={INK} />
            </div>
          </div>
        </div>
      </section>

      {/* 页面分布 */}
      <section className="rounded-2xl border p-5 mb-4" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
        <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>页面访问 TOP</h2>
        <Bars items={data?.top.path ?? []} color="#8A7355" />
      </section>

      {/* 最近事件 */}
      <section className="rounded-2xl border p-5" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
        <h2 className="text-sm mb-4" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>最近事件（{data?.recent.length ?? 0}）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: '#A08D72' }}>
                <th className="text-left py-2 pr-3 font-normal">时间</th>
                <th className="text-left py-2 pr-3 font-normal">事件</th>
                <th className="text-left py-2 pr-3 font-normal">页面</th>
                <th className="text-left py-2 font-normal">属性</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((e, i) => (
                <tr key={`${e.ts}-${i}`} className="border-t" style={{ borderColor: '#F1E7D8' }}>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: '#8A7355' }}>{formatTs(e.ts)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: INK }}>{EVENT_LABEL[e.event] ?? e.event}</td>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: '#8A7355' }}>{e.path || '—'}</td>
                  <td className="py-2" style={{ color: '#8A7355' }}>
                    {e.props && Object.keys(e.props).length
                      ? Object.entries(e.props).map(([k, v]) => `${k}=${v}`).join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))}
              {!data?.recent.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center" style={{ color: '#A08D72' }}>
                    暂无数据 · 去页面点几下就会有了
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-[11px] leading-relaxed" style={{ color: '#A08D72' }}>
        全部指标基于匿名事件，不含姓名、手机、微信身份、IP 等个人信息；匿名标识仅存于用户本地浏览器。
      </p>
    </Shell>
  );
}

// ============================================================
// 子组件
// ============================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: CREAM, minHeight: '100vh' }}>
      {/* 后台页隐藏前台页脚 */}
      <style dangerouslySetInnerHTML={{ __html: 'footer{display:none!important}' }} />
      <div className="mx-auto max-w-[1180px] px-5 py-8" style={{ color: INK, fontFamily: 'Noto Sans SC, sans-serif' }}>
        {children}
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: GOLD_SOFT, background: '#fff' }}>
      <p className="text-[11px] mb-1" style={{ color: '#A08D72' }}>{label}</p>
      <p className="text-xl" style={{ fontFamily: 'Noto Serif SC, serif', color: INK }}>{value}</p>
      {hint && <p className="text-[10px] mt-1" style={{ color: '#B9A886' }}>{hint}</p>}
    </div>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return <p className="text-xs" style={{ color: '#A08D72' }}>暂无数据</p>;
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.key}>
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span style={{ color: INK }}>
              {i + 1}. {s.label}
            </span>
            <span style={{ color: '#8A7355' }}>
              {num(s.count)}
              {i > 0 && <span className="ml-2" style={{ color: GOLD }}>环比 {s.rateFromPrev}%</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full" style={{ background: '#F3EADA' }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{ width: `${(s.count / max) * 100}%`, background: i === 0 ? INK : GOLD }}
            />
          </div>
          {i > 0 && (
            <p className="text-[10px] mt-1" style={{ color: '#B9A886' }}>
              占首步 {s.rateFromTop}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Bars({ items, color }: { items: TopItem[]; color: string }) {
  if (!items.length) return <p className="text-xs" style={{ color: '#A08D72' }}>暂无数据</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.name} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs truncate" style={{ color: INK }} title={it.name}>
            {it.name}
          </span>
          <div className="flex-1 h-2 rounded-full" style={{ background: '#F3EADA' }}>
            <div className="h-2 rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: color }} />
          </div>
          <span className="w-10 text-right text-xs" style={{ color: '#8A7355' }}>{it.count}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs" style={{ color: '#A08D72' }}>
        暂无数据
      </div>
    );
  }
  const W = 720;
  const H = 200;
  const padB = 26;
  const padT = 10;
  const max = Math.max(...trend.map((t) => Math.max(t.pv, t.done)), 1);
  const slot = W / trend.length;
  const barW = Math.max(4, Math.min(18, slot / 3));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((r) => (
        <line
          key={r}
          x1={0}
          x2={W}
          y1={padT + (H - padT - padB) * r}
          y2={padT + (H - padT - padB) * r}
          stroke="#F1E7D8"
          strokeWidth={1}
        />
      ))}
      {trend.map((t, i) => {
        const x = i * slot + slot / 2;
        const h = ((H - padT - padB) * t.pv) / max;
        const h2 = ((H - padT - padB) * t.done) / max;
        return (
          <g key={t.date}>
            <title>{`${t.date} · PV ${t.pv} · UV ${t.uv} · 完成 ${t.done} · 分享 ${t.share}`}</title>
            <rect x={x - barW - 1} y={H - padB - h} width={barW} height={Math.max(h, 0)} rx={2} fill={GOLD} opacity={0.85} />
            <rect x={x + 1} y={H - padB - h2} width={barW} height={Math.max(h2, 0)} rx={2} fill={INK} />
            {(trend.length <= 16 || i % Math.ceil(trend.length / 10) === 0) && (
              <text x={x} y={H - 8} fontSize={9} fill="#A08D72" textAnchor="middle">
                {t.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
