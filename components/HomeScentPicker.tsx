"use client";

/**
 * HomeScentPicker —— 首屏「今天穿什么香」（主 CTA 之后、人格墙之前）
 *
 * 2026-11-22 新增。用户要的是「自主选择喜好/场景/小情绪 → 今天该喷什么香水」，
 * 并配一个「提示形象标 + 结构化提问」入口。设计边界：
 *
 *  - **不是 AI 对话**：全程离线规则（lib/scentPicker.ts），零在线调用、零成本、
 *    零用户输入文本。界面上也刻意不写「AI」，不谎称智能。
 *  - **不采 PII**：三步都是点选固定选项，没有输入框。既有产品决策
 *    「首页不做自由输入框」继续成立。
 *  - **不碰日签**：不 import lib/daily/*，日签零漂移契约与全员同卡语义保持原样。
 *  - **不碰主推荐算法**：独立候选路径，canonical 指纹 / 225 可达率不受影响。
 *  - 视觉沿用结果页章节标题那套语言（细线 + 衬线小字 + 金），不做白底大 CTA。
 *
 * 埋点：标签点选与提问完成走 home_scent_pick；形象标打开走既有 ai_advisor_intent
 * 探针（与结果页追问共用漏斗，用来判断要不要上真正的在线顾问）。
 */

import { useRef, useState } from "react";
import Link from "next/link";
import {
  SCENE_TAGS,
  MOOD_TAGS,
  QUESTION_STEPS,
  pickScent,
  type PickTag,
  type BudgetKey,
  type ScentPick,
} from "@/lib/scentPicker";
import { track, getVisitorId } from "@/lib/analytics";

type Answers = { scene?: string; mood?: string; budget?: BudgetKey };

const LINE = "var(--cx-border-soft)";
const INK = "var(--cx-ink)";
const GOLD = "var(--cx-gold)";

export default function HomeScentPicker() {
  const [scene, setScene] = useState<string | undefined>();
  const [mood, setMood] = useState<string | undefined>();
  const [pick, setPick] = useState<ScentPick | null>(null);
  const [asking, setAsking] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState<Answers>({});
  // 用 ref 而不是 state：连点两次时 state 闭包会拿到同一个旧值，导致换不出新结果。
  // vid 只是本地随机匿名 ID，不采 PII（与全站埋点口径一致）。
  const turnRef = useRef(0);
  const recentRef = useRef<string[]>([]);

  const runPick = (next: Answers, action: string) => {
    const n = ++turnRef.current;
    let vid = "";
    try { vid = getVisitorId(); } catch { /* 隐私模式下拿不到，种子仍能靠计数变化 */ }
    const p = pickScent({
      ...next,
      seedKey: `${vid}|${n}`,
      avoidNames: recentRef.current,
    });
    if (p) {
      // 最近推过的只软降权，不排除；留 6 支窗口避免连续重复
      recentRef.current = [...recentRef.current.filter((x) => x !== p.name), p.name].slice(-6);
    }
    setPick(p);
    setCurrent(next);
    try {
      track("home_scent_pick", {
        action,
        source: "home",
        perfume: p?.name ?? "",
      });
    } catch {
      /* 埋点异常不影响主流程 */
    }
  };

  const reroll = () => runPick(current, "reroll");

  const chooseTag = (t: PickTag) => {
    const next: Answers = t.kind === "scene"
      ? { scene: t.key, mood }
      : { scene, mood: t.key };
    if (t.kind === "scene") setScene(t.key);
    else setMood(t.key);
    runPick(next, t.kind === "scene" ? "scene_pick" : "mood_pick");
  };

  const openAsking = () => {
    setAsking(true);
    setStep(0);
    setAnswers({});
    try {
      track("ai_advisor_intent", { intent: "home_question", personality: "" });
    } catch {
      /* ignore */
    }
  };

  const answerStep = (key: string, value: string) => {
    const next = { ...answers, [key]: value } as Answers;
    setAnswers(next);
    if (step < QUESTION_STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    // 三步走完：把答案带回标签态，出结果
    setScene(next.scene);
    setMood(next.mood);
    setAsking(false);
    runPick(next, "question_done");
  };

  return (
    <section
      className="px-5 mt-6 animate-fadeIn"
      style={{ animationDelay: "430ms" }}
      aria-label="今天穿什么香"
    >
      <div
        className="rounded-2xl px-4 pt-4 pb-3.5"
        style={{
          border: `0.5px solid ${LINE}`,
          background: "rgba(255,253,249,0.55)",
        }}
      >
        {/* 标题行 + 提示形象标 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              style={{
                fontFamily: "Noto Serif SC, serif",
                fontSize: "15px",
                letterSpacing: "0.18em",
                color: INK,
              }}
            >
              今 天 穿 什 么 香
            </div>
            <div
              className="mt-1"
              style={{ fontSize: "11px", color: "var(--cx-text-muted)" }}
            >
              {asking ? "三步，帮你挑一支" : "30 秒 · 按此刻的心情挑一支"}
            </div>
          </div>

          {!asking && (
            <button
              onClick={openAsking}
              className="tap-44 shrink-0 flex items-center justify-center"
              aria-label="帮我挑一支香水"
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--cx-radius-pill)",
                border: `0.5px solid ${LINE}`,
                background: "var(--cx-surface)",
                cursor: "pointer",
              }}
            >
              {/* 一枚香签／露滴：品牌化的「提示形象」，不用机器人/对话气泡 */}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M8 1.8c2.2 2.7 3.6 4.6 3.6 6.3A3.6 3.6 0 0 1 8 11.7a3.6 3.6 0 0 1-3.6-3.6c0-1.7 1.4-3.6 3.6-6.3Z"
                  stroke={GOLD}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path d="M6.3 8.3c.5.9 1.1 1.3 1.7 1.3" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
                <path d="M3 14.2h10" stroke={GOLD} strokeWidth="1" strokeLinecap="round" opacity="0.55" />
              </svg>
            </button>
          )}
        </div>

        <span
          aria-hidden
          className="block mt-3"
          style={{ height: 1, background: LINE }}
        />

        {asking ? (
          /* ── 结构化提问：固定选项，无输入框 ── */
          <div className="pt-3.5">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "10.5px", letterSpacing: "0.16em", color: GOLD }}>
                第 {step + 1} / {QUESTION_STEPS.length} 步
              </span>
              <button
                onClick={() => setAsking(false)}
                className="tap-44-y"
                aria-label="关闭提问"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--cx-text-muted)",
                  fontSize: "16px",
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
            <div
              className="mt-2 mb-3"
              style={{ fontFamily: "Noto Serif SC, serif", fontSize: "14px", color: INK }}
            >
              {QUESTION_STEPS[step].title}
            </div>
            <div className="flex flex-wrap gap-2">
              {QUESTION_STEPS[step].options.map((o) => (
                <button
                  key={o.v}
                  onClick={() => answerStep(QUESTION_STEPS[step].key, o.v)}
                  className="tap-44-y"
                  style={{
                    padding: "6px 13px",
                    fontSize: "12.5px",
                    color: INK,
                    background: "var(--cx-surface)",
                    border: `0.5px solid ${LINE}`,
                    borderRadius: "var(--cx-radius-pill)",
                    cursor: "pointer",
                    fontFamily: "Noto Sans SC, sans-serif",
                  }}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── 标签区 ── */
          <>
            <TagRow
              title="场 景"
              tags={SCENE_TAGS}
              active={scene}
              onPick={chooseTag}
            />
            <TagRow
              title="心 情"
              tags={MOOD_TAGS}
              active={mood}
              onPick={chooseTag}
              className="mt-3"
            />

            {pick && (
              <div className="mt-3.5 pt-3" style={{ borderTop: `1px dashed ${LINE}` }}>
                <div style={{ fontSize: "10px", letterSpacing: "0.24em", color: GOLD }}>
                  今 天 穿 这 支
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span
                    style={{
                      fontFamily: "Noto Serif SC, serif",
                      fontSize: "18px",
                      color: INK,
                    }}
                  >
                    {pick.name}
                  </span>
                  <span className="shrink-0 text-right">
                    <span style={{ fontSize: "11px", color: GOLD }}>{pick.brand}</span>
                    <span
                      className="block mt-0.5"
                      style={{ fontSize: "10px", color: "var(--cx-text-muted)" }}
                    >
                      扩散 {pick.intensity} · 留香 {pick.longevity}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1.5"
                  style={{ fontSize: "10.5px", color: "var(--cx-text-muted)" }}
                >
                  {["前", "中", "后"].map((label, i) => {
                    const notes = [pick.notes.top, pick.notes.heart, pick.notes.base][i];
                    return notes.length ? `${label}调 ${notes.slice(0, 2).join(" · ")}` : null;
                  }).filter(Boolean).join("　/　")}
                </div>
                <p
                  className="mt-2.5 mb-0"
                  style={{
                    fontFamily: "Noto Serif SC, serif",
                    fontSize: "13px",
                    lineHeight: 1.85,
                    color: "var(--cx-brown-deep)",
                  }}
                >
                  {pick.reason}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Link
                    href="/?mode=daily"
                    className="tap-44-y"
                    style={{ fontSize: "11.5px", color: GOLD, textDecoration: "none" }}
                  >
                    看今天完整香签 →
                  </Link>
                  {/* 细文字链，不做白底大按钮：换一支是轻量动作，不该抢主 CTA 的层级 */}
                  <button
                    onClick={reroll}
                    className="tap-44-y"
                    aria-label="换一支香水"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "0 2px",
                      fontSize: "11.5px",
                      color: GOLD,
                      cursor: "pointer",
                      fontFamily: "Noto Sans SC, sans-serif",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    换一支 ↻
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TagRow({
  title,
  tags,
  active,
  onPick,
  className = "",
}: {
  title: string;
  tags: PickTag[];
  active?: string;
  onPick: (t: PickTag) => void;
  className?: string;
}) {
  return (
    <div className={className || "mt-3.5"}>
      <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: GOLD }}>{title}</div>
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onPick(t)}
              className="tap-44-y"
              aria-pressed={on}
              title={t.hint}
              style={{
                padding: "6px 12px",
                fontSize: "12.5px",
                color: on ? INK : "var(--cx-text-muted)",
                background: on ? "var(--cx-cream-dark)" : "var(--cx-surface)",
                border: on ? `1px solid ${GOLD}` : `0.5px solid ${LINE}`,
                borderRadius: "var(--cx-radius-pill)",
                cursor: "pointer",
                fontFamily: "Noto Sans SC, sans-serif",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
