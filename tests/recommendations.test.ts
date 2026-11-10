/**
 * 推荐引擎确定性单测。
 *
 * 项目里推荐是「双轨」的有意设计：canonical（不传 userSeed）走 argmax，
 * 真实用户带 vid 种子走窗口内加权随机。**两条轨都必须可复现**：
 * 同输入同 seed 必须得到逐字节相同的结果，否则分享图、日签快照、
 * canonical 指纹 fe9d2d70 都会随机漂移。
 *
 * 这里不锁具体香水名（那由 audit-perfume-reachability 的快照门禁负责），
 * 只锁「确定性 + 基本结构」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCalibratedRecommendations,
  type ScentVector,
} from "../lib/matchPerfumes";

const radar: ScentVector = {
  floral: 62,
  woody: 41,
  fresh: 70,
  oriental: 33,
  citrus: 55,
  gourmand: 22,
};
const cal = ["cal1a", "cal2a", "cal3a", "cal4a", "cal5a", "cal6a"];
const calAlt = ["cal1c", "cal2c", "cal3c", "cal4d", "cal5c", "cal6c"];

test("校准答案不足 3 条时返回空数组，而不是默认偏好", () => {
  assert.deepEqual(getCalibratedRecommendations(radar, []), []);
  assert.deepEqual(getCalibratedRecommendations(radar, ["cal1a", "cal2a"]), []);
});

test("canonical（无 userSeed）同输入结果完全一致", () => {
  const a = getCalibratedRecommendations(radar, cal);
  const b = getCalibratedRecommendations(radar, cal);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.length > 0, "有效输入不应返回空结果");
});

test("真实用户路径：同一 userSeed 结果可复现", () => {
  const a = getCalibratedRecommendations(radar, cal, [], undefined, false, "visitor-42");
  const b = getCalibratedRecommendations(radar, cal, [], undefined, false, "visitor-42");
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("不同校准答案与不同 seed 都能正常产出数组", () => {
  for (const c of [cal, calAlt]) {
    for (const seed of [undefined, "visitor-a", "visitor-b"]) {
      const r = getCalibratedRecommendations(radar, c, [], undefined, false, seed);
      assert.ok(Array.isArray(r));
      assert.ok(r.length > 0);
    }
  }
});

test("推荐结果里同一支香水不重复出现", () => {
  const r = getCalibratedRecommendations(radar, cal, [], undefined, false, "visitor-dup-check");
  const keys = r.map((x) => `${x.brand}|${x.name}`);
  assert.equal(new Set(keys).size, keys.length, "同一支香水不应占两个推荐位");
  for (const x of r) {
    assert.ok(Number.isFinite(x.score), `分数不能是 NaN：${x.name}`);
    assert.ok(Number.isFinite(x.match), `匹配度不能是 NaN：${x.name}`);
  }
});

test("雷达六维全零也不能抛错，且仍然确定", () => {
  const zero: ScentVector = {
    floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0,
  };
  const r = getCalibratedRecommendations(zero, cal);
  assert.ok(Array.isArray(r));
  assert.deepEqual(r, getCalibratedRecommendations(zero, cal));
  for (const x of r) {
    assert.ok(Number.isFinite(x.score), `零向量下分数不能是 NaN：${x.name}`);
  }
});
