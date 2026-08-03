import { RADAR_DIMS, type RadarDim } from '@/lib/personalities';

type Props = {
  /** 六维分值，0~1 */
  values: Record<RadarDim, number>;
  /** SVG 尺寸，默认 280 */
  size?: number;
};

/** 六维雷达图（香气光谱）
 * 对应 PRD §4.3 结果页雷达图规格
 * - 维度顺序：上=木质，顺时针 → 清新 → 东方 → 美食 → 柑橘 → 花香
 * - 五圈等距刻度（20% / 40% / 60% / 80% / 100%）
 * - 数据多边形 + 6 顶点圆点
 * - 标签按各点外侧定位（不在同一水平线）
 */
export default function RadarChart({ values, size = 280 }: Props) {
  const VB = 280;        // viewBox
  const CX = VB / 2;     // 140
  const CY = VB / 2;     // 140
  const R = 92;          // 数据最大半径（留 68px 标签外缘，防窄屏裁切）
  const N = RADAR_DIMS.length; // 6
  const RINGS = [0.2, 0.4, 0.6, 0.8, 1]; // 五圈刻度

  // 极坐标转笛卡尔
  const toXY = (radius: number, angleDeg: number): [number, number] => {
    const a = (angleDeg * Math.PI) / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  };

  // 第 i 个维度对应的角度（-90 = 顶部顶点）
  const angleOf = (i: number) => -90 + i * (360 / N);

  // 标签定位：各点外侧 18px，按角度垂直分量调整 y
  const labelPos = (i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
    const angle = angleOf(i);
    const rad = R + 22;
    const [x, y] = toXY(rad, angle);
    // 顶部标签 (angle ≈ -90) y 抬高；底部 (≈ 90) y 抬高 baseline；右侧 start，左侧 end
    const anchor: 'start' | 'middle' | 'end' =
      Math.abs(Math.cos((angle * Math.PI) / 180)) < 0.25
        ? 'middle'
        : Math.cos((angle * Math.PI) / 180) > 0
        ? 'start'
        : 'end';
    return { x, y, anchor };
  };

  // 视觉地板：避免低分人格（如残温 40-50 分）数据多边形塌陷到中心
  // 仅影响视觉呈现半径，数值网格仍展示真实分值
  const VISUAL_FLOOR = 0.22;
  const visualValue = (v: number) => VISUAL_FLOOR + v * (1 - VISUAL_FLOOR);

  // 多边形顶点串
  const ringPoints = (radius: number): string =>
    RADAR_DIMS.map((_, i) => toXY(radius, angleOf(i)).join(',')).join(' ');

  const dataPoints = RADAR_DIMS.map((dim, i) =>
    toXY(R * visualValue(values[dim] ?? 0), angleOf(i)).join(',')
  ).join(' ');

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      className="max-w-[80vw]"
      role="img"
      aria-label="香气光谱雷达图"
    >
      {/* ── 五圈等距刻度（六边形） ── */}
      <g stroke="#D4A574" fill="none">
        {RINGS.map((scale, idx) => (
          <polygon
            key={scale}
            points={ringPoints(R * scale)}
            strokeOpacity={idx === RINGS.length - 1 ? 0.6 : 0.32}
            strokeWidth={idx === RINGS.length - 1 ? 1.5 : 1.0}
            strokeDasharray={idx === RINGS.length - 1 ? undefined : '2 3'}
          />
        ))}
      </g>

      {/* ── 六条轴线 ── */}
      <g stroke="#D4A574" strokeOpacity={0.32} strokeWidth={0.8}>
        {RADAR_DIMS.map((_, i) => {
          const [x, y] = toXY(R, angleOf(i));
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} />;
        })}
      </g>

      {/* ── 数据区域 ── */}
      <polygon
        points={dataPoints}
        fill="rgba(196,149,106,0.16)"
        stroke="#B4783C"
        strokeWidth={2.0}
        strokeLinejoin="round"
      />

      {/* ── 6 个顶点圆点 ── */}
      {RADAR_DIMS.map((dim, i) => {
        const [x, y] = toXY(R * visualValue(values[dim] ?? 0), angleOf(i));
        return (
          <circle
            key={`dot-${dim}`}
            cx={x}
            cy={y}
            r={2.6}
            fill="#B4783C"
            stroke="#FBF6EE"
            strokeWidth={1.2}
          />
        );
      })}

      {/* ── 维度标签（按各点外侧定位） ── */}
      <g fill="#6F4E37" fontSize={13} fontFamily="'Noto Serif SC', serif" fontWeight={500}>
        {RADAR_DIMS.map((dim, i) => {
          const pos = labelPos(i);
          // 顶部标签 y 抬高；底部标签 y 抬高（baseline）
          const yOffset =
            Math.sin((angleOf(i) * Math.PI) / 180) < -0.5
              ? pos.y - 2
              : Math.sin((angleOf(i) * Math.PI) / 180) > 0.5
              ? pos.y + 12
              : pos.y + 4;
          return (
            <text key={dim} x={pos.x} y={yOffset} textAnchor={pos.anchor}>
              {dim}
            </text>
          );
        })}
      </g>
    </svg>
  );
}