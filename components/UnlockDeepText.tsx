"use client";

/**
 * UnlockDeepText —— 解锁区「更深一层」解读的展示组件（F3）
 *
 * 为什么单独抽组件：
 *   · 四个区块的底色不同（隐藏人格面是墨底、其余是米白），同一段文字要两套配色；
 *   · AiBadge 必须由组件统一挂 —— 合规上「漏一处即违规」，靠四处调用方自觉不可靠；
 *   · 查不到文案时返回 null（整段不渲染），页面回到「只有原有内容」，不会留半截。
 */

import AiBadge from "./AiBadge";
import { getUnlockDeep, type UnlockDeepBlock } from "@/lib/unlockDeep";

export default function UnlockDeepText({
  personality,
  block,
  tone = "light",
  className = "",
}: {
  personality: string;
  block: UnlockDeepBlock;
  /** dark 用于墨底区块（隐藏人格面） */
  tone?: "light" | "dark";
  className?: string;
}) {
  const text = getUnlockDeep(personality, block);
  if (!text) return null;
  const dark = tone === "dark";

  return (
    <div
      className={className}
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px dashed ${dark ? "rgba(212,165,116,0.35)" : "rgba(168,136,78,0.35)"}`,
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.24em",
          color: dark ? "#D4A574" : "#A8884E",
          marginBottom: 7,
        }}
      >
        更 深 一 层
      </div>
      <p
        style={{
          fontFamily: "Noto Serif SC, serif",
          fontSize: "13.5px",
          lineHeight: 1.9,
          color: dark ? "rgba(212,165,116,0.88)" : "#5A4636",
          letterSpacing: "0.01em",
          margin: 0,
          textAlign: "left",
        }}
      >
        {text}
      </p>
      <div style={{ marginTop: 9 }}>
        <AiBadge />
      </div>
    </div>
  );
}
