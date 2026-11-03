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
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="报告章节导航"
      className="sticky top-0 z-30"
      style={{
        background: "rgba(250,243,234,0.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "0.5px solid rgba(168,136,78,0.22)",
      }}
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-none">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            onClick={() => go(it.id)}
            style={{
              flex: "0 0 auto",
              padding: "5px 11px",
              fontSize: "12.5px",
              color: "#6B5E4C",
              background: "#FFFDF9",
              border: "0.5px solid rgba(168,136,78,0.3)",
              borderRadius: "999px",
              fontFamily: "Noto Sans SC, sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
