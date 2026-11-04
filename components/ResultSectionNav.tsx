"use client";

/**
 * ResultSectionNav —— 结果页的吸顶分区条（状态徽章 + 章节导航 + 搜索入口）
 *
 * 为什么长成这样（2026-11-04）：
 *   原来页面顶部叠了三条常驻栏：返回栏(56) + 限时免费横幅(约 60) + 章节导航(49) ≈ 165px，
 *   占 844 屏高的 20%，而且横幅与导航是两条视觉上重复的横带。
 *   要往顶部再加东西（搜索/筛选）之前，先把这两条合并 —— 这就是本节的做法：
 *   限免/演示这类**常驻状态**降级成一枚徽章；一次性/功能性提示（支付成功、未测试）仍留在原处。
 *
 * 结构：[状态徽章] ← 章节胶囊横向滚动 → [搜索]
 *   两端固定、中间滚动，胶囊再多也不会把徽章和搜索挤出去。
 *
 * 三条约束：
 * 1. 目标 section 必须带 `scroll-mt-*`，否则跳过去会被本条带盖住标题。
 * 2. 吸顶偏移必须实测（上方还有返回栏/提示条），提示条消失后能自动变小 → ResizeObserver。
 * 3. 章节文案与标题都来自 lib/resultSections.ts（单一真源），本文件不写死文案。
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { SECTIONS, SECTION_ORDER } from "@/lib/resultSections";

export type NavStatus = { label: string; tone: "promo" | "demo" } | null;

export default function ResultSectionNav({ status = null }: { status?: NavStatus }) {
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    const header = document.querySelector(".sticky.top-0") as HTMLElement | null;
    const banner = header?.nextElementSibling as HTMLElement | null;
    const measure = () => {
      const h1 = header?.offsetHeight ?? 0;
      const h2 = banner && String(banner.className).includes("sticky") ? banner.offsetHeight : 0;
      setTopOffset(h1 + h2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    if (banner) ro.observe(banner);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="报告章节导航"
      className="sticky z-30 mb-5"
      style={{
        top: topOffset,
        background: "rgba(250,243,234,0.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* 用 grid 而不是 flex：flex-1 + min-w-0 在这里没吃住（9 个胶囊的内容宽度把整条撑到
          祖先的 max-w-[430px]，390 视口下溢出 40px，右侧搜索按钮被裁掉）。
          minmax(0,1fr) 是唯一能稳定让中间列收缩的写法。 */}
      <div
        className="grid items-center gap-2 px-3.5 py-2"
        style={{
          gridTemplateColumns: `${status ? "auto " : ""}minmax(0,1fr) auto`,
        }}
      >
        {status && (
          <span
            className="flex-none"
            role="status"
            style={{
              fontSize: "11px",
              lineHeight: 1.4,
              padding: "4px 8px",
              borderRadius: "999px",
              letterSpacing: "0.02em",
              fontFamily: "Noto Sans SC, sans-serif",
              ...(status.tone === "promo"
                ? { background: "#3D2817", color: "#F8EAD9" }
                : { background: "rgba(250,238,218,0.9)", color: "#BA7517" }),
            }}
          >
            {status.label}
          </span>
        )}

        <div className="relative min-w-0 flex-1">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {SECTION_ORDER.map((key) => {
              const sec = SECTIONS[key];
              return (
                <button
                  key={sec.id}
                  onClick={() => go(sec.id)}
                  style={{
                    flex: "0 0 auto",
                    padding: "6px 10px",
                    fontSize: "12.5px",
                    color: "#6B5E4C",
                    background: "#FFFDF9",
                    border: "0.5px solid rgba(168,136,78,0.3)",
                    borderRadius: "999px",
                    fontFamily: "Noto Sans SC, sans-serif",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    lineHeight: 1.4,
                  }}
                >
                  {sec.nav}
                </button>
              );
            })}
          </div>
          {/* 右侧渐隐：胶囊放不下，硬切看着像坏掉 */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 22,
              background: "linear-gradient(90deg, rgba(250,243,234,0) 0%, rgba(250,243,234,0.96) 80%)",
              pointerEvents: "none",
            }}
          />
        </div>

        <Link
          href="/discover"
          aria-label="去探索页搜索香水"
          className="flex-none flex items-center justify-center"
          style={{
            width: 30,
            height: 28,
            borderRadius: 999,
            background: "#FFFDF9",
            border: "0.5px solid rgba(168,136,78,0.3)",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.6" stroke="#6B5E4C" strokeWidth="1.3" />
            <path d="M10.5 10.5L13.5 13.5" stroke="#6B5E4C" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
