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
  const label = open ? lessLabel : moreLabel;

  /**
   * 提示条（2026-11-10 视觉调整）。
   *
   * 旧版是 12px 金色小字、无边框、悬在渐隐下方 8px 的空白处 —— 用户反馈
   * 「展开收起提示不够明显、字太下了」。现在改成有底色 / 细边框 / chevron 的整行操作带：
   *  - 收起态 marginTop 用 -14px 上移，贴住渐隐区，文字重心随之抬高；
   *  - 展开态回到 4px 正常间距，避免压住展开后的最后一行正文；
   *  - 视觉高度只有 34px，命中区仍由 .tap-44-y 的伪元素扩到 44px（不改视觉尺寸）。
   * 不改动 collapsedHeight：调用方有一处只给 52px，塞大按钮会盖住正文。
   */
  const toggle = (
    <button
      className="tap-44-y"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        position: "relative",
        zIndex: 1,
        // 整行操作带而不是小胶囊：小胶囊会把渐隐那行文字从中间切成两半，
        // 整行带则形成一条完整的「下面还有内容」边界，也更醒目。
        width: "100%",
        margin: open ? "4px 0 0" : "-14px 0 0",
        padding: "7px 18px",
        minHeight: 34,
        fontSize: "13.5px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: dark ? "var(--cx-warm-ink)" : "var(--cx-brown-deep)",
        background: dark ? "rgba(250,243,234,0.12)" : "var(--cx-surface)",
        border: dark
          ? "1px solid rgba(212,165,116,0.45)"
          : "1px solid var(--cx-border-soft)",
        borderRadius: "12px",
        boxShadow: dark ? "none" : "0 2px 10px rgba(139,111,92,0.12)",
        cursor: "pointer",
        fontFamily: "Noto Sans SC, sans-serif",
      }}
    >
      <span>{label}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
        style={{
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 200ms var(--cx-ease-out)",
        }}
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

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
              height: 48,
              background: dark
                ? "linear-gradient(180deg, rgba(61,40,23,0) 0%, var(--cx-brown-deep) 100%)"
                : "linear-gradient(180deg, var(--cx-cream-0) 0%, var(--cx-cream) 100%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {toggle}
    </div>
  );
}
