type Props = {
  /** 颜色变体：dark 浅奶油底用深琥珀 / light 深底用浅奶油 */
  variant?: 'dark' | 'light';
  /** 自定义字号（不传则按 H3 24px） */
  size?: number;
  /** 自定义 className */
  className?: string;
};

/**
 * Crush香鉴 品牌符号（文字标）
 * CRUSH FRAGRANCE + 上下 1px 琥珀横线
 * 规范：字距 0.3em · Noto Serif SC 700 · #2C1810 或 #FAF3EA
 */
export default function BrandSymbol({
  variant = 'dark',
  size = 14,
  className = '',
}: Props) {
  const color = variant === 'dark' ? '#2C1810' : '#FAF3EA';
  const lineColor = variant === 'dark' ? '#2C1810' : '#FAF3EA';

  return (
    <div
      className={['inline-flex flex-col items-center select-none', className].join(' ')}
      aria-label="Crush Fragrance"
    >
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 'min(240px, 70vw)',
          height: 1,
          background: lineColor,
          opacity: 0.6,
        }}
      />
      <span
        style={{
          fontFamily: '"Noto Serif SC", Georgia, serif',
          fontWeight: 700,
          letterSpacing: '0.3em',
          color,
          fontSize: `${size}px`,
          padding: `${Math.round(size * 0.55)}px 0`,
          textTransform: 'none',
        }}
      >
        CRUSH&nbsp;&nbsp;FRAGRANCE
      </span>
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 'min(240px, 70vw)',
          height: 1,
          background: lineColor,
          opacity: 0.6,
        }}
      />
    </div>
  );
}