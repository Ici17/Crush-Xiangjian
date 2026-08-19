'use client';

import { useEffect, useRef, useState } from 'react';
import {
  drawDaily,
  getTodayStr,
  RARITY_LABEL,
  type DailyDraw,
  type DrawnPerfume,
} from '@/lib/daily/draw';

const WEEKDAYS = '日一二三四五六';

function weekdayCN(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, day).getDay()];
}

function notesLine(p: DrawnPerfume): string {
  const t = p.notes.top.join('·');
  const h = p.notes.heart.join('·');
  const b = p.notes.base.join('·');
  return `前 ${t} ｜ 中 ${h} ｜ 后 ${b}`;
}

const STORE_KEY = 'crush_daily';

/**
 * 今日香签面板（「静候·揭笺」交互）
 * - 顶部胶囊切到「今日香签」时挂载
 * - 长按 1.5s 静候 → 三笺逐张启笺
 * - 已揭状态按日期存 localStorage，当日重进直接展示
 */
export default function DailyPanel() {
  const today = getTodayStr();
  const draw: DailyDraw = drawDaily(today);

  const [revealed, setRevealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as { date: string; revealed: boolean };
        if (obj.date === today && obj.revealed) setRevealed(true);
      }
    } catch {
      /* ignore */
    }
  }, [today]);

  const reveal = () => {
    setRevealed(true);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ date: today, revealed: true }));
    } catch {
      /* ignore */
    }
  };

  const startHold = () => {
    if (revealed) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      reveal();
    }, 1500);
  };

  const endHold = () => {
    setHolding(false);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // 视觉顺序：启示 / 主香 / 启示（主香居中）
  const cards: { p: DrawnPerfume; label: string; main: boolean }[] = [
    { p: draw.inspirations[0], label: '启示', main: false },
    { p: draw.main, label: '主香', main: true },
    { p: draw.inspirations[1], label: '启示', main: false },
  ];

  const shareUrl = `/api/share-card?scene=daily&date=${today}&format=1to1`;

  return (
    <div className="px-5 pt-2 pb-10 animate-fadeIn">
      {/* 标题区 */}
      <div className="text-center" style={{ fontFamily: 'Noto Serif SC, serif' }}>
        <div style={{ fontSize: '17px', letterSpacing: '0.3em', color: '#2C1810' }}>
          · 今日香签 ·
        </div>
        <div style={{ fontSize: '12px', color: '#8B7C68', marginTop: '6px' }}>
          {today.replace(/-/g, '.')} 星期{weekdayCN(today)} ｜ 全员今日共此一笺
        </div>
      </div>

      {/* 三笺 */}
      <div className="flex gap-2.5 justify-center mt-6">
        {cards.map((c, i) => {
          const stamp = RARITY_LABEL[c.p.rarity];
          return (
            <div
              key={i}
              className="relative flex-1 rounded-xl border overflow-hidden"
              style={{
                borderColor: c.main ? '#A8884E' : 'rgba(42,33,27,0.14)',
                background: '#F8F2E8',
                minHeight: 208,
                opacity: revealed ? 1 : 0.5,
                transform: revealed ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity .8s ease ${i * 0.18}s, transform .8s ease ${i * 0.18}s`,
              }}
            >
              {/* 封印态 */}
              {!revealed && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: '#C2A877' }}
                >
                  <div
                    className="w-10 h-10 rounded-full border flex items-center justify-center"
                    style={{ borderColor: '#C2A877', fontSize: '13px' }}
                  >
                    签
                  </div>
                </div>
              )}

              {/* 揭笺态 */}
              {revealed && (
                <div className="p-3 flex flex-col h-full text-center">
                  <div style={{ fontSize: '11px', color: '#8B7C68', letterSpacing: '0.2em' }}>
                    {c.label}
                  </div>
                  {stamp ? (
                    <div
                      className="self-center mt-1"
                      style={{
                        fontSize: '12px',
                        color: '#A8884E',
                        border: '1px solid #A8884E',
                        borderRadius: '4px',
                        padding: '1px 6px',
                      }}
                    >
                      {stamp}
                    </div>
                  ) : (
                    <div style={{ height: '20px' }} />
                  )}
                  <div
                    style={{
                      fontFamily: 'Noto Serif SC, serif',
                      fontSize: c.main ? '18px' : '15px',
                      color: '#2C1810',
                      marginTop: '6px',
                      lineHeight: 1.3,
                    }}
                  >
                    {c.p.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8B7C68', marginTop: '4px' }}>
                    {c.p.brandCn}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#A89A86',
                      marginTop: 'auto',
                      lineHeight: 1.5,
                    }}
                  >
                    {notesLine(c.p)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 提示 */}
      <div className="text-center mt-5" style={{ fontSize: '12px', color: '#8B7C68' }}>
        {revealed ? '今日已揭 · 明日再来' : '长按静候，揭今日一笺'}
      </div>

      {/* 主操作 */}
      {!revealed ? (
        <button
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          className="w-full mt-3 rounded-full py-3.5 text-[15px] font-medium select-none"
          style={{
            fontFamily: 'Noto Sans SC, sans-serif',
            background: holding ? '#2C1810' : '#A8884E',
            color: '#FAF3EA',
            transition: 'background .2s ease',
            touchAction: 'none',
          }}
          aria-label="长按静候揭笺"
        >
          {holding ? '静候中…' : '静候揭笺'}
        </button>
      ) : (
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-3 rounded-full py-3.5 text-[15px] font-medium text-center"
          style={{ fontFamily: 'Noto Sans SC, sans-serif', background: '#2C1810', color: '#FAF3EA' }}
        >
          分享今日香签 →
        </a>
      )}

      {/* 克制的结语（避开运势话术） */}
      <p
        className="text-center mt-4"
        style={{ fontSize: '11px', color: '#B6A892', lineHeight: 1.7 }}
      >
        香签是今日的一缕灵感，不是预言。<br />
        愿你今日，被某种气息轻轻接住。
      </p>
    </div>
  );
}
