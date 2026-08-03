type Props = {
  /** 人格名称（必须匹配 lib/personalities.ts v2 16 字之一） */
  name: string;
  /** Tailwind className */
  className?: string;
};

/**
 * Crush香鉴 16 人格差异化几何图标（v2 命名系统）
 *
 * 设计：每个人格 = 一种主导几何 + 一种主导笔触 = 16 种差异化视觉锚。
 * 颜色统一由父级 text-* (currentColor) 控制，便于跨场景复用。
 *
 * v2 人格库：暗流 / 荒岛 / 残温 / 裂岸 / 寒岭 / 极夜 / 砾迹 / 冲浪 /
 *            温砾 / 空号 / 冷砚 / 渊海 / 沉湾 / 霜冷 / 荒原 / 烬生
 */
export default function PersonalityIcon({ name, className = 'w-6 h-6' }: Props) {
  const GLYPHS: Record<string, React.ReactNode> = {
    // 暗流 — 双横线穿过同心圆（暗涌）
    暗流: (
      <g>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M2 10h20M2 14h20" />
      </g>
    ),
    // 荒岛 — 同心圆+中心孤点（孤立但不空洞）
    荒岛: (
      <g>
        <circle cx="12" cy="13" r="8" />
        <circle cx="12" cy="13" r="5" />
        <circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" />
      </g>
    ),
    // 残温 — 嵌套半弧渐小（余热剥离）
    残温: (
      <g>
        <path d="M4 17a8 8 0 0 1 16 0" />
        <path d="M7 17a5 5 0 0 1 10 0" />
        <path d="M10 17a2 2 0 0 1 4 0" />
      </g>
    ),
    // 裂岸 — 锯齿斜线+切断（断面锐利）
    裂岸: (
      <g>
        <path d="M3 5l5 5-5 5M21 5l-5 5 5 5" />
        <path d="M9 12h6" />
      </g>
    ),
    // 寒岭 — 双向尖塔三角（最高，最冷）
    寒岭: (
      <g>
        <path d="M12 3l5 9H7z" />
        <path d="M12 21l5-9H7z" />
      </g>
    ),
    // 极夜 — 圆月被蚀（封闭，有光不透）
    极夜: (
      <g>
        <path d="M18 11a7 7 0 1 1-7-7 6 6 0 0 0 7 7z" fill="currentColor" fillOpacity="0.85" stroke="none" />
      </g>
    ),
    // 砾迹 — 散点不规则（散落的足迹，不成线）
    砾迹: (
      <g>
        <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="19" cy="6" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="8" cy="13" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="15" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="6" cy="18" r="1" fill="currentColor" stroke="none" />
        <circle cx="17" cy="19" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="11" cy="20" r="0.8" fill="currentColor" stroke="none" />
      </g>
    ),
    // 冲浪 — 浪形长弧+小太阳（动力+方向感）
    冲浪: (
      <g>
        <path d="M3 14c2 0 3-2 5-2s3 2 5 2 3-2 5-2" />
        <path d="M3 18c2 0 3-2 5-2s3 2 5 2 3-2 5-2" />
        <circle cx="18" cy="8" r="1.6" />
      </g>
    ),
    // 温砾 — 嵌套圆渐淡+内嵌实点（温暖但低调）
    温砾: (
      <g>
        <circle cx="12" cy="12" r="9" strokeOpacity="0.35" />
        <circle cx="12" cy="12" r="6" strokeOpacity="0.6" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </g>
    ),
    // 空号 — 同心空环+删除线（号码，空缺）
    空号: (
      <g>
        <circle cx="12" cy="12" r="8" />
        <path d="M5 5l14 14" />
      </g>
    ),
    // 冷砚 — 矩形框+一笔斜切（冷静，有边界）
    冷砚: (
      <g>
        <rect x="4" y="5" width="16" height="14" rx="1" />
        <path d="M4 19l16-14" />
      </g>
    ),
    // 渊海 — 渐宽双竖线+下坠弧（深不可测）
    渊海: (
      <g>
        <path d="M7 3v10" />
        <path d="M17 3v10" />
        <path d="M7 13a7 4 0 0 0 10 0" />
      </g>
    ),
    // 沉湾 — 内弯月牙双弧+收口（湾，环抱又收敛）
    沉湾: (
      <g>
        <path d="M5 6a10 10 0 0 0 0 12" />
        <path d="M19 6a10 10 0 0 1 0 12" />
        <path d="M9 9a6 6 0 0 0 0 6M15 9a6 6 0 0 1 0 6" />
      </g>
    ),
    // 霜冷 — 六角雪花（棱角分明+清冷）
    霜冷: (
      <g>
        <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
        <path d="M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 12l-2-2M6 12l-2 2M18 12l2-2M18 12l2 2" />
      </g>
    ),
    // 荒原 — 横线+远点（地平线+微光）
    荒原: (
      <g>
        <path d="M3 16h18" />
        <path d="M3 20h18" />
        <circle cx="16" cy="6" r="1.4" fill="currentColor" stroke="none" />
      </g>
    ),
    // 烬生 — 三角火焰向上+内嵌点（熄灭中的余烬）
    烬生: (
      <g>
        <path d="M12 3c4 5 4 8 4 11a4 4 0 0 1-8 0c0-3 0-6 4-11z" />
        <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
      </g>
    ),
  };

  const FALLBACK = GLYPHS['暗流'];
  const glyph = GLYPHS[name] ?? FALLBACK;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
