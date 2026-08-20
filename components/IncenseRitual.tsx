'use client';

/**
 * 香烟袅袅 · 揭笺静候仪式动效（Phase 2 · ⑤）
 * - 长按「静候揭笺」的 1.5s 内，香头渐亮 + 三缕烟雾袅袅上升
 * - 纯 SVG（香炉/线香/香头）+ CSS 烟雾团（transform/opacity/blur），
 *   不做 Three.js、不做粒子系统、不做发光滤镜，符合品牌克制语法
 * - 非 active 时仅静态线香（香头暗），静候时点亮
 */
export default function IncenseRitual({ active }: { active: boolean }) {
  return (
    <div
      className="relative mx-auto pointer-events-none select-none"
      style={{ width: '120px', height: '96px' }}
      aria-hidden
    >
      {/* 香炉 + 线香 + 香头（静态形状） */}
      <svg viewBox="0 0 120 96" className="absolute inset-0" fill="none">
        {/* 香炉钵 */}
        <path
          d="M46 82 Q60 92 74 82 L71 72 Q60 80 49 72 Z"
          fill="#EADFC6"
          stroke="#C2A877"
          strokeWidth="1"
        />
        {/* 线香（斜插） */}
        <line x1="60" y1="74" x2="76" y2="22" stroke="#8B7C68" strokeWidth="2" strokeLinecap="round" />
        {/* 香头（静候时点亮） */}
        <circle
          cx="76"
          cy="20"
          r="2.6"
          fill="#C2410C"
          className={active ? 'incense-tip' : undefined}
          style={active ? undefined : { opacity: 0.3 }}
        />
      </svg>

      {/* 三缕烟雾（仅静候时升腾） */}
      {active && (
        <>
          <span className="incense-smoke" style={{ left: '71px', top: '16px', width: '10px', height: '16px' }} />
          <span className="incense-smoke incense-wisp-2" style={{ left: '80px', top: '14px', width: '8px', height: '14px' }} />
          <span className="incense-smoke incense-wisp-3" style={{ left: '76px', top: '12px', width: '9px', height: '15px' }} />
        </>
      )}
    </div>
  );
}
