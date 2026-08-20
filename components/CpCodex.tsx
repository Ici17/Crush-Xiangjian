'use client';

import { useEffect, useState } from 'react';
import { PERSONALITIES } from '@/lib/personalities';
import { getCpResonance } from '@/lib/cpResonance';
import { isCpLit, getCpLitCount, CP_TOTAL } from '@/lib/cpCodex';
import { getMyPersonalityId, encodeInvite } from '@/lib/inviteState';
import CpBlendCard from '@/components/CpBlendCard';

const SEAL_COLOR: Record<string, string> = {
  隐: '#2C1810',
  雅: '#A8884E',
  常: '#B6A892',
};

type Detail = { a: string; b: string; lit: boolean } | null;

/**
 * 气味 CP 图鉴（⑦-B · 256 点亮式）
 * - 16×16 有序格：行=我的人格，列=朋友的人格
 * - 实际匹配出某对 → 该格点亮（A×B 与 B×A 同亮）
 * - 纯收集、纯审美、纯免费：未相遇的格只是「未相遇」剪影，不付费、不强制分享
 */
export default function CpCodex() {
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);

  useEffect(() => setMounted(true), []);

  const meId = mounted ? getMyPersonalityId() : null;
  const litCount = mounted ? getCpLitCount() : 0;
  const pct = Math.round((litCount / CP_TOTAL) * 100);

  return (
    <div className="min-h-dvh bg-cream pb-12">
      {/* 顶部 */}
      <div className="px-5 pt-safe-top pt-6 pb-4">
        <h1
          className="font-serif font-medium text-amber-950"
          style={{ fontSize: '20px', letterSpacing: '0.05em' }}
        >
          气味 CP 图鉴
        </h1>
        <p className="text-amber-600/70 font-sans mt-1" style={{ fontSize: '13px' }}>
          每一次合香，都在图鉴里点亮一格
        </p>
      </div>

      {/* 进度 */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-serif font-semibold text-amber-900 text-sm">
            已点亮 {litCount} / {CP_TOTAL}
          </span>
          <span className="text-amber-500/70 font-sans text-xs">{pct}%</span>
        </div>
        <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-amber-400/60 font-sans text-[11px] mt-1.5">
          每认识一位新朋友，点亮 TA 与你两个方向的两格
        </p>
      </div>

      {/* 网格 */}
      <div className="px-3">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${PERSONALITIES.length}, minmax(0, 1fr))` }}
        >
          {PERSONALITIES.map((row) =>
            PERSONALITIES.map((col) => {
              const lit = mounted && isCpLit(row.name, col.name);
              const isSelf = row.name === col.name;
              const seal = lit
                ? (() => {
                    const cp = getCpResonance(row.name, col.name);
                    return cp ? SEAL_COLOR[cp.seal] ?? '#B6A892' : '#B6A892';
                  })()
                : '#E5D9C7';
              return (
                <button
                  key={`${row.name}|${col.name}`}
                  onClick={() => setDetail({ a: row.name, b: col.name, lit })}
                  title={
                    lit
                      ? `${row.name} × ${col.name}`
                      : isSelf
                      ? `${row.name} · 本命独调（未相遇）`
                      : `未相遇 · ${row.name} × ${col.name}`
                  }
                  className="aspect-square rounded-md flex items-center justify-center transition-transform active:scale-90"
                  style={{
                    background: lit ? 'rgba(168,136,78,0.12)' : 'rgba(168,136,78,0.04)',
                    border: lit ? '1px solid rgba(168,136,78,0.4)' : '1px solid rgba(168,136,78,0.12)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: '58%',
                      height: '58%',
                      background: lit ? seal : isSelf ? 'repeating-linear-gradient(45deg,#E5D9C7,#E5D9C7 2px,#D8C9B0 2px,#D8C9B0 4px)' : '#E5D9C7',
                      opacity: lit ? 1 : 0.7,
                    }}
                  />
                </button>
              );
            }),
          )}
        </div>

        {/* 列标签（朋友轴，简化：仅首尾） */}
        <div className="mt-2 text-center">
          <p className="text-amber-400/50 font-sans text-[10px] tracking-widest">
            行 · 我的 16 人格　|　列 · 朋友的 16 人格
          </p>
        </div>
      </div>

      {/* 详情弹层 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ backgroundColor: 'rgba(44,24,16,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal
        >
          <div
            className="bg-[#FAF3EA] rounded-3xl w-full max-w-sm overflow-hidden p-5"
            style={{ boxShadow: '0 20px 60px rgba(44,24,16,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-serif font-semibold text-amber-900 text-base">
                {detail.a} <span className="text-amber-400 mx-1">×</span> {detail.b}
              </span>
              <button
                onClick={() => setDetail(null)}
                className="text-amber-400/60 font-sans text-sm"
              >
                ✕
              </button>
            </div>

            {detail.lit ? (
              <CpBlendCard nameA={detail.a} nameB={detail.b} />
            ) : (
              <div className="text-center py-6">
                <div className="text-4xl mb-3 opacity-40">🌫</div>
                <p className="text-amber-700 font-serif text-sm mb-1">
                  这一格还未相遇
                </p>
                <p className="text-amber-500/70 font-sans text-xs leading-relaxed mb-4">
                  还没有和「{detail.b}」合香过。<br />
                  邀请一位朋友来测，点亮这一格。
                </p>
                {meId && (
                  <button
                    onClick={() => {
                      const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/friend?inv=${encodeInvite(meId)}`;
                      navigator.clipboard?.writeText(link);
                      setDetail(null);
                    }}
                    className="w-full py-3 bg-amber-800 text-amber-50 rounded-full font-sans font-semibold text-sm active:scale-95 transition-transform"
                  >
                    复制我的邀请链接
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
