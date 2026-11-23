/**
 * 内容配置发布校验的单测。
 * 守住「后台一发布就改坏 13 题 / 225 香Water / 价格带基线」这条线。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfigValue, CONFIG_BASELINE } from "../lib/content/validate";
import { PERFUMES } from "../lib/data";
import { QUESTIONS, TOTAL_QUESTION_COUNT } from "../lib/branchingQuestions";

test("基线数字来自真源，不是写死的 13/225", () => {
  assert.equal(CONFIG_BASELINE.totalQuestions, TOTAL_QUESTION_COUNT);
  assert.equal(CONFIG_BASELINE.perfumes, Object.keys(PERFUMES).length);
  assert.ok(Object.keys(QUESTIONS).length > 0);
});

test("题库发布：数量不符必须拦下", () => {
  const questions = Object.values(QUESTIONS);
  assert.equal(validateConfigValue("config.questions", QUESTIONS).ok, true);
  assert.equal(validateConfigValue("config.questions", questions).ok, true);
  const bad = validateConfigValue("config.questions", questions.slice(0, 2));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.error.includes("题库数量"));
});

test("香水库发布：数量不符必须拦下（可达率门禁依赖 225）", () => {
  const good = Object.fromEntries(Object.entries(PERFUMES).map(([k, p]) => [k, { name: p.name }]));
  assert.equal(validateConfigValue("config.perfumes", good).ok, true);
  const bad = validateConfigValue("config.perfumes", { only_one: { name: "x" } });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.error.includes("可达率"));
});

test("价格带发布：解析失败的价格必须拦下", () => {
  assert.equal(validateConfigValue("config.priceRanges", { a: "¥100-300" }).ok, true);
  const bad = validateConfigValue("config.priceRanges", { a: "随便写写" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.error.includes("解析失败"));
});

test("展示文案不做结构校验（草稿与发布都允许）", () => {
  assert.equal(validateConfigValue("copy.home.cost_line", "随便一句").ok, true);
});
