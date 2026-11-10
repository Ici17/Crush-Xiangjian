/**
 * 分支路径系统单测。
 *
 * enumeratePaths 是模块内私有函数，不为测试单独导出它（避免测试污染生产 API）；
 * 这里用**同构的独立实现**复现它的遍历，转而断言它对外产生的三条契约：
 *   ① 192 条叶子路径（不是 2^7=128，树不是满二叉树）；
 *   ② 路径里绝不能出现校准题（校准题只微调偏好，不决定人格）；
 *   ③ 192 条路径映射到全部 16 个人格原型，一个都不能缺。
 *
 * 契约指纹 af09610 由 audit-perfume-reachability 守静态快照，本测试守行为。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS,
  CALIBRATION_ORDER,
  BRANCH_QUESTION_MAX,
  TOTAL_QUESTION_COUNT,
  ESTIMATED_MINUTES,
  calculatePersonalityFromPath,
  getPathLabels,
} from "../lib/branchingQuestions";
import { PERSONALITY_TYPES } from "../lib/data";

function enumeratePaths(): string[][] {
  const nextIds = new Set<string>();
  Object.values(QUESTIONS).forEach((q) =>
    q.choices.forEach((c) => c.nextQuestionId && nextIds.add(c.nextQuestionId)),
  );
  const calSet = new Set<string>(CALIBRATION_ORDER);
  const roots = Object.keys(QUESTIONS).filter(
    (qid) => !nextIds.has(qid) && !calSet.has(qid),
  );
  const paths: string[][] = [];
  const dfs = (qid: string, acc: string[]) => {
    const q = QUESTIONS[qid];
    if (!q) return;
    if (!q.choices || q.choices.length === 0) {
      paths.push(acc);
      return;
    }
    let anyNext = false;
    for (const c of q.choices) {
      if (
        c.nextQuestionId &&
        QUESTIONS[c.nextQuestionId] &&
        !calSet.has(c.nextQuestionId)
      ) {
        anyNext = true;
        dfs(c.nextQuestionId, [...acc, c.id]);
      } else {
        paths.push([...acc, c.id]);
      }
    }
    if (!anyNext) paths.push(acc);
  };
  roots.forEach((r) => dfs(r, []));
  return paths;
}

test("题数唯一真源自洽：7 分支 + 6 校准 = 13 题 / 4 分钟", () => {
  assert.equal(BRANCH_QUESTION_MAX, 7);
  assert.equal(CALIBRATION_ORDER.length, 6);
  assert.equal(TOTAL_QUESTION_COUNT, BRANCH_QUESTION_MAX + CALIBRATION_ORDER.length);
  assert.equal(TOTAL_QUESTION_COUNT, 13);
  assert.equal(ESTIMATED_MINUTES, 4);
  assert.equal(PERSONALITY_TYPES.length, 16);
});

const paths = enumeratePaths();

test("分支路径共 192 条，且每条不超过 7 道分支题", () => {
  assert.equal(paths.length, 192);
  for (const p of paths) {
    assert.ok(p.length <= BRANCH_QUESTION_MAX, `路径过长：${p.join("-")}`);
  }
});

test("校准题绝不参与路径分配", () => {
  const calSet = new Set<string>(CALIBRATION_ORDER);
  for (const p of paths) {
    for (const id of p) {
      assert.ok(!id.startsWith("cal"), `校准题混进路径：${id}`);
      assert.ok(!calSet.has(id));
    }
  }
  // 校准题本身仍必须在题库里（不是被删掉了，只是被排除）
  for (const id of CALIBRATION_ORDER) {
    assert.ok(QUESTIONS[id], `题库缺少校准题 ${id}`);
  }
});

test("192 条路径覆盖全部 16 个人格原型", () => {
  const ids = new Set<string>();
  for (const p of paths) {
    const r = calculatePersonalityFromPath(p);
    ids.add(r.personalityId);
  }
  const all = PERSONALITY_TYPES.map((t) => t.id);
  assert.equal(ids.size, 16);
  assert.deepEqual([...ids].sort(), [...all].sort());
});

test("同一路径重复计算结果确定，且不修改入参", () => {
  const p = paths[0];
  const snapshot = [...p];
  const a = calculatePersonalityFromPath(p);
  const b = calculatePersonalityFromPath(p);
  assert.deepEqual(a, b);
  assert.equal(a.pathString, p.join("-"));
  assert.deepEqual(p, snapshot);
});

test("getPathLabels 能给路径里每个选项找到标签", () => {
  for (const p of [paths[0], paths[paths.length - 1]]) {
    assert.equal(getPathLabels(p).length, p.length);
  }
});
