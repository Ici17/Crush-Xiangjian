'use client';

import { useMemo } from 'react';
import { getCpResonance } from '@/lib/cpResonance';

const SEAL_COLOR: Record<string, string> = {
  隐: '#2C1810',
  雅: '#A8884E',
  常: '#8B7C68',
};

/**
 * 合香卡（Phase 2 · ⑥ CP 共振）
 * - 两人本命守护香融合成一支「合香」：合香名 + 三调 + 差几调 + 合香印 + 解读
 * - 确定性：同一对永远同一支合香，是好友匹配结果态的传播核心产物
 * - 合规：合香 = 审美侧写（你们合起来是什么味道），无命定/缘分断言
 */
export default function CpBlendCard({
  nameA,
  nameB,
  onShare,
  footnote,
}: {
  nameA: string;
  nameB: string;
  /** 提供则在卡底渲染「分享这张合香卡」按钮（分享逻辑由父组件持有）*/
  onShare?: () => void;
  /** 卡底小字（如预览态「你收到一张合香卡」）*/
  footnote?: string;
}) {
  const cp = useMemo(() => getCpResonance(nameA, nameB), [nameA, nameB]);

  if (!cp) return null;

  const sealColor = SEAL_COLOR[cp.seal] ?? '#8B7C68';
  const diffLabel = cp.diffTones === 0 ? '同调' : `隔 ${cp.diffTones} 调`;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'rgba(168,136,78,0.45)',
        background: 'linear-gradient(160deg, #FCF7EE 0%, #F6EDDF 100%)',
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: '11px', letterSpacing: '0.25em', color: '#A8884E' }}>
          你们的合香
        </span>
        <span style={{ fontSize: '11px', color: '#8B7C68' }}>
          {cp.toneA} × {cp.toneB} · {diffLabel}
        </span>
      </div>

      {/* 合香名 */}
      <div
        style={{
          fontFamily: 'Noto Serif SC, serif',
          fontSize: '26px',
          color: '#2C1810',
          letterSpacing: '0.06em',
          lineHeight: 1.2,
        }}
      >
        {cp.blendName}
      </div>

      {/* 合香印 */}
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className="inline-flex"
          style={{
            fontSize: '11px',
            color: sealColor,
            border: `1px solid ${sealColor}`,
            borderRadius: '4px',
            padding: '1px 6px',
          }}
        >
          合香印 · {cp.seal}
        </span>
      </div>

      {/* 三调 */}
      <div className="mt-3 space-y-1.5">
        {([
          ['前调', cp.top],
          ['中调', cp.heart],
          ['后调', cp.base],
        ] as [string, string[]][]).map(([label, notes]) => (
          <div key={label} className="flex gap-2 items-baseline">
            <span style={{ fontSize: '11px', color: '#8B7C68', width: '26px', flexShrink: 0 }}>
              {label}
            </span>
            <span style={{ fontSize: '12.5px', color: '#2C1810', lineHeight: 1.5 }}>
              {notes.join(' · ')}
            </span>
          </div>
        ))}
      </div>

      {/* 合香解读 */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(168,136,78,0.35)' }}>
        <p style={{ fontSize: '12.5px', color: '#8B6F5C', fontStyle: 'italic', lineHeight: 1.7 }}>
          「{cp.line}」
        </p>
      </div>

      {/* 卡底：分享 / 小字 */}
      {(onShare || footnote) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {footnote ? (
            <span style={{ fontSize: '11px', color: '#A8884E' }}>{footnote}</span>
          ) : (
            <span />
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="shrink-0 px-4 py-2 rounded-full font-sans text-xs font-medium transition-all active:scale-95"
              style={{
                color: '#FAF3EA',
                background: '#2C1810',
              }}
            >
              分享这张合香卡 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
