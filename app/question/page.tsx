'use client';

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  QUESTIONS,
  CALIBRATION_ORDER,
  getPathLabels,
  calculatePersonalityFromPath,
  type Question,
  type QuestionChoice,
} from "@/lib/branchingQuestions";
import { markInviteeCompleted } from "@/lib/inviteState";

const STORAGE_KEY = "crushxiangjian_branch_progress";
const PATH_KEY = "crushxiangjian_path_choices";

interface Progress {
  currentQuestionId: string;
  choices: string[];
  calibrationChoices: string[];
  phase: "branch" | "calibration";
}

// 转场过渡文案（题目之间 300ms 淡入淡出窗口显示）
const TRANSITION_COPY: Record<number, string> = {
  2: "温度定下来了，接下来，是你和世界的距离。",
  3: "白天结束了。夜里的你，是另一种你。",
  4: "气味之后，是你说话的方式。",
  5: "现在，让记忆来回答。",
  6: "别人眼里的你，和你眼里的自己，未必一样。",
  7: "最后一句——你想成为谁？",
};

/** 加载页嗅觉暗示：依次闪现香水描述片段，强化「调香中」仪式感 */
const LOADING_HINTS: readonly string[] = [
  "雨后柏油路面，被太阳晒出的第一缕松木气。",
  "凌晨 4 点咖啡馆角落，一杯没喝完的浓缩。",
  "冬天大衣口袋里，残存的旧毛衣味。",
  "凌晨床头的书页，混着一点点乌木与烟。",
  "夏天走廊尽头，那扇被风吹开的窗户。",
];

function findQuestionIdByChoice(choiceId: string): string {
  for (const qId of Object.keys(QUESTIONS)) {
    if (QUESTIONS[qId].choices.some((c) => c.id === choiceId)) return qId;
  }
  return "q1";
}

export default function QuestionPage() {
  const router = useRouter();

  const [progress, setProgress] = useState<Progress>({
    currentQuestionId: "q1",
    choices: [],
    calibrationChoices: [],
    phase: "branch",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionText, setTransitionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingHintIdx, setLoadingHintIdx] = useState(0);

  /** 加载页：每隔 1.6s 切换一条嗅觉暗示 */
  useEffect(() => {
    if (!isSubmitting) return;
    const id = setInterval(() => {
      setLoadingHintIdx((i) => (i + 1) % LOADING_HINTS.length);
    }, 1600);
    return () => clearInterval(id);
  }, [isSubmitting]);

  // 一次性清理旧格式数据（旧版存的是中文名而非 slug，导致结果页永远解码失败）
  useEffect(() => {
    try {
      // 每次重新测试都清除付费标记（重新测试 = 重新锁定）
      localStorage.removeItem('crushxiangjian_paid_level');
      // 旧格式是中文名（如"暗流"），新格式是英文 slug（如"anliu"）→ 一次性迁移
      const oldId = localStorage.getItem('crushxiangjian_personality_id');
      if (oldId && /^[\u4e00-\u9fff]{2,3}$/.test(oldId)) {
        ['crushxiangjian_personality_id','crushxiangjian_radar_scores',
         'crushxiangjian_path_labels','crushxiangjian_calibration_choices',
        ].forEach(k => localStorage.removeItem(k));
      }
    } catch {}
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理副作用
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 加载进度
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Progress;
        if (parsed.currentQuestionId && QUESTIONS[parsed.currentQuestionId]) {
          setProgress({ ...parsed, calibrationChoices: parsed.calibrationChoices ?? [] });
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const currentQ = QUESTIONS[progress.currentQuestionId];
  const isCalibration = progress.phase === "calibration";

  // 容错：如果 localStorage 里恢复出的 currentQuestionId 丢了/过期，
  // 按 phase 跳到首题，避免空白页。
  useEffect(() => {
    if (currentQ) return;
    const fallbackId = isCalibration
      ? CALIBRATION_ORDER[0]
      : "q1";
    setProgress((prev) => ({ ...prev, currentQuestionId: fallbackId }));
    setAnimating(false);
  }, [currentQ, isCalibration]);

  // 语义步数（PRD 格式："第 N 题 / 共 7 题"，校准题不额外计数）
  const TOTAL_BRANCH = 7;
  const TOTAL_STEPS = CALIBRATION_ORDER.length + 7;

  // 顶层 q1–q7 映射：走 q1aa、q2aa、q5a、q6cd 等任何子分支都算走完第 N 题
  // 用 choice id 长度推断层数（首字符 qN，N∈[1,7]），避免被子分支干扰
  function getTopLevelFromChoices(choices: string[]): number {
    // 取最后答的那一题的顶层
    const last = choices[choices.length - 1];
    if (!last) return 0;
    const match = last.match(/^q([1-7])/);
    return match ? parseInt(match[1], 10) : 0;
  }
  const branchTopLevel = getTopLevelFromChoices(progress.choices);
  const branchStep = isCalibration
    ? TOTAL_BRANCH
    : Math.min(branchTopLevel + 1, TOTAL_BRANCH);
  const stepNumber = isCalibration
    ? TOTAL_BRANCH + progress.calibrationChoices.length + 1
    : branchStep;
  const progressPct = Math.round(
    (Math.min(stepNumber, TOTAL_STEPS) / TOTAL_STEPS) * 100
  );

  // 情境中文短标签（PRD 格式）：顶层 q1–q7 映射，不看子分支 scenario
  const Q_TOP_LABEL: Record<string, string> = {
    q1: "关于温度",
    q2: "关于距离",
    q3: "关于夜",
    q4: "关于留白",
    q5: "关于回忆",
    q6: "关于边界",
    q7: "关于野心",
    // 校准题（按 id 首字符校准到主问题）
    q5a: "香气记忆", q5b: "香气记忆", q5c: "香气记忆",
    q5d: "香气记忆", q5e: "香气记忆", q5f: "香气记忆",
    q5g: "香气记忆", q5h: "香气记忆", q5i: "香气记忆",
  };
  // 根据顶层 q 推导当前题 label
  const topLevelKey = progress.currentQuestionId.match(/^q[1-7]/)?.[0];
  const scenarioLabel =
    (topLevelKey && Q_TOP_LABEL[topLevelKey]) ||
    (progress.phase === "calibration" ? "香气校准" : "") ||
    "";

  function goFinish(allChoices: string[]) {
    setIsSubmitting(true);

    const result = calculatePersonalityFromPath(allChoices);
    localStorage.setItem("crushxiangjian_personality_id", result.personalityId);
    localStorage.setItem("crushxiangjian_radar_scores", JSON.stringify(result.radarScores));
    localStorage.setItem("crushxiangjian_path_labels", JSON.stringify(getPathLabels(allChoices)));
    localStorage.setItem("crushxiangjian_calibration_choices", JSON.stringify(allChoices.slice(-3)));

    // 延迟一点，让用户看到"正在调香"页
    timerRef.current = setTimeout(() => {
      const rawInv =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("inv")
          : null;

      if (rawInv) {
        let inviterName: string;
        try {
          inviterName = decodeURIComponent(escape(atob(rawInv)));
        } catch {
          inviterName = "";
        }
        if (inviterName) {
          markInviteeCompleted(inviterName);
          router.push(`/friend?inv=${rawInv}`);
        } else {
          router.push("/result");
        }
      } else {
        router.push("/result");
      }
    }, 1800);
  }

  function navigate(nextQuestionId: string, newChoices: string[], newCal: string[], phase: "branch" | "calibration") {
    if (timerRef.current) clearTimeout(timerRef.current);

    // 触发转场：用顶层 q 层级，避免子分支层数干扰
    const topOfNext = nextQuestionId.match(/^q([1-7])/);
    const topLevel = topOfNext ? parseInt(topOfNext[1], 10) : 0;
    const nextStep = phase === "calibration"
      ? 7 + newCal.length + 1
      : Math.min(topLevel + 1, 7);

    const copy = TRANSITION_COPY[nextStep];
    if (copy) {
      setShowTransition(true);
      setTransitionText(copy);
      timerRef.current = setTimeout(() => {
        setShowTransition(false);
        const newProgress: Progress = {
          currentQuestionId: nextQuestionId,
          choices: newChoices,
          calibrationChoices: newCal,
          phase,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
        if (phase === "calibration") {
          localStorage.setItem(PATH_KEY, JSON.stringify([...newChoices, ...newCal]));
        } else {
          localStorage.setItem(PATH_KEY, JSON.stringify(newChoices));
        }
        setProgress(newProgress);
        setSelectedId(null);
        setAnimating(false);
      }, 320);
    } else {
      const newProgress: Progress = {
        currentQuestionId: nextQuestionId,
        choices: newChoices,
        calibrationChoices: newCal,
        phase,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      if (phase === "calibration") {
        localStorage.setItem(PATH_KEY, JSON.stringify([...newChoices, ...newCal]));
      } else {
        localStorage.setItem(PATH_KEY, JSON.stringify(newChoices));
      }
      setProgress(newProgress);
      setSelectedId(null);
      setAnimating(false);
    }
  }

  function handleNext() {
    if (!selectedId || !currentQ) return;
    const choice = currentQ.choices.find((c) => c.id === selectedId);
    if (!choice) return;

    setAnimating(true);

    if (progress.phase === "branch") {
      const newChoices = [...progress.choices, selectedId];

      if (!choice.nextQuestionId) {
        // 分支结束 → 校准或出结果
        if (CALIBRATION_ORDER.length > 0) {
          const calFirst = CALIBRATION_ORDER[0];
          setShowTransition(true);
          setTransitionText("香气正在校准中……");
          timerRef.current = setTimeout(() => {
            setShowTransition(false);
            const calProgress: Progress = {
              currentQuestionId: calFirst,
              choices: newChoices,
              calibrationChoices: [],
              phase: "calibration",
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(calProgress));
            setProgress(calProgress);
            setSelectedId(null);
            setAnimating(false);
          }, 320);
        } else {
          goFinish(newChoices);
        }
        return;
      }

      navigate(choice.nextQuestionId, newChoices, [], "branch");
      return;
    }

    // 校准阶段
    const newCal = [...progress.calibrationChoices, selectedId];
    localStorage.setItem(PATH_KEY, JSON.stringify([...progress.choices, ...newCal]));

    if (!choice.nextQuestionId) {
      goFinish([...progress.choices, ...newCal]);
      return;
    }

    navigate(choice.nextQuestionId, progress.choices, newCal, "calibration");
  }

  function handlePrev() {
    if (progress.calibrationChoices.length === 0 && progress.choices.length === 0) {
      router.push("/");
      return;
    }

    if (progress.phase === "calibration") {
      if (progress.calibrationChoices.length > 0) {
        const newCal = progress.calibrationChoices.slice(0, -1);
        const targetQ =
          newCal.length > 0
            ? findQuestionIdByChoice(newCal[newCal.length - 1])
            : CALIBRATION_ORDER[0];
        const newProgress: Progress = {
          currentQuestionId: targetQ,
          choices: progress.choices,
          calibrationChoices: newCal,
          phase: "calibration",
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
        localStorage.setItem(PATH_KEY, JSON.stringify([...progress.choices, ...newCal]));
        setProgress(newProgress);
        setSelectedId(null);
      } else {
        const newBranch = progress.choices.slice(0, -1);
        const targetQ = findQuestionIdByChoice(progress.choices[progress.choices.length - 1]);
        const newProgress: Progress = {
          currentQuestionId: targetQ,
          choices: newBranch,
          calibrationChoices: [],
          phase: "branch",
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
        localStorage.setItem(PATH_KEY, JSON.stringify(newBranch));
        setProgress(newProgress);
        setSelectedId(null);
      }
      return;
    }

    // 分支阶段回退
    if (progress.choices.length === 0) {
      router.push("/");
      return;
    }
    const prevChoices = progress.choices.slice(0, -1);
    let targetQuestionId = "q1";
    if (prevChoices.length > 0) {
      for (const qId of Object.keys(QUESTIONS)) {
        const q = QUESTIONS[qId];
        const lastChoiceId = prevChoices[prevChoices.length - 1];
        const choice = q.choices.find((c) => c.id === lastChoiceId);
        if (choice && choice.nextQuestionId === progress.currentQuestionId) {
          targetQuestionId = qId;
          break;
        }
      }
    }
    const newProgress: Progress = {
      currentQuestionId: targetQuestionId,
      choices: prevChoices,
      calibrationChoices: [],
      phase: "branch",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    localStorage.setItem(PATH_KEY, JSON.stringify(prevChoices));
    setProgress(newProgress);
    setSelectedId(null);
  }

  function handleSkip() {
    const defaultChoices = [
      "q1a", "q2aa", "q3aaa", "q4aaaa",
      "q5aaaaa", "q6aaaaaa", "q7aaaaaaa",
    ];
    goFinish(defaultChoices);
  }

  if (!currentQ) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-cream">
        <p className="text-amber-600 font-sans animate-pulse">加载中...</p>
      </main>
    );
  }

  // ── 提交后过渡页：正在调香 ──────────────────────────
  if (isSubmitting) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-cream px-6">
        {/* 香水瓶呼吸动画 */}
        <div className="mb-10">
          <svg
            width="80"
            height="120"
            viewBox="0 0 80 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-breathe"
          >
            {/* 瓶身 */}
            <rect x="20" y="45" width="40" height="65" rx="8" fill="#E8D5B7" stroke="#C4956A" strokeWidth="1.5"/>
            {/* 瓶口 */}
            <rect x="33" y="38" width="14" height="10" rx="3" fill="#D4B896" stroke="#C4956A" strokeWidth="1.5"/>
            {/* 瓶颈 */}
            <rect x="36" y="32" width="8" height="8" rx="2" fill="#C4956A"/>
            {/* 液面 */}
            <rect x="22" y="70" width="36" height="38" rx="6" fill="#F0D8B6" opacity="0.6"/>
            {/* 高光 */}
            <rect x="24" y="48" width="6" height="20" rx="3" fill="white" opacity="0.3"/>
          </svg>
        </div>

        {/* 香水小滴动画 */}
        <div className="flex items-center gap-1 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-400"
              style={{
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>

        <h2 className="font-serif text-2xl font-medium text-amber-950 mb-3">
          正在调香
        </h2>
        <p className="text-amber-600 text-sm text-center leading-relaxed max-w-[280px]">
          你的香气报告正在生成
          <br />
          稍候片刻……
        </p>

        {/* 嗅觉暗示：让用户在等待时「闻到」某种香气的碎片 */}
        <div className="mt-8 max-w-[320px] text-center">
          <p className="text-amber-500 text-[11px] tracking-widest mb-2" style={{ letterSpacing: '0.2em' }}>
            闻到了吗？
          </p>
          <p
            key={loadingHintIdx}
            className="text-amber-800 italic font-serif text-sm leading-relaxed animate-fadeIn"
          >
            「{LOADING_HINTS[loadingHintIdx]}」
          </p>
        </div>

        <style>{`
          @keyframes breathe {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.06); opacity: 1; }
          }
          @keyframes pulse-dot {
            0%, 100% { transform: scale(0.7); opacity: 0.4; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          .animate-breathe {
            animation: breathe 2.4s ease-in-out infinite;
          }
        `}</style>
      </main>
    );
  }

  // ── 路径标签：排除校准题（视觉上不显示校准路径）──
  const displayChoices = [...progress.choices, ...progress.calibrationChoices].slice(
    0,
    progress.choices.length
  );
  const displayPathLabels = (() => {
    const raw = getPathLabels(displayChoices);
    // 去重：保留首次出现的；[海边灯塔, 月光海, 北欧海岸, 海玻璃, 海盐, 海边灯塔]
    // → [海边灯塔, 月光海, 北欧海岸, 海玻璃, 海盐]（回退重选造成的重复隐藏）
    const seen = new Set<string>();
    const deduped: typeof raw = [];
    for (const item of raw) {
      const key = `${item.emoji}|${item.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  })();

  // 底部按钮文案
  const isLastBranch = branchStep === TOTAL_BRANCH && progress.phase === "branch";
  const isLastCal = isCalibration && stepNumber === TOTAL_STEPS;

  let buttonText = "继续探索 →";
  if (isLastBranch) buttonText = "进入校准 →";
  if (isCalibration && !isLastCal) buttonText = "继续校准 →";
  if (isLastCal) buttonText = "生成我的香气报告 →";

  return (
    <main className="min-h-dvh flex flex-col bg-cream">
      <style>{`
        @keyframes questionIn {
          from { opacity: 0; transform: translateY(20px) blur(4px); }
          to   { opacity: 1; transform: translateY(0) blur(0); }
        }
        @keyframes transitionIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .question-enter {
          animation: questionIn 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .transition-overlay {
          animation: transitionIn 300ms ease-out forwards;
        }
      `}</style>

      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-20 bg-cream/90 backdrop-blur-md border-b border-amber-100">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={handlePrev}
            className="text-amber-700/70 font-sans text-sm hover:text-amber-800 transition-colors"
          >
            ← {progress.choices.length === 0 ? "返回" : "上一题"}
          </button>

          {/* 章节步进器（PRD 格式） */}
          <div className="flex flex-col items-center">
            <span className="text-amber-600 font-sans font-semibold text-sm">
              {branchStep} / {TOTAL_BRANCH}
            </span>
            {scenarioLabel && (
              <span className="text-amber-400/60 font-sans text-xs mt-0.5">
                {scenarioLabel}
              </span>
            )}
          </div>

          <button
            onClick={handleSkip}
            className="text-amber-400/60 font-sans text-sm hover:text-amber-500 transition-colors"
          >
            跳过
          </button>
        </div>

        {/* 进度条 */}
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400/60 font-sans text-[11px] tracking-wider shrink-0">
              香气探索中
            </span>
            <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 rounded-full"
                style={{
                  width: `${progressPct}%`,
                  transition: "width 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
              />
            </div>
            <span className="text-amber-500 font-sans text-xs font-medium shrink-0">
              {progressPct}%
            </span>
          </div>
        </div>

        {/* 路径可视化 */}
        {displayPathLabels.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {displayPathLabels.map((label, idx) => (
                <div key={idx} className="flex items-center gap-2 shrink-0">
                  <span className="bg-amber-100 text-amber-700 font-sans text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                    {label.emoji} {label.label}
                  </span>
                  {idx < displayPathLabels.length - 1 && (
                    <span className="text-amber-300 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 转场覆盖层 */}
      {showTransition && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-cream/95 transition-overlay">
          <p className="font-serif text-amber-700/80 text-center px-8 text-lg leading-relaxed max-w-[300px]">
            {transitionText}
          </p>
        </div>
      )}

      {/* 问题内容区 */}
      <div className="flex-1 flex flex-col justify-center py-8 px-5">
        <div
          className={`transition-all ${animating ? "opacity-0 translate-y-4 blur-sm" : "question-enter"}`}
          style={{ transitionDuration: "480ms", transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
        >
          {/* 情境标签（PRD 格式：amber-500 居中） */}
          {scenarioLabel && (
            <div className="mb-5 text-center">
              <span className="inline-block text-amber-500 font-sans text-xs tracking-wider px-3 py-1">
                {scenarioLabel}
              </span>
            </div>
          )}

          {/* 题干（PRD：text-lg, font-serif, font-bold） */}
          <h2
            className="font-serif font-bold leading-relaxed mb-6"
            style={{ fontSize: "18px", color: "#2C1810" }}
          >
            {currentQ.question}
          </h2>

          {/* 选项 */}
          <div className="space-y-3">
            {currentQ.choices.map((choice, idx) => {
              const isSelected = selectedId === choice.id;
              return (
                <button
                  key={choice.id}
                  onClick={() => setSelectedId(choice.id)}
                  className={`
                    w-full text-left px-5 py-[18px] rounded-2xl border font-sans
                    transition-all duration-200
                    ${isSelected
                      ? "border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-900 shadow-md"
                      : "border-amber-100 bg-white text-amber-800 hover:border-amber-300 hover:shadow-sm"
                    }
                  `}
                  style={isSelected ? { transform: "scale(1.02)" } : undefined}
                >
                  <div className="flex items-start gap-4">
                    {/* 编号圆圈（PRD：w-10 h-10） */}
                    <span
                      className={`
                        flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                        font-serif font-bold text-sm transition-all duration-200
                        ${isSelected ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"}
                      `}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>

                    <div className="flex-1 pt-0.5">
                      <p className="leading-relaxed text-[15px]">{choice.text}</p>

                      {/* 选中后路径提示（PRD 格式） */}
                      {isSelected && (
                        <div className="mt-3 flex items-center gap-2 text-amber-600">
                          <span className="text-base">{choice.pathEmoji}</span>
                          <span className="text-xs font-medium">
                            前往「{choice.pathLabel}」
                          </span>
                          <span className="ml-auto text-amber-400">→</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="px-5 py-4 safe-bottom">
        <button
          onClick={handleNext}
          disabled={!selectedId}
          className={`
            w-full py-4 rounded-full font-sans font-bold text-base
            transition-all duration-200
            ${selectedId
              ? "bg-gradient-to-r from-amber-700 to-amber-800 text-amber-50 active:scale-95"
              : "bg-amber-100 text-amber-300 cursor-not-allowed"
            }
          `}
          style={selectedId ? { boxShadow: "0 4px 20px rgba(92,58,36,0.25)" } : undefined}
        >
          {buttonText}
        </button>
      </div>
    </main>
  );
}
