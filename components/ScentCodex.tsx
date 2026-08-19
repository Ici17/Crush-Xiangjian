'use client';

import { useMemo } from 'react';
import {
  PERSONALITIES,
  getGuardianPerfume,
  type GuardianPerfume,
  type Personality,
} from '@/lib/personalities';
import { useMyTestStatus } from '@/lib/useMyTestStatus';

// 守护印配色（与每日香签金印共用视觉语言）
const SEAL_COLOR: Record<string, string> = {
  隐: '#2C1810', // 墨 · 深邃内敛
  雅: '#A8884E', // 金 · 有故事感
  常: '#8B7C68', // 赭 · 明亮外放
};

function SealBadge({ seal, own }: { seal: string; own: boolean }) {
  const color = SEAL_COLOR[seal] ?? '#8B7C68';
  return (
    <div
      className="shrink-0 self-start"
      style={{
        fontSize: '12px',
        color,
        border: `1px solid ${color}`,
        borderRadius: '4px',
        padding: '1px 6px',
        background: own ? 'rgba(168,136,78,0.08)' : 'transparent',
      }}
    >
      {seal}
    </div>
  );
}

function GuardianCard({ name, g, own }: { name: string; g: GuardianPerfume; own: boolean }) {
  return (
    <div
      className="rounded-2xl border p-3.5 flex flex-col"
      style={{
        borderColor: own ? '#A8884E' : 'rgba(42,33,27,0.12)',
        background: own ? '#FCF7EE' : '#FBF6EE',
        boxShadow: own ? '0 2px 10px rgba(168,136,78,0.12)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div style={{ fontSize: '11px', color: '#8B7C68', letterSpacing: '0.15em' }}>
            本命 · {name}
          </div>
          <div
            className="truncate"
            style={{ fontFamily: 'Noto Serif SC, serif', fontSize: '16px', color: '#2C1810', marginTop: '2px' }}
          >
            {g.name}
          </div>
          <div style={{ fontSize: '11px', color: '#8B7C68', marginTop: '1px' }}>
            {g.brandCn}
          </div>
        </div>
        <SealBadge seal={g.seal} own={own} />
      </div>

      <div
        style={{
          fontSize: '11.5px',
          color: '#A89A86',
          lineHeight: 1.6,
          marginTop: '8px',
          fontStyle: 'italic',
        }}
      >
        「{g.line}」
      </div>

      <div
        className="mt-auto pt-2"
        style={{
          fontSize: '10.5px',
          color: own ? '#A8884E' : '#B6A892',
          letterSpacing: '0.08em',
        }}
      >
        {own ? '✦ 已认领' : '待相遇'}
      </div>
    </div>
  );
}

/**
 * 香气图鉴（Phase 1 · 纯前端）
 * - 16 种本命守护香谱系总览（品牌 IP 资产）
 * - 用户自身人格自动「认领」高亮；其余标「待相遇」，为后续 CP 匹配收集埋点
 * - 无后端：认领数 = 已完成测试则 1，否则 0（相遇解锁为后续社交功能）
 */
export default function ScentCodex({ onBack }: { onBack?: () => void }) {
  const myStatus = useMyTestStatus();
  const mine = myStatus.personalityName;

  const guardians = useMemo(
    () =>
      (PERSONALITIES as readonly Personality[])
        .map((p) => {
          const name = p.name as string;
          const g = getGuardianPerfume(name);
          return { name, g };
        })
        .filter((x) => x.g !== null) as { name: string; g: GuardianPerfume }[],
    [],
  );

  const claimed = myStatus.completed && mine ? 1 : 0;

  return (
    <div className="px-5 pt-2 pb-10 animate-fadeIn">
      {/* 标题区 */}
      <div className="text-center" style={{ fontFamily: 'Noto Serif SC, serif' }}>
        <div style={{ fontSize: '17px', letterSpacing: '0.3em', color: '#2C1810' }}>
          · 香气图鉴 ·
        </div>
        <div style={{ fontSize: '12px', color: '#8B7C68', marginTop: '6px' }}>
          十六种气息，各有本命守护
        </div>
      </div>

      {/* 进度 + 认领引导 */}
      <div
        className="mt-4 rounded-2xl border px-4 py-3"
        style={{ borderColor: 'rgba(42,33,27,0.12)', background: '#FBF6EE' }}
      >
        <div className="flex items-center justify-between">
          <span style={{ fontSize: '12px', color: '#2C1810' }}>
            已认领本命 <span style={{ color: '#A8884E', fontWeight: 600 }}>{claimed}</span> / 16
          </span>
          {!myStatus.completed && (
            <span style={{ fontSize: '11px', color: '#8B7C68' }}>测一测认领你的本命</span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: '#B6A892', marginTop: '6px', lineHeight: 1.6 }}>
          与好友相遇，可解锁对方气息的专属解读。
        </p>
      </div>

      {/* 图鉴网格 */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {guardians.map(({ name, g }) => (
          <GuardianCard key={name} name={name} g={g} own={name === mine} />
        ))}
      </div>

      {/* 合规脚注 */}
      <p
        className="text-center mt-5"
        style={{ fontSize: '10.5px', color: '#B6A892', lineHeight: 1.7 }}
      >
        本命守护香是气味侧写，不是命理断言。<br />
        你与哪支香契合，由你自己的气息决定。
      </p>

      {onBack && (
        <button
          onClick={onBack}
          className="block w-full mt-4 rounded-full py-3 text-[14px] font-medium text-center"
          style={{ fontFamily: 'Noto Sans SC, sans-serif', background: '#2C1810', color: '#FAF3EA' }}
        >
          ← 返回今日香签
        </button>
      )}
    </div>
  );
}
