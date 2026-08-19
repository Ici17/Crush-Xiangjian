'use client';

import { useEffect, useState } from 'react';
import type { Rarity } from '@/lib/daily/draw';

type Props = {
  name: string;
  brandCn: string;
  rarity: Rarity;
  revealed: boolean;
};

// 液体配色：常=暖蜜 / 雅=柔玫 / 隐=深紫
const LIQUID: Record<Rarity, { from: string; to: string; glow: string }> = {
  chang: { from: '#E2C07C', to: '#B8893F', glow: 'rgba(226,192,124,0.38)' },
  ya: { from: '#D7A2A6', to: '#A86A6A', glow: 'rgba(215,162,166,0.38)' },
  yin: { from: '#7E6DAE', to: '#4A3D6B', glow: 'rgba(126,109,174,0.38)' },
};

// 瓶身轮廓（与 PerfumeBottle 同源，中心 256,256）
const BOTTLE_PATH =
  'M -35 -180 L 35 -180 Q 45 -180 45 -170 L 45 -155 L 35 -140 L 30 -100 ' +
  'L 55 -60 Q 75 0 75 60 Q 75 140 0 200 Q -75 140 -75 60 Q -75 0 -55 -60 ' +
  'L -30 -100 L -35 -140 L -45 -155 L -45 -170 Q -45 -180 -35 -180 Z';

/**
 * 今日香签 · 今日之瓶
 * 揭笺后底部出现的「香水瓶演示」：瓶中液体随当日主香升起，
 * 瓶口飘散三缕香气，下方落款主香名姓——既填补底部留白，
 * 又把「今日一笺」收束成一件可凝视的小物。
 */
export default function PerfumeBottleShowcase({ name, brandCn, rarity, revealed }: Props) {
  const liquid = LIQUID[rarity];
  const uid = `pb-${rarity}`;
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="mt-7 flex flex-col items-center animate-fadeIn">
      <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '13px', letterSpacing: '0.3em', color: '#A8884E' }}>
        · 今日之瓶 ·
      </div>

      <div className="relative mt-3" style={{ width: 140, height: 200 }}>
        {/* 瓶后暖光晕 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 150,
            height: 150,
            background: `radial-gradient(circle, ${liquid.glow} 0%, rgba(255,255,255,0) 70%)`,
          }}
        />

        <svg viewBox="0 0 512 512" width="140" height="200" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-liq`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={liquid.from} />
              <stop offset="100%" stopColor={liquid.to} />
            </linearGradient>
            <clipPath id={`${uid}-clip`}>
              <path d={BOTTLE_PATH} />
            </clipPath>
          </defs>

          {/* 液体：裁剪进瓶身，从底缓缓升起 */}
          <g clipPath={`url(#${uid}-clip)`}>
            <g
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'bottom',
                transform: filled ? 'scaleY(1)' : 'scaleY(0.04)',
                transition: 'transform 1.3s cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <rect x="-80" y="-100" width="160" height="300" fill={`url(#${uid}-liq)`} />
              <ellipse cx="0" cy="-100" rx="70" ry="6" fill="rgba(255,255,255,0.35)" />
            </g>
          </g>

          {/* 瓶身线稿（金线） */}
          <g
            transform="translate(256,256)"
            stroke="#A8884E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d={BOTTLE_PATH} />
            <path d="M 0 20 L -25 -80" opacity={0.8} strokeWidth={2} />
            <path d="M 0 20 L 25 -80" opacity={0.8} strokeWidth={2} />
          </g>

          {/* 瓶口飘散的三缕香气 */}
          {revealed && (
            <g stroke="#C2A877" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6">
              <path className="scent-wisp" d="M 246 72 q -10 -16 0 -30 q 10 -14 0 -28" />
              <path className="scent-wisp-2" d="M 256 70 q 12 -14 0 -28 q -12 -14 0 -28" />
              <path className="scent-wisp" d="M 266 72 q 10 -16 0 -30 q -10 -14 0 -28" style={{ animationDelay: '0.8s' }} />
            </g>
          )}
        </svg>
      </div>

      <div className="text-center mt-1">
        <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '15px', color: '#2C1810' }}>{name}</div>
        <div style={{ fontSize: '11px', color: '#8B7C68', marginTop: '2px' }}>{brandCn}</div>
      </div>
    </div>
  );
}
