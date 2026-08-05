'use client';

import React from 'react';

/**
 * 香调偏好进度条（共享组件）
 * 锁定版 / 解锁版共用同一套视觉与逻辑
 * - 自动识别 value 是 0-1 还是 0-100
 * - 自动按分数排序，主维强调
 */
export interface ScentPreferenceBarProps {
  /** 维度 -> 数值（0-1 或 0-100 均可） */
  data: Record<string, number>;
  /** 维度中文名（key 已经是中文时无需传） */
  dimLabels?: Record<string, string>;
}

export function ScentPreferenceBar({ data, dimLabels }: ScentPreferenceBarProps) {
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return null;
  const topDim = sorted[0][0];

  return (
    <div className="space-y-3" data-version="v2.1">
      {sorted.map(([dim, value]) => {
        const percent = value > 1 ? Math.round(value) : Math.round(value * 100);
        const clamped = Math.max(0, Math.min(100, percent));
        const isTop = dim === topDim;
        const label = dimLabels?.[dim] ?? dim;
        return (
          <div
            key={dim}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={
              isTop
                ? { background: '#FAF1E4', border: '1px solid #E8C99A' }
                : { background: '#FBF7F2' }
            }
          >
            <span
              className={isTop ? 'text-sm font-semibold w-10 shrink-0' : 'text-sm w-10 shrink-0'}
              style={{ color: isTop ? '#7A4A2A' : '#8B7355' }}
            >
              {label}
            </span>
            <div
              className="flex-1 h-3 rounded-full overflow-hidden relative"
              style={{ background: '#F0E8DC', border: '1px solid #E8D9C4' }}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${clamped}%`,
                  minWidth: clamped > 0 ? '8px' : '0',
                  background: isTop
                    ? 'linear-gradient(90deg, #B8612C 0%, #C8956B 100%)'
                    : '#A89570',
                  boxShadow: isTop ? '0 0 6px rgba(184,97,44,0.4)' : 'none',
                }}
              />
            </div>
            <span
              className={isTop ? 'text-base font-bold w-9 text-right' : 'text-sm w-9 text-right'}
              style={{ color: isTop ? '#B8612C' : '#8B7355' }}
            >
              {clamped}
            </span>
          </div>
        );
      })}
    </div>
  );
}
