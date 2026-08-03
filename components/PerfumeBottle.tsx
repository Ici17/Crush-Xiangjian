type Props = {
  /** Tailwind className 字符串 */
  className?: string;
  /** 启用瓶身高光动画 */
  glow?: boolean;
  /** 描边色（默认暖金 #E8C5A0） */
  stroke?: string;
};

/**
 * Crush香鉴 香水瓶线稿
 * 直接复用设计师 SVG 路径（bottle-icon.svg，viewBox 0 0 512 512）
 * 路径坐标保持原设计稿 1:1，仅调整描边色与外层样式
 *
 *  瓶盖     圆角矩形（top y=-180, 4 圆角）
 *  瓶颈     两段折线（y -155 → -140 → -100）
 *  瓶身     柳叶刀（最宽 y≈0，宽 ±75；底部尖点 y=200）
 *  V 装饰   内部两条斜线（中心 (0,20) → (-25,-80) / (25,-80)）
 */
export default function PerfumeBottle({
  className = '',
  glow = false,
  stroke = '#E8C5A0',
}: Props) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={['animate-bottleGlow', className].join(' ')}
      style={
        glow
          ? { filter: 'drop-shadow(0 0 22px rgba(232,197,160,.35))' }
          : undefined
      }
      fill="none"
      stroke={stroke}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="translate(256, 256)">
        {/* 瓶子主体轮廓（瓶盖圆角矩形 + 瓶颈 + 瓶身柳叶刀） */}
        <path
          d="
            M -35 -180
            L 35 -180
            Q 45 -180 45 -170
            L 45 -155
            L 35 -140
            L 30 -100
            L 55 -60
            Q 75 0 75 60
            Q 75 140 0 200
            Q -75 140 -75 60
            Q -75 0 -55 -60
            L -30 -100
            L -35 -140
            L -45 -155
            L -45 -170
            Q -45 -180 -35 -180
            Z
          "
        />
        {/* 内部 V 形装饰线（左/右各一段斜线，从中心偏下向肩部上端汇聚） */}
        <path
          d="M 0 20 L -25 -80"
          opacity={0.8}
          strokeWidth={2}
        />
        <path
          d="M 0 20 L 25 -80"
          opacity={0.8}
          strokeWidth={2}
        />
      </g>
    </svg>
  );
}