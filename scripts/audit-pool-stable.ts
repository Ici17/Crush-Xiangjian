// 校验「香水库快照」改造后，历史日期的抽签结果与旧算法完全一致
//
// 旧算法直接依赖 Object.keys(PERFUMES) 的顺序与长度；
// 新算法依赖冻结的 lib/daily/pool.ts。本脚本把两套算法对同一批日期各跑一遍，
// 逐支比对香名与稀有度，确保改造没有改写任何历史结果。
//
// 用法：npx tsx scripts/verify-pool-stable.ts

import { PERFUMES } from "../lib/data";
import { drawDaily } from "../lib/daily/draw";

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(rng: () => number): string {
  const r = rng();
  if (r < 0.6) return "chang";
  if (r < 0.9) return "ya";
  return "yin";
}

// 改造前的原始实现（保留作参照）
function legacyDraw(dateStr: string) {
  const names = Object.keys(PERFUMES);
  const rng = mulberry32(hashStr(`crush-daily-${dateStr}`));
  const pool = names.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // 注意：原始实现返回的是 Perfume 对象的 name 字段，
  // 而非对象的 key —— 两者命名风格并不总是一致
  // （例如 key 为「墨水-川久保玲」，name 为「墨水（川久保玲）」），照抄差异会造成误报。
  const picked = pool.slice(0, 3).map((id) => PERFUMES[id]);
  return [
    `${picked[0].name}|${rollRarity(rng)}`,
    `${picked[1].name}|${rollRarity(rng)}`,
    `${picked[2].name}|${rollRarity(rng)}`,
  ];
}

function dateStrOffset(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

let checked = 0;
let mismatch = 0;

for (let offset = -365; offset <= 60; offset++) {
  const dateStr = dateStrOffset(offset);
  const legacy = legacyDraw(dateStr);
  const curr = drawDaily(dateStr);
  const now = [
    `${curr.main.name}|${curr.main.rarity}`,
    `${curr.inspirations[0].name}|${curr.inspirations[0].rarity}`,
    `${curr.inspirations[1].name}|${curr.inspirations[1].rarity}`,
  ];
  checked++;
  for (let i = 0; i < 3; i++) {
    if (legacy[i] !== now[i]) {
      mismatch++;
      console.log(`不一致 ${dateStr} 第${i + 1}签：旧=${legacy[i]} 新=${now[i]}`);
    }
  }
}

// 确定性复核：同一天连续调用两次必须完全一样
const probe = dateStrOffset(0);
const a = drawDaily(probe);
const b = drawDaily(probe);
const stable =
  a.main.name === b.main.name &&
  a.main.rarity === b.main.rarity &&
  a.inspirations[0].name === b.inspirations[0].name &&
  a.inspirations[1].name === b.inspirations[1].name;

console.log("");
console.log(`比对日期数：${checked}（过去 365 天 ~ 未来 60 天）`);
console.log(`不一致条目：${mismatch}`);
console.log(`同日两次调用稳定：${stable ? "是" : "否"}`);
console.log(`今日(${probe})主香：${a.main.name} / 稀有度 ${a.main.rarity}`);
console.log("");
console.log(mismatch === 0 && stable ? "校验通过：历史结果零改动" : "校验失败");
