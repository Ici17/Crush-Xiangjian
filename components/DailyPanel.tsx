'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  drawDaily,
  getTodayStr,
  RARITY_LABEL,
  type DailyDraw,
  type DrawnPerfume,
} from '@/lib/daily/draw';
import { drawAlmanac } from '@/lib/daily/almanac';
import { markVisited, getStreakView, RARITY_DOT, type StreakView } from '@/lib/daily/history';
import ScentCodex from '@/components/ScentCodex';
import PerfumeBottleShowcase from '@/components/PerfumeBottleShowcase';

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
const NOTE_KEY = (date: string) => `crush_daily_note_${date}`;
const NOTE_MAX = 20;

/**
 * 今日香签面板（「静候·揭笺」交互）
 * - 顶部胶囊切到「今日香签」时挂载
 * - 长按 1.5s 静候 → 三笺逐张启笺
 * - 已揭状态按日期存 localStorage，当日重进直接展示
 */
export default function DailyPanel() {
  const today = getTodayStr();
  const draw: DailyDraw = drawDaily(today);
  const almanac = useMemo(() => drawAlmanac(today), [today]);

  const [revealed, setRevealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [view, setView] = useState<'draw' | 'codex'>('draw');
  const [note, setNote] = useState('');
  const [streak, setStreak] = useState<StreakView | null>(null);
  const [frozeGap, setFrozeGap] = useState(false);
  const [grantedFreeze, setGrantedFreeze] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as { date: string; revealed: boolean };
        if (obj.date === today && obj.revealed) {
          setRevealed(true);
          const r = markVisited(today);
          setStreak(r.view);
          setFrozeGap(r.frozeGap);
          setGrantedFreeze(r.grantedFreeze);
        }
      }
      const rawNote = localStorage.getItem(NOTE_KEY(today));
      if (rawNote) setNote(rawNote);
      if (!revealed) setStreak(getStreakView(today));
    } catch {
      /* ignore */
    }
  }, [today]);

  const saveNote = (v: string) => {
    const clipped = v.slice(0, NOTE_MAX);
    setNote(clipped);
    try {
      localStorage.setItem(NOTE_KEY(today), clipped);
    } catch {
      /* ignore */
    }
  };

  const reveal = () => {
    setRevealed(true);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ date: today, revealed: true }));
    } catch {
      /* ignore */
    }
    const r = markVisited(today);
    setStreak(r.view);
    setFrozeGap(r.frozeGap);
    setGrantedFreeze(r.grantedFreeze);
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
      {view === 'codex' ? (
        <ScentCodex onBack={() => setView('draw')} />
      ) : (
      <>
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

      {/* ── 今日宜忌 · 留白（揭笺后第二屏） ── */}
      {revealed && (
        <div
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: 'rgba(168,136,78,0.35)', background: '#FBF6EE' }}
        >
          <div className="text-center" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#2C1810' }}>
              今日宜忌
            </div>
            <div style={{ fontSize: '10.5px', color: '#B6A892', marginTop: '4px' }}>
              一时一笺的情绪注脚
            </div>
          </div>

          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <div style={{ fontSize: '11px', color: '#A8884E', letterSpacing: '0.1em' }}>宜</div>
              {almanac.yi.map((x, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '12.5px',
                    color: '#2C1810',
                    lineHeight: 1.7,
                    marginTop: i === 0 ? 4 : 0,
                  }}
                >
                  {x}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <div style={{ fontSize: '11px', color: '#9A8E7C', letterSpacing: '0.1em' }}>忌</div>
              {almanac.ji.map((x, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '12.5px',
                    color: '#6B5E4C',
                    lineHeight: 1.7,
                    marginTop: i === 0 ? 4 : 0,
                  }}
                >
                  {x}
                </div>
              ))}
            </div>
          </div>

          <div
            className="text-center mt-3"
            style={{ fontSize: '12px', color: '#8B7C68', lineHeight: 1.6, fontStyle: 'italic' }}
          >
            {almanac.note}
          </div>

          {/* 留白：绑定今日香，限 20 字 */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(168,136,78,0.3)' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '11px', color: '#8B7C68', letterSpacing: '0.1em' }}>留白 · 写一句今日</span>
              <span style={{ fontSize: '10px', color: '#B6A892' }}>
                {note.length}/{NOTE_MAX}
              </span>
            </div>
            <input
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => saveNote(e.target.value)}
              placeholder="这一笺，落在了你哪段日子？"
              className="w-full mt-2 bg-transparent outline-none"
              style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '13px', color: '#2C1810' }}
            />
          </div>
        </div>
      )}

      {/* ── 香气历 · 连续静候 ── */}
      {revealed && streak && (
        <div
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: 'rgba(168,136,78,0.35)', background: '#FBF6EE' }}
        >
          <div className="flex items-end justify-between">
            <div>
              <div style={{ fontSize: '11px', color: '#B6A892', letterSpacing: '0.2em' }}>连续静候</div>
              <div style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '30px', color: '#2C1810', lineHeight: 1.1, marginTop: '2px' }}>
                {streak.current}
                <span style={{ fontSize: '13px', color: '#8B7C68', marginLeft: '4px' }}>日</span>
              </div>
            </div>
            {streak.title.rank > 0 && (
              <div
                className="self-start"
                style={{ fontSize: '12px', color: '#A8884E', border: '1px solid #A8884E', borderRadius: '4px', padding: '3px 8px', letterSpacing: '0.1em' }}
              >
                {streak.title.name}
              </div>
            )}
          </div>

          {frozeGap && (
            <div style={{ fontSize: '11px', color: '#A8884E', marginTop: '8px' }}>昨日未至，已为你续上一签。</div>
          )}
          {grantedFreeze && (
            <div style={{ fontSize: '11px', color: '#A8884E', marginTop: '8px' }}>静候满七日，赠你一枚续签。</div>
          )}

          {/* 月历墨点 */}
          <div className="mt-3">
            <div className="flex justify-between" style={{ fontSize: '10px', color: '#B6A892', marginBottom: '6px' }}>
              <span>{today.slice(0, 7).replace('-', '.')}</span>
              <span>续签 ×{streak.freezes}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {streak.monthGrid.map((c, i) => {
                if (c.kind === 'empty') return <div key={i} />;
                if (c.kind === 'future') return <div key={i} style={{ height: '14px' }} />;
                const full = `${today.slice(0, 7)}-${String(c.day).padStart(2, '0')}`;
                if (c.kind === 'today') {
                  const r = RARITY_DOT[drawDaily(full).main.rarity];
                  return (
                    <div key={i} className="flex items-center justify-center" style={{ height: '14px' }}>
                      <div
                        style={{
                          width: '12px', height: '12px', borderRadius: '50%',
                          border: '1.5px solid #A8884E',
                          background: r,
                        }}
                      />
                    </div>
                  );
                }
                if (c.kind === 'missed') {
                  return (
                    <div key={i} className="flex items-center justify-center" style={{ height: '14px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', border: '1px solid #D8CFC0' }} />
                    </div>
                  );
                }
                const r = RARITY_DOT[drawDaily(full).main.rarity];
                return (
                  <div key={i} className="flex items-center justify-center" style={{ height: '14px' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: r }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 图鉴入口 */}
      <button
        onClick={() => setView('codex')}
        className="block w-full mt-4 rounded-full py-3 text-[14px] font-medium text-center"
        style={{
          fontFamily: 'Noto Sans SC, sans-serif',
          background: 'transparent',
          color: '#A8884E',
          border: '1px solid rgba(168,136,78,0.5)',
        }}
      >
        香气图鉴 · 十六种本命 →
      </button>

      {/* 克制的结语（避开运势话术） */}
      <p
        className="text-center mt-4"
        style={{ fontSize: '11px', color: '#B6A892', lineHeight: 1.7 }}
      >
        香签是今日的一缕灵感，不是预言。<br />
        愿你今日，被某种气息轻轻接住。
      </p>

      {/* 今日之瓶 · 香水瓶演示（揭笺后浮现，填补底部留白） */}
      {revealed && (
        <PerfumeBottleShowcase
          name={draw.main.name}
          brandCn={draw.main.brandCn}
          rarity={draw.main.rarity}
          revealed={revealed}
        />
      )}
      </>
      )}
    </div>
  );
}
