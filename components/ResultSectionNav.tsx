"use client";

/**
 * ResultSectionNav —— 结果页的分段导航（吸顶）
 *
 * 为什么需要：结果页 7.3 屏、11 个区块，用户想回看「本命香水」要滑很久。
 * 有了吸顶导航，7 屏的长度就不再是负担 —— 也让折叠后的长文更好找。
 *
 * 注意两点：
 * 1. 目标 section 必须带 `scroll-mt-*`（scroll-margin-top），否则会被吸顶导航盖住标题。
 * 2. 不用 IntersectionObserver 做高亮同步 —— 移动端滚动时它会抖，且收益小；
 *    这里只做「点了能到」，保持简单。
 */

import { useEffect, useState } from "react";

const ITEMS = [
  { id: "sec-spectrum", label: "香气光谱" },
  { id: "sec-perfume", label: "本命香" },
  { id: "sec-personality", label: "性格" },
  { id: "sec-relation", label: "关系" },
  { id: "sec-hidden", label: "隐藏面" },
  { id: "sec-contrast", label: "反差香" },
  { id: "sec-blueprint", label: "底稿" },
];

export default function ResultSectionNav() {
  // 本页顶部已经有两条常驻 sticky：返回栏（z-50）+ 活动横幅（z-40）。
  // 导航若也写 top-0 就会被它们盖住 —— 实际表现是「滚走后再也不出现」。
  // 所以这里实测两条栏的总高度作为吸顶偏移；横幅在活动结束后会消失，故用 ResizeObserver 跟随。
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    const header = document.querySelector('header, .sticky.top-0') as HTMLElement | null;
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
      // 上下留白必须相等，否则视觉上「一边宽一边窄」：
      //   上方 = 人格揭晓区块的 mb-5（20px）
      //   下方 = 本条带的 mb-5（20px）
      // 曾经用负 margin 去抵上方 40px，但会和上一区块的 margin 折叠、数值不可控（实测在 12~28 间跳），
      // 所以改成直接把上一区块的 mb-10 收到 mb-5，两边都用同一个 20px。
      // 吸顶偏移由 topOffset 决定（见上方 useEffect），否则会被顶部两条 sticky 栏盖住。
      className="sticky z-30 mb-5"
      style={{
        top: topOffset,
        background: "rgba(250,243,234,0.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        // 2026-11-03：删掉原来的 borderBottom（0.5px 淡线）——在米白底上它既不承担分隔作用，
        // 又像一道无意义的横线。吸顶时靠半透明背景 + blur 遮挡滚动内容已经够了。
      }}
    >
      <div className="relative">
        <div className="flex gap-1.5 overflow-x-auto px-3.5 py-2 scrollbar-none">
          {ITEMS.map((it) => (
            <button
              key={it.id}
              onClick={() => go(it.id)}
              style={{
                flex: "0 0 auto",
                padding: "6px 12px",
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
              {it.label}
            </button>
          ))}
        </div>
        {/* 右侧渐隐：7 个胶囊在 390px 宽下放不下，硬切看着像坏掉，渐隐用来提示「可以滑」 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: 26,
            background: "linear-gradient(90deg, rgba(250,243,234,0) 0%, rgba(250,243,234,0.96) 80%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </nav>
  );
}
