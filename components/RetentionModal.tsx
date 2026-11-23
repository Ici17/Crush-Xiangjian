"use client";

/**
 * RetentionModal —— 答题中途流失挽留（移动端 H5）
 *
 * 为什么不用桌面 exit-intent：GitHub 上 beeker1121/exit-intent-popup(320★)、
 * use-exit-intent(TS hook) 等都靠 mouseleave，移动端没有鼠标；答题页也没有
 * 「中途退出」按钮（答过题后左上只显示「上一题」）。pagehide 又发生在页面卸载时，
 * 弹不出任何 UI。所以第一版由 question 页在「切后台 ≥3 秒后回来」时挂载本弹窗：
 * 不劫持浏览器返回键、弹窗在页面可见时显示、每会话只一次。
 *
 * 合规：明确写「快速版 / 基于已有回答」，不承诺准确、不谎称完整、可随时关闭，
 * 也不阻止用户继续答完。文案避开医疗/命理/财务暗示与「治愈」。
 */

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { TOTAL_QUESTION_COUNT } from "@/lib/branchingQuestions";

const INK = "#2C1810";
const GOLD = "#A8884E";

export default function RetentionModal({
  answeredCount,
  onAccept,
  onDismiss,
}: {
  answeredCount: number;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    try { track("retention_popup", { action: "view", step: answeredCount }); } catch { /* ignore */ }
  }, [answeredCount]);

  const dismiss = () => {
    try { track("retention_popup", { action: "dismiss", step: answeredCount }); } catch { /* ignore */ }
    onDismiss();
  };

  const accept = () => {
    try { track("retention_popup", { action: "accept", step: answeredCount }); } catch { /* ignore */ }
    onAccept();
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="先给你一版结果"
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(44,24,16,0.45)" }}
        onClick={dismiss}
        aria-hidden
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-cream rounded-t-3xl px-6 pt-4"
        style={{ paddingBottom: "calc(24px + var(--safe-bottom))" }}
      >
        <span
          className="block mx-auto mb-5 rounded-full"
          style={{ width: 40, height: 4, background: "rgba(168,136,78,0.35)" }}
          aria-hidden
        />

        <div
          className="text-center"
          style={{ fontFamily: "Noto Serif SC, serif", fontSize: "20px", color: INK }}
        >
          先给你一版结果？
        </div>
        <p
          className="text-center mt-3 mb-0"
          style={{ fontSize: "13.5px", lineHeight: 1.85, color: "#6B5E4C" }}
        >
          你已答了 {answeredCount} 题。可以按目前的回答先生成一版人格侧写，
          之后随时重新测完整 {TOTAL_QUESTION_COUNT} 题。
        </p>
        <p
          className="text-center mt-2 mb-0"
          style={{ fontSize: "11px", lineHeight: 1.7, color: "#A08D72" }}
        >
          快速版基于已有回答，完整测试会更贴近你
        </p>

        <button
          onClick={accept}
          className="block w-full mt-6 border-none cursor-pointer"
          style={{
            minHeight: 46,
            borderRadius: "var(--cx-radius-pill)",
            background: INK,
            color: "#FAF3EA",
            fontSize: "14.5px",
            fontFamily: "Noto Sans SC, sans-serif",
          }}
        >
          看快速结果 →
        </button>
        <button
          onClick={dismiss}
          className="block w-full mt-2 border-none cursor-pointer"
          style={{
            minHeight: 44,
            background: "transparent",
            color: GOLD,
            fontSize: "13px",
            fontFamily: "Noto Sans SC, sans-serif",
          }}
        >
          继续答完
        </button>
      </div>
    </div>
  );
}
