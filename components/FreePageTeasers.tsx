"use client";

/**
 * 免费结果页的「缺口感」区块。
 *
 * 2026-11-24 两页拆分：/result 只放免费内容，完整版移到 /result/full。
 * 免费页必须让人明确知道「还有东西没看到」，所以这里用三种钩子：
 *   1. 关系解读：一句悬念 + 被锁住的两张卡轮廓（原来免费页有完整两段，现按用户要求收起）
 *   2. 隐藏人格面 / 反差香 / 气味底稿：只露标题 + 一句勾人的副文案，正文一律不露
 * 全部零数据改动，只做展示层收起；完整内容仍在 UnlockedContent 里。
 */

const INK = "#2C1810";
const GOLD = "#A8884E";
const LINE = "rgba(168,136,78,.28)";

/** 章节标题：与结果页其他区块同一套语言（细线 + 衬线墨字 + 细线） */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-5">
      <span className="h-px w-6" style={{ background: GOLD }} />
      <h2 className="font-serif text-xl font-medium text-amber-950">{children}</h2>
      <span className="h-px w-6" style={{ background: GOLD }} />
    </div>
  );
}

const TEASERS = [
  { title: "隐藏人格面", sub: "你不知道的自己，藏在哪个角落？", icon: "◐" },
  { title: "反差香", sub: "一支你不会选、却值得试的香", icon: "✦" },
  { title: "气味底稿", sub: "带去线下店，直接说给调香师听", icon: "⌁" },
] as const;

export default function FreePageTeasers({
  onUnlock,
  ctaLabel,
  promoFree,
}: {
  onUnlock: () => void;
  ctaLabel: string;
  promoFree: boolean;
}) {
  return (
    <>
      {/* ── 关系解读：按用户要求收成一句悬念 ── */}
      <section className="px-6 mb-10" aria-label="关系解读（悬念）">
        <SectionTitle>关系解读</SectionTitle>
        <p
          className="text-center font-serif italic mb-5"
          style={{ fontSize: "15px", color: INK, lineHeight: 1.8 }}
        >
          同样一支香，在初见的人与亲近的人鼻子里，是两种模样。
        </p>
        <div className="grid grid-cols-2 gap-3" aria-hidden>
          {["初见印象", "亲密时刻"].map((t) => (
            <div
              key={t}
              className="relative rounded-xl p-4 overflow-hidden bg-white"
              style={{ border: `0.5px solid ${LINE}`, minHeight: 84 }}
            >
              <h4 className="font-serif text-sm mb-2" style={{ color: INK }}>{t}</h4>
              <div className="space-y-1.5" style={{ filter: "blur(5px)" }}>
                <div className="h-2 rounded" style={{ background: "rgba(168,136,78,.22)", width: "92%" }} />
                <div className="h-2 rounded" style={{ background: "rgba(168,136,78,.18)", width: "74%" }} />
                <div className="h-2 rounded" style={{ background: "rgba(168,136,78,.14)", width: "83%" }} />
              </div>
              <span
                className="absolute right-3 bottom-2"
                style={{ fontSize: 14, color: GOLD }}
              >
                🔒
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 三个深度区块：只露标题 + 一句副文案 ── */}
      <section className="px-6 mb-8" aria-label="完整版内容预览">
        <div className="rounded-2xl overflow-hidden" style={{ border: `0.5px solid ${LINE}` }}>
          {TEASERS.map((t, i) => (
            <div
              key={t.title}
              className="flex items-center gap-4 px-5 py-4"
              style={{
                background: i % 2 ? "rgba(253,248,243,.6)" : "#FFFDF9",
                borderTop: i ? `0.5px solid ${LINE}` : undefined,
              }}
            >
              <span style={{ fontSize: 19, color: GOLD, width: 22, textAlign: "center" }} aria-hidden>
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-[15px]" style={{ color: INK }}>{t.title}</h3>
                <p className="mt-0.5" style={{ fontSize: 11.5, color: "#8B7355" }}>{t.sub}</p>
              </div>
              <span style={{ fontSize: 12, color: GOLD }}>完整版 →</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 跳转完整版 CTA：限免期直接放行，活动结束后走付费 ── */}
      <section className="px-6 mb-10" aria-label="查看完整版">
        <button
          onClick={onUnlock}
          className="block w-full rounded-full py-4 font-sans font-medium text-amber-50 transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #8B5E3C, #2C1810)",
            fontSize: "15px",
          }}
        >
          {ctaLabel}
        </button>
        <p className="text-center mt-2.5 mb-0" style={{ fontSize: 11, color: "#8B7355" }}>
          {promoFree
            ? "限时免费 · 无需付费，直接查看完整版"
            : "完整解读 · 三支完整香调 · 隐藏面 · 反差香 · 气味底稿"}
        </p>
      </section>
    </>
  );
}
