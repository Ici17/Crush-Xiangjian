"use client";

/**
 * 结果页底部功能入口（三张卡片）：朋友契合度 / 今日穿香 / 今日香签。
 *
 * 2026-11-24：免费页原本只有「朋友 + 今日香签」两张手写卡片，完整版页
 * （UnlockedContent）只有「朋友」一张，且两处样式分叉。这里抽成共享组件，
 * 两个 mode 都渲染同一套，避免以后改一处漏一处。
 *
 * 路由与首页三 tab 一致（app/page.tsx 的 MODES）：
 *   今日穿香 → /?mode=scent   今日香签 → /?mode=daily
 * 两者都已在首页 useEffect 的白名单里，直达可用。
 */

import Link from "next/link";
import { track } from "@/lib/analytics";

const ITEMS = [
  {
    key: "friend",
    href: (friendHref: string) => friendHref,
    icon: "💫",
    title: "测测你们的香气契合度",
    sub: "发给 TA，一起测 看看你们的匹配等级",
    bg: "linear-gradient(135deg, #FDF8F3, #FFF9F2)",
  },
  {
    key: "scent",
    href: () => "/?mode=scent",
    icon: "🌿",
    title: "今日穿香 · 按心情挑一支",
    sub: "选个场景和心情，挑今天要穿的香",
    bg: "linear-gradient(135deg, #FFF9F2, #FDF8F3)",
  },
  {
    key: "daily",
    href: () => "/?mode=daily",
    icon: "🎴",
    title: "今日香签 · 三笺已备",
    sub: "每天三笺，选一支贴合今天心情的气息",
    bg: "linear-gradient(135deg, #FDF8F3, #FFF9F2)",
  },
] as const;

export default function ResultFeatureLinks({
  friendHref = "/friend",
  source,
}: {
  friendHref?: string;
  source: "free" | "full";
}) {
  return (
    <div className="px-6 mb-14 space-y-3" aria-label="更多玩法">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href(friendHref)}
          onClick={() => {
            try {
              track("result_feature_open", { feature: item.key, source: `result_${source}` });
            } catch {
              /* 埋点失败不影响跳转 */
            }
          }}
          className="block rounded-2xl border border-amber-200 p-4 active:scale-[0.98] transition-transform hover:shadow-sm"
          style={{ background: item.bg }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "22px" }} aria-hidden>
              {item.icon}
            </span>
            <div className="flex-1 text-left">
              <p
                className="font-serif text-amber-950"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                {item.title}
              </p>
              <p className="text-amber-600 mt-0.5" style={{ fontSize: "12px" }}>
                {item.sub}
              </p>
            </div>
            <span className="text-amber-400" style={{ fontSize: "18px" }} aria-hidden>
              ›
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
