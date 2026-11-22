/**
 * 首屏「今天穿什么香」独立选香路径的单测。
 *
 * 守三件事：① 同一天 + 同一组选择必须完全确定（分享/刷新不漂移）；
 * ② 所有信号只软加减、绝不硬过滤到空；③ 文案不碰合规红线。
 * 不测具体香水名——那是调权重的产物，锁死会让日签式调优没法做。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCENE_TAGS,
  MOOD_TAGS,
  QUESTION_STEPS,
  pickScent,
} from "../lib/scentPicker";

const DATE = "2026-11-22";

test("标签集合：4 个现有场景 + 5 个小情绪，key 不重复", () => {
  assert.equal(SCENE_TAGS.length, 4);
  assert.equal(MOOD_TAGS.length, 5);
  const keys = [...SCENE_TAGS, ...MOOD_TAGS].map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("同日同选择结果完全确定", () => {
  const a = pickScent({ scene: "office", mood: "refresh", dateKey: DATE });
  const b = pickScent({ scene: "office", mood: "refresh", dateKey: DATE });
  assert.deepEqual(a, b);
  assert.ok(a);
});

test("场景、情绪、场景+情绪+预算 都能给出结果（无硬过滤）", () => {
  const cases = [
    pickScent({ scene: "solo", dateKey: DATE }),
    pickScent({ mood: "invisible", dateKey: DATE }),
    pickScent({ scene: "date", mood: "seen", budget: "low", dateKey: DATE }),
    pickScent({ scene: "travel", mood: "refresh", budget: "high", dateKey: DATE }),
  ];
  for (const c of cases) {
    assert.ok(c, "不能因为标签/预算把候选筛到空");
    assert.ok(c.name.length > 0);
    assert.ok(c.brand.length > 0);
    assert.ok(c.notes.top.length + c.notes.heart.length + c.notes.base.length > 0);
    assert.ok(c.reason.length > 0 && !c.reason.includes("{note}"));
  }
});

test("不同标签至少能产生不同候选（自主选择真的生效）", () => {
  const names = new Set(
    [...SCENE_TAGS, ...MOOD_TAGS].map(
      (t) => pickScent({ scene: t.key, dateKey: DATE })?.name ?? "",
    ),
  );
  assert.ok(names.size >= 2, "所有标签都推同一支香说明权重没起作用");
});

test("结构化提问是三步固定选项、无自由输入", () => {
  assert.equal(QUESTION_STEPS.length, 3);
  assert.deepEqual(QUESTION_STEPS.map((s) => s.key), ["scene", "mood", "budget"]);
  for (const s of QUESTION_STEPS) {
    assert.ok(s.options.length >= 3);
    for (const o of s.options) assert.ok(typeof o.t === "string" && o.t.length > 0);
  }
});

test("结果文案不碰合规红线（迷信 / 医疗 / 财务 / 治愈）", () => {
  const banned = ["治愈", "疗愈", "转运", "改命", "招桃花", "灵验", "命中注定", "疗效", "投资建议"];
  const all = [...SCENE_TAGS, ...MOOD_TAGS].flatMap((t) => [
    t.label, t.hint, t.reason,
    pickScent({ scene: t.key, dateKey: DATE })?.reason ?? "",
  ]);
  for (const text of all) {
    for (const w of banned) assert.ok(!text.includes(w), `文案含禁用词「${w}」：${text}`);
  }
});
