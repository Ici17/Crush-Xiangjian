/**
 * quickResult —— 中途挽留的「快速版结果」落盘（零 AI、复用同一套人格算法）
 *
 * ⚠️ 为什么不直接复用 question/page.tsx 的 goFinish：
 *  goFinish 末尾用 `allChoices.slice(-CALIBRATION_ORDER.length)` 取校准答案，
 *  那是为「13 题全部答完」设计的。中途挽留只有部分答案，直接套用会把
 *  分支题当成 cal1/cal2 写进校准数组，推荐解析会静默错位。
 *  所以这里单独写一条「部分答案」路径，但**人格判定仍调用同一个
 *  calculatePersonalityFromPath**（不完整路径走 findClosestPersonality 兜底），
 *  不新增算法通道，canonical 指纹 / 225 可达率都不受影响。
 *
 * 校准答案原样写入（不 slice）：不足 3 条时 parseCalPreferences 返回 null，
 * 结果页会自然退回静态 getRecommendations，不会出现空白或错配。
 */

import {
  calculatePersonalityFromPath,
  getPathLabels,
  PATH_LABEL_EXCLUDED_CAL,
} from "./branchingQuestions";

export const QUICK_RESULT_KEY = "crushxiangjian_quick_result";

/** 已答题数写进 localStorage，供结果页显示「快速版」提示（不是 PII） */
export function writeQuickResult(branchChoices: string[], calibrationChoices: string[]): void {
  const allChoices = [...branchChoices, ...calibrationChoices];
  const result = calculatePersonalityFromPath(allChoices);

  const pathLabelChoices = allChoices.filter(
    (id) => !PATH_LABEL_EXCLUDED_CAL.some((prefix) => id.startsWith(prefix)),
  );

  localStorage.setItem("crushxiangjian_personality_id", result.personalityId);
  localStorage.setItem("crushxiangjian_radar_scores", JSON.stringify(result.radarScores));
  localStorage.setItem("crushxiangjian_path_labels", JSON.stringify(getPathLabels(pathLabelChoices)));
  localStorage.setItem("crushxiangjian_calibration_choices", JSON.stringify(calibrationChoices));
  localStorage.setItem(QUICK_RESULT_KEY, String(allChoices.length));
}

export function clearQuickResult(): void {
  localStorage.removeItem(QUICK_RESULT_KEY);
}

/** 结果页读：返回已答题数，0 表示不是快速版 */
export function readQuickResultCount(): number {
  try {
    const n = Number(localStorage.getItem(QUICK_RESULT_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
