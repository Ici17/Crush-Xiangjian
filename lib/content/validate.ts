/**
 * L2 算法配置发布校验。
 *
 * 静态门禁（audit-*）在 CI 里锁源码基线；这里把同样的「数量/结构」约束
 * 搬到发布路径上，避免后台一发布就把 13 题 / 225 香水的基线改坏。
 * 更深的行为校验（192 路径→16 人格、225/225 可达率、canonical 指纹）
 * 需要在发布时跑纯函数快照比对，属于下一阶段；这里先守住最容易犯的错。
 */

import { BRANCH_QUESTION_MAX, TOTAL_QUESTION_COUNT, QUESTIONS } from "@/lib/branchingQuestions";
import { PERFUMES } from "@/lib/data";
import { parsePriceRange } from "@/lib/priceRange";

export type Validation = { ok: true } | { ok: false; error: string };

const BASE_QUESTIONS = Array.isArray(QUESTIONS) ? QUESTIONS.length : Object.keys(QUESTIONS).length;
const BASE_PERFUMES = Object.keys(PERFUMES).length;

export function validateConfigValue(key: string, value: unknown): Validation {
  const v = value as Record<string, unknown> | unknown[] | null;

  if (key === "config.questions") {
    // 题库基线是 Record<id, Question>；为了后台编辑方便，数组形态也接受
    const list = Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
    if (list.length === 0) return { ok: false, error: "题库必须是非空的题目集合" };
    if (list.length !== BASE_QUESTIONS && list.length !== TOTAL_QUESTION_COUNT) {
      return { ok: false, error: `题库数量 ${list.length} 与基线 ${BASE_QUESTIONS}/${TOTAL_QUESTION_COUNT} 不符` };
    }
    return { ok: true };
  }

  if (key === "config.perfumes") {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "香水库必须是对象" };
    }
    const n = Object.keys(v).length;
    if (n !== BASE_PERFUMES) {
      return { ok: false, error: `香水库数量 ${n} 与基线 ${BASE_PERFUMES} 不符（可达率门禁会红）` };
    }
    return { ok: true };
  }

  if (key === "config.priceRanges") {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "价格带必须是对象" };
    }
    const bad = Object.entries(v).filter(([, raw]) => parsePriceRange(String(raw)) === null);
    if (bad.length) return { ok: false, error: `有 ${bad.length} 个价格区间解析失败：${bad[0][0]}` };
    return { ok: true };
  }

  // 未知 key 允许保存草稿（预留扩展），但发布时至少要有内容
  if (!v || (typeof v === "object" && Object.keys(v).length === 0)) {
    return { ok: false, error: "配置内容为空" };
  }
  return { ok: true };
}

/** 供后台展示基线数字，避免面板里写死题数/香水数（题数真源铁律） */
export const CONFIG_BASELINE = {
  branchQuestions: BRANCH_QUESTION_MAX,
  totalQuestions: TOTAL_QUESTION_COUNT,
  perfumes: BASE_PERFUMES,
} as const;
