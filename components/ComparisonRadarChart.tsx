import { RADAR_DIMS, RADAR_DIM_LABELS, type RadarDim } from '@/lib/personalities';

// 英文 key → 中文 key（兼容 data.ts 旧数据结构）
const KEY_MAP: Record<string, RadarDim> = {
  woody: '木质',
  fresh: '清新',
  oriental: '东方',
  gourmand: '美食',
  citrus: '柑橘',
  floral: '花香',
};

/**
 * 将英文雷达分值 Record 转换为中文 key 版本
 * data.ts 原始数据为 0-100 区间
 */
function normalizeScores(
  raw: Record<string, number>,
): Record<RadarDim, number> {
  const result: Partial<Record<RadarDim, number>> = {};
  for (const [en, cn] of Object.entries(KEY_MAP)) {
    if (en in raw) result[cn] = raw[en] / 100;
  }
  for (const dim of RADAR_DIMS) {
    if (!(dim in result)) result[dim] = 0;
  }
  return result as Record<RadarDim, number>;
}

type Props = {
  /** 当前人格雷达分值（英文 key: 0-100，来自 data.ts）*/
  scores: Record<string, number>;
  /** 对比人格雷达分值（英文 key: 0-100，来自 data.ts）*/
  compareScores: Record<string, number>;
  /** 当前人格名称*/
  mainLabel: string;
  /** 对比人格名称*/
  compareLabel: string;
  /** 主方是否为「我」（未使用，但 FriendView 传入）*/
  mainIsMe?: boolean;
  /** SVG 尺寸，默认 240 */
  size?: number;
};

/** 两人格雷达图对比组件
 * 在朋友匹配结果页使用
 * 维度顺序与 RadarChart 保持一致
 */
export default function ComparisonRadarChart({
  scores,
  compareScores,
  mainLabel,
  compareLabel,
  mainIsMe,
  size = 240,
}: Props) {
  // 英文 key → 0~1 区间
  const main = normalizeScores(scores);
  const compare = normalizeScores(compareScores);
  const CX = size / 2;
  const CY = size / 2;
  const R = (size / 2) * 0.78;
  const N = RADAR_DIMS.length;

  const toPoint = (radius: number, angleDeg: number): [number, number] => {
    const a = (angleDeg * Math.PI) / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  };

  const polygonPoints = (radius: number): string =>
    RADAR_DIMS.map((_, i) => toPoint(radius, -90 + i * (360 / N)).join(',')).join(' ');

  const dataPoints = (scoresMap: Record<RadarDim, number>): string =>
    RADAR_DIMS.map((dim, i) =>
      toPoint(R * (scoresMap[dim] ?? 0), -90 + i * (360 / N)).join(',')
    ).join(' ');

  // 5 圈等距刻度（PRD §4.3 标准）
  const RINGS = [0.2, 0.4, 0.6, 0.8, 1];
  // 标签各点外侧定位
  const labelPos = (i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
    const angle = -90 + i * (360 / N);
    const [x, y] = toPoint(R + 18, angle);
    const cos = Math.cos((angle * Math.PI) / 180);
    const anchor: 'start' | 'middle' | 'end' =
      Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
    return { x, y, anchor };
  };

  // viewBox 内缩 padding，给顶部 / 底部标签预留 12px 缓冲区
  const PAD = 14;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`${-PAD} ${-PAD} ${size + PAD * 2} ${size + PAD * 2}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${mainLabel} 与 ${compareLabel} 的香气光谱对比`}
      >
        {/* 背景网格：5 圈等距刻度 */}
        <g stroke="#D4A574" fill="none">
          {RINGS.map((scale, idx) => (
            <polygon
              key={scale}
              points={polygonPoints(R * scale)}
              strokeOpacity={idx === RINGS.length - 1 ? 0.5 : 0.25}
              strokeWidth={idx === RINGS.length - 1 ? 1 : 0.7}
              strokeDasharray={idx === RINGS.length - 1 ? undefined : '2 3'}
            />
          ))}
        </g>

        {/* 轴线 */}
        <g stroke="#D4A574" strokeOpacity={0.25} strokeWidth={0.8}>
          {RADAR_DIMS.map((_, i) => {
            const [x, y] = toPoint(R, -90 + i * (360 / N));
            return <line key={i} x1={CX} y1={CY} x2={x} y2={y} />;
          })}
        </g>

        {/* 对比人格（底层，蓝色虚线，与主色高对比） */}
        <polygon
          points={dataPoints(compare)}
          fill="rgba(125,185,182,0.18)"
          stroke="#5A9994"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />

        {/* 当前人格（上层，实心琥珀色） */}
        <polygon
          points={dataPoints(main)}
          fill="rgba(180,120,60,0.32)"
          stroke="#B4783C"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* 对比人格顶点圆点 */}
        {RADAR_DIMS.map((dim, i) => {
          const [x, y] = toPoint(R * (compare[dim] ?? 0), -90 + i * (360 / N));
          return (
            <circle
              key={`c-${dim}`}
              cx={x}
              cy={y}
              r={2.5}
              fill="#5A9994"
              stroke="#FBF6EE"
              strokeWidth={1}
            />
          );
        })}

        {/* 当前人格顶点圆点 */}
        {RADAR_DIMS.map((dim, i) => {
          const [x, y] = toPoint(R * (main[dim] ?? 0), -90 + i * (360 / N));
          return (
            <circle
              key={`m-${dim}`}
              cx={x}
              cy={y}
              r={3}
              fill="#B4783C"
              stroke="#FBF6EE"
              strokeWidth={1}
            />
          );
        })}

        {/* 维度标签（按各点外侧定位） */}
        <g fill="#6F4E37" fontSize={11} fontFamily="'Noto Serif SC', serif" fontWeight={500}>
          {RADAR_DIMS.map((dim, i) => {
            const pos = labelPos(i);
            const angle = -90 + i * (360 / N);
            const sin = Math.sin((angle * Math.PI) / 180);
            const yOffset = sin < -0.5 ? pos.y - 2 : sin > 0.5 ? pos.y + 12 : pos.y + 4;
            return (
              <text key={dim} x={pos.x} y={yOffset} textAnchor={pos.anchor}>
                {RADAR_DIM_LABELS[dim] ?? dim}
              </text>
            );
          })}
        </g>
      </svg>

      {/* 图例 */}
      <div className="flex gap-4 text-xs text-amber-700">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-amber-700" aria-hidden />
          {mainLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 border-t border-dashed border-amber-500" aria-hidden />
          {compareLabel}
        </span>
      </div>
    </div>
  );
}
