'use client';

import { useMemo } from 'react';
import { getGuardianPerfume } from '@/lib/personalities';
import PerfumeBottle from '@/components/PerfumeBottle';

// 守护印配色（与香气图鉴 / 每日香签金印共用同一视觉语言）
// 隐=深邃内敛 | 雅=有故事感 | 常=明亮外放
const SEAL_COLOR: Record<string, string> = {
  隐: '#2C1810',
  雅: '#A8884E',
  常: '#8B7C68',
};

/**
 * 本命守护香 · 常驻展示卡（待办 ④）
 * - 16 人格各自唯一锚定一支 premium 香（互不重复），测完结果页立刻可见
 * - 位置：揭晓区之后、锁定/解锁分支之外 → 两态常驻，与「本命香水」三支动态推荐区分：
 *   守护香 = 身份锚点（你是谁的气息底色），本命香水 = 购物向推荐
 * - 合规：外壳为「守护/锚定」语义，内核为气味契合，无吉凶/转运/桃花表述
 */
export default function GuardianScentCard({ personalityName }: { personalityName: string }) {
  const guardian = useMemo(() => getGuardianPerfume(personalityName), [personalityName]);

  if (!guardian) return null;

  const sealColor = SEAL_COLOR[guardian.seal] ?? '#8B7C68';

  return (
    <section className="px-6 pt-4 animate-fadeIn" aria-label="本命守护香">
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: 'rgba(168,136,78,0.35)',
          background: 'linear-gradient(135deg, #FCF7EE 0%, #F6EDDF 100%)',
        }}
      >
        <div className="flex items-center gap-4">
          {/* 左：香水瓶线稿（金色 + 高光，作视觉锚点） */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: '76px',
              height: '106px',
              background: 'rgba(168,136,78,0.07)',
              borderRadius: '16px',
            }}
          >
            <PerfumeBottle className="w-11 h-[72px]" glow stroke="#A8884E" />
          </div>

          {/* 右：身份文案 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                style={{ fontSize: '11px', letterSpacing: '0.22em', color: '#A8884E', fontFamily: 'Noto Sans SC, sans-serif' }}
              >
                本命守护香
              </span>
              {/* 守护印 */}
              <span
                className="shrink-0"
                style={{
                  fontSize: '11px',
                  color: sealColor,
                  border: `1px solid ${sealColor}`,
                  borderRadius: '4px',
                  padding: '0 5px',
                  lineHeight: '16px',
                }}
              >
                {guardian.seal}
              </span>
            </div>

            <div
              className="font-serif font-medium truncate"
              style={{ fontSize: '20px', color: '#3D2817', letterSpacing: '0.04em' }}
            >
              {guardian.name}
            </div>

            <div style={{ fontSize: '11px', color: '#8B5E3C', marginTop: '2px' }}>
              {guardian.brandCn} · 气息契合 {guardian.match}%
            </div>

            <div
              className="italic mt-1.5"
              style={{ fontSize: '12px', color: '#8B6F5C', lineHeight: 1.6 }}
            >
              「{guardian.line}」
            </div>

            {/* 契合度细条 */}
            <div className="mt-2 flex items-center gap-2">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(168,136,78,0.15)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${guardian.match}%`,
                    background: 'linear-gradient(90deg, #D4A574, #A8884E)',
                  }}
                />
              </div>
              <span style={{ fontSize: '10px', color: '#A8884E' }}>{guardian.match}%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
