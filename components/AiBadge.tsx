"use client";

/**
 * AiBadge —— AI 生成内容的统一标识
 *
 * 为什么必须有它：《人工智能生成合成内容标识办法》（2025-09-01 施行）要求，
 * AI 生成的文本也要**显式标识**，且应放在开头/结尾/关键位置，**字体清晰可辨、
 * 不得刻意缩小或模糊**。分享卡保存属于「导出」场景，文件内同样须含标识。
 *
 * 设计原则：把它做成**金色系的设计元素**，而不是贴在法律角落的水印。
 * 合规的东西如果做得像补丁，设计侧迟早会想办法把它变小、变淡 —— 那就违规了。
 * 所以这里锁死最小字号与对比度，并把说明写进 title/aria。
 *
 * 用法：任何展示 AI 生成文案的地方都必须挂它，一个都不能漏。
 */

export default function AiBadge({
  label = "AI 生成",
  size = "sm",
  className = "",
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const md = size === "md";
  return (
    <span
      className={`inline-flex items-center rounded-full whitespace-nowrap ${className}`}
      style={{
        // ⚠️ 字号与对比度是合规要求，不要为了「更精致」把它改小改淡
        fontSize: md ? "12px" : "11px",
        lineHeight: 1.5,
        padding: md ? "2px 9px" : "1.5px 7px",
        border: "1px solid rgba(168,136,78,0.5)",
        background: "rgba(250,238,218,0.75)",
        color: "#7A5A2E",
        letterSpacing: "0.02em",
      }}
      title="本段文案由人工智能生成"
      aria-label="人工智能生成内容"
    >
      <span aria-hidden style={{ marginRight: 3, fontSize: md ? "11px" : "10px" }}>
        ✦
      </span>
      {label}
    </span>
  );
}
