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
 *
 * ─── 提示的视觉语言（2026-11-10 第二轮，用户否掉了白底整行按钮「很突兀」）───
 * 结果页的章节标题是「1px 短金线 + 衬线墨字 + 1px 短金线」（UnlockedContent.tsx
 * 的 `h-px w-6 bg-amber-400` + `font-serif text-xl`），章节之间还有「— • —」装饰。
 * 折叠提示属于同一套克制语言，不该是一个现代 App 风格的白底圆角 CTA：
 *   · 无底色 / 无边框 / 无阴影 / 无圆角，只有文字 + 细箭头 + 两侧短金线；
 *   · 紧贴渐隐末尾（margin 0），不悬空、也不用负 margin 压住正文；
 *   · 字号 13.5px 衬线深墨（比旧版 12px 金色小字清楚），箭头提供可点击暗示；
 *   · 视觉高度 30px，命中区仍由 .tap-44-y 的伪元素扩到 44px。
 * 不改动 collapsedHeight：调用方有一处只给 52px，任何「塞进内容区」的做法都会盖住正文。
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
  const lineColor = dark ? "rgba(212,165,116,0.35)" : "var(--cx-border-soft)";

  const toggle = (
    <button
      className="tap-44-y"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        margin: open ? "6px 0 0" : "0",
        padding: 0,
        minHeight: 30,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: dark ? "var(--cx-gold-light)" : "var(--cx-brown-deep)",
        fontFamily: "Noto Serif SC, serif",
        fontSize: "13.5px",
        fontWeight: 500,
        letterSpacing: "0.08em",
      }}
    >
      {/* 与章节标题同源的短金线：让提示成为页面排版的一部分，而不是一块按钮 */}
      <span aria-hidden style={{ width: 24, height: 1, background: lineColor }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        <svg
          width="11"
          height="11"
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
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span aria-hidden style={{ width: 24, height: 1, background: lineColor }} />
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
              height: 44,
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
