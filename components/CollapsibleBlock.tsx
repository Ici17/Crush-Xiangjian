"use client";

/**
 * CollapsibleBlock —— 结果页长文折叠（默认收起，点一下展开）
 *
 * 为什么要它：结果页实测 7.3 屏（6203px），其中性格解读 / 用香哲学 / 香调偏好 / 关系解读
 * 四段长文占掉约 3 屏。首次进入时它们全是展开的，用户要滑很久才看到后面的深度内容。
 *
 * 实现选择：**maxHeight + overflow:hidden**，不用 -webkit-line-clamp ——
 * 这里的子节点是多个 <p>，line-clamp 对多段落不可靠（会被当成一个盒子按行截断，
 * 各浏览器表现不一致）。maxHeight 在任何结构下都稳定。
 */

import { useState, type ReactNode } from "react";

export default function CollapsibleBlock({
  children,
  collapsedHeight = 96,
  moreLabel = "展开全文",
  lessLabel = "收起",
  className = "",
  tone = "light",
}: {
  children: ReactNode;
  /** 收起时的高度（px）。约 3 行正文 */
  collapsedHeight?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const dark = tone === "dark";

  return (
    <div className={className}>
      <div
        style={{
          maxHeight: open ? "none" : collapsedHeight,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
        {!open && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 36,
              background: dark
                ? "linear-gradient(180deg, rgba(61,40,23,0) 0%, var(--cx-brown-deep) 100%)"
                : "linear-gradient(180deg, var(--cx-cream-0) 0%, var(--cx-cream) 100%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <button
        className="tap-44-y"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "block",
          margin: "8px auto 0",
          padding: "4px 10px",
          fontSize: "12px",
          letterSpacing: "0.08em",
          color: dark ? "var(--cx-gold-light)" : "var(--cx-gold)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "Noto Sans SC, sans-serif",
        }}
      >
        {open ? `${lessLabel} ↑` : `${moreLabel} ↓`}
      </button>
    </div>
  );
}
