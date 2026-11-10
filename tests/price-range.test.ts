/**
 * priceRange 纯函数单测。
 *
 * 重点不是「能解析」，而是守住三条曾被踩过的口径：
 *   ① 解析失败返回 null，绝不返回 0（否则预算过滤会把未知价全放行）；
 *   ② withinBudget 是三态，价格未知必须返回 null 交回调用方；
 *   ③ 按区间**下限**判断买不买得起，不是上限。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePriceRange,
  withinBudget,
  formatPriceRange,
} from "../lib/priceRange";

test("解析失败一律返回 null，不返回 0", () => {
  for (const raw of [undefined, null, "", "   ", "价格待确认", "abc", "¥", "$1200"]) {
    assert.equal(parsePriceRange(raw), null, `应返回 null：${String(raw)}`);
  }
});

test("零价 / 负容量不能混进结果", () => {
  assert.equal(parsePriceRange("¥0/50ml"), null);
  assert.equal(parsePriceRange("¥1200/-5ml"), null);
  // 容量为 0 时价格本身仍有效，只是每毫升价格不可用（降级为 null）
  const zeroCap = parsePriceRange("¥1200/0ml");
  assert.ok(zeroCap);
  assert.equal(zeroCap.capacityMl, null);
  assert.equal(zeroCap.perMlMin, null);
});

test("区间 + 容量：min/max/mid 与每毫升价格一致", () => {
  const p = parsePriceRange("¥1200-1600/50ml");
  assert.ok(p);
  assert.equal(p.currency, "CNY");
  assert.equal(p.min, 1200);
  assert.equal(p.max, 1600);
  assert.equal(p.mid, 1400);
  assert.equal(p.capacityMl, 50);
  assert.equal(p.perMlMin, 24);
  assert.equal(p.perMlMax, 32);
  assert.equal(p.perMlMid, 28);
});

test("全角 / 异体 / 空格写法归一后仍可解析", () => {
  const p = parsePriceRange(" ￥1200－1600／50毫升 ");
  assert.ok(p);
  assert.equal(p.min, 1200);
  assert.equal(p.max, 1600);
  assert.equal(p.capacityMl, 50);
});

test("区间写反了会自动交换，不会产出 min > max", () => {
  const p = parsePriceRange("¥1600-1200");
  assert.ok(p);
  assert.equal(p.min, 1200);
  assert.equal(p.max, 1600);
});

test("单值 / 无容量：perMl 一律为 null，但价格仍可用", () => {
  const single = parsePriceRange("¥890/30ml");
  assert.ok(single);
  assert.equal(single.min, 890);
  assert.equal(single.max, 890);
  assert.equal(single.perMlMin, 29.67);

  const noCap = parsePriceRange("¥890");
  assert.ok(noCap);
  assert.equal(noCap.capacityMl, null);
  assert.equal(noCap.perMlMin, null);
  assert.equal(noCap.perMlMid, null);
});

test("withinBudget 三态，且按区间下限判断", () => {
  const p = parsePriceRange("¥1200-1600/50ml");
  assert.equal(withinBudget(p, 1300), true, "下限 1200 ≤ 1300 → 仍有买得起的可能");
  assert.equal(withinBudget(p, 1000), false);
  assert.equal(withinBudget(null, 1300), null, "价格未知必须交回调用方");
  assert.equal(withinBudget(p, 0), null);
  assert.equal(withinBudget(p, Number.NaN), null);
});

test("formatPriceRange 往返口径一致", () => {
  assert.equal(formatPriceRange(parsePriceRange("¥1200-1600/50ml")), "¥1200-1600/50ml");
  assert.equal(formatPriceRange(parsePriceRange("¥890")), "¥890");
  assert.equal(formatPriceRange(null), "价格待确认");
});
