/**
 * 中途挽留「快速版结果」的单测。
 *
 * 守住两条：
 *  ① 不完整答题路径也必须落到 16 人格之一（calculatePersonalityFromPath 的
 *     findClosestPersonality 兜底），否则用户点「看快速结果」会拿到空值；
 *  ② 部分答案**不能**套用 goFinish 的 `slice(-CALIBRATION_ORDER.length)`，
 *     否则分支题会被当成 cal1/cal2 写进校准数组，推荐解析静默错位。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePersonalityFromPath } from "../lib/branchingQuestions";
import { PERSONALITY_TYPES } from "../lib/data";
import {
  writeQuickResult,
  readQuickResultCount,
  clearQuickResult,
  QUICK_RESULT_KEY,
} from "../lib/quickResult";

const ids = new Set(PERSONALITY_TYPES.map((t) => t.id));

test("空路径 / 部分路径都能落到 16 人格之一，雷达分不含 NaN", () => {
  for (const path of [[], ["q1a"], ["q1a", "q2aa"], ["cal1a"], ["q1a", "cal1a"]]) {
    const r = calculatePersonalityFromPath(path);
    assert.ok(ids.has(r.personalityId), `路径 ${path.join("-")} 得到非法人格 ${r.personalityId}`);
    assert.equal(r.pathString, path.join("-"));
    for (const v of Object.values(r.radarScores)) {
      assert.ok(Number.isFinite(v), `路径 ${path.join("-")} 的雷达分出现 NaN`);
    }
  }
});

test("writeQuickResult 写入的校准答案是空数组而非分支题", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    },
    configurable: true,
  });

  writeQuickResult(["q1a", "q2aa"], []);
  assert.deepEqual(JSON.parse(store.get("crushxiangjian_calibration_choices") ?? "[]"), []);
  const quickPid = store.get("crushxiangjian_personality_id") ?? "";
  assert.ok(ids.has(quickPid), `快速版得到非法人格 id：${quickPid}`);
  assert.equal(store.get(QUICK_RESULT_KEY), "2");
  assert.equal(readQuickResultCount(), 2);

  clearQuickResult();
  assert.equal(readQuickResultCount(), 0);
});
