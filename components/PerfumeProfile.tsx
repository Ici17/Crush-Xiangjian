"use client";

/**
 * PerfumeProfile —— F7 单香档案的展示组件（一行版 / 详情版）
 *
 * 为什么抽成组件而不是在四处各自写：
 *   档案文案是 **AI 生成 + 人工校订** 的，按《人工智能生成合成内容标识办法》必须显式标识。
 *   标识漏一处即违规，所以「挂 AiBadge」这件事必须只有一处实现 —— 靠调用方自觉是不可靠的。
 *
 * 为什么查不到就什么都不渲染（不回落 description）：
 *   档案的价值是「新的说法」，与旧描述重复就白花了生成成本（audit-perfume-data 的 I 项
 *   把「复读 description」列为红线）。宁可少一行，也不要印一段复读。
 *
 * 入参为什么做得这么宽：香水库用 `notes`，推荐结果用 `notesStructured`，
 * 场景选香的 ScenePick 则只有 name —— 统一在这里吃掉差异，调用方不用做转换。
 */

import AiBadge from "./AiBadge";
import { getPerfumeProfile } from "@/lib/perfumeProfile";

type Notes3 = { top: string[]; heart: string[]; base: string[] };

export interface ProfileRef {
  id?: string;
  name?: string;
  // 香水库用结构化 notes；推荐结果（CalibratedRecommendation）里 `notes` 是**字符串**，
  // 真正的结构化三调在 notesStructured —— 两种形态都要能吃下。
  notes?: Notes3 | string;
  notesStructured?: Notes3;
  intensity?: number;
  longevity?: number;
  priceRange?: string;
}

/** 一行版：卡片内联，只放「这支香的气质」这一句 */
export function ProfileLine({ p, className = "" }: { p: ProfileRef | null; className?: string }) {
  const prof = getPerfumeProfile(p);
  if (!prof) return null;
  return (
    <div
      className={className}
      style={{
        fontFamily: "Noto Serif SC, serif",
        fontSize: "11.5px",
        color: "#5A4E3E",
        lineHeight: 1.6,
        letterSpacing: "0.02em",
      }}
    >
      {prof.line}
      <AiBadge className="ml-1.5 align-middle" />
    </div>
  );
}

const ROW = "text-[10.5px] text-amber-700/70 leading-relaxed";

/** 时刻版：只放「适合出现的时刻」—— 香签这类卡片空间紧的地方用它 */
export function ProfileHint({ p, className = "" }: { p: ProfileRef | null; className?: string }) {
  const prof = getPerfumeProfile(p);
  if (!prof) return null;
  return (
    <div
      className={className}
      style={{
        fontSize: "10.5px",
        color: "#8B7357",
        lineHeight: 1.6,
        letterSpacing: "0.02em",
      }}
    >
      {prof.hint}
      <AiBadge className="ml-1.5 align-middle" />
    </div>
  );
}

/** 详情版：点卡展开后看到的内容 —— 气质 + 时刻 + 三调 + 扩散留香 + 价格 */
export function ProfileDetail({ p }: { p: ProfileRef | null }) {
  const prof = getPerfumeProfile(p);
  if (!p || !prof) return null;
  const notes = (typeof p.notes === "object" ? p.notes : undefined) ?? p.notesStructured ?? null;

  return (
    <div className="mt-2.5 rounded-xl bg-[#F7F1E7] p-3">
      <div
        style={{
          fontFamily: "Noto Serif SC, serif",
          fontSize: "12.5px",
          color: "#2C1810",
          lineHeight: 1.7,
          letterSpacing: "0.02em",
        }}
      >
        {prof.line}
      </div>
      <div className="mt-1.5 text-[11.5px] text-[#A8884E] leading-relaxed">{prof.hint}</div>

      {notes && (
        <div className="mt-2.5 space-y-0.5">
          <div className={ROW}>前 · {notes.top.join(" · ")}</div>
          <div className={ROW}>中 · {notes.heart.join(" · ")}</div>
          <div className={ROW}>后 · {notes.base.join(" · ")}</div>
        </div>
      )}

      {(p.intensity || p.longevity || p.priceRange) && (
        <div className="mt-2 flex items-center gap-2.5 flex-wrap">
          {p.intensity ? <span className={ROW}>扩散 {p.intensity}/5</span> : null}
          {p.longevity ? <span className={ROW}>留香 {p.longevity}/5</span> : null}
          {p.priceRange ? <span className={ROW}>{p.priceRange}</span> : null}
        </div>
      )}

      <div className="mt-2.5">
        <AiBadge />
      </div>
    </div>
  );
}
