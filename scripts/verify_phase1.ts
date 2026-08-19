import { drawAlmanac } from '@/lib/daily/almanac';
import { PERSONALITIES, getGuardianPerfume } from '@/lib/personalities';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('❌ ' + msg);
    process.exit(1);
  }
  console.log('✅ ' + msg);
}

// ── 1. 宜忌确定性 ──
const dates = ['2026-08-20', '2026-01-01', '2026-12-31', '2025-02-14'];
for (const d of dates) {
  const a1 = drawAlmanac(d);
  const a2 = drawAlmanac(d);
  assert(
    JSON.stringify(a1) === JSON.stringify(a2),
    `宜忌确定性 ${d}：两次调用结果一致`,
  );
  assert(a1.yi.length === 3 && a1.ji.length === 3, `宜忌数量 ${d}：宜3忌3`);
  // 宜与忌不重叠（合规：不能同一件事既宜又忌）
  const overlap = a1.yi.filter((x) => a1.ji.includes(x));
  assert(overlap.length === 0, `宜忌无重叠 ${d}`);
  assert(typeof a1.note === 'string' && a1.note.length > 0, `今日一语非空 ${d}`);
}

// ── 2. 图鉴解析 16 支，全部非空、互不重复 ──
const names = (PERSONALITIES as { name: string }[]).map((p) => p.name);
assert(names.length === 16, `人格数 = 16（实际 ${names.length}）`);

const resolved = names.map((n) => ({ n, g: getGuardianPerfume(n) }));
assert(resolved.every((r) => r.g !== null), '16 人格守护香全部解析成功（无 null）');

const perfumes = resolved.map((r) => r.g!.name);
const unique = new Set(perfumes);
assert(unique.size === 16, `守护香互不重复（去重后 ${unique.size}/16）`);

// 各档位印分布
const seals = resolved.map((r) => r.g!.seal);
const sealCounts = seals.reduce<Record<string, number>>((acc, s) => {
  acc[s] = (acc[s] ?? 0) + 1;
  return acc;
}, {});
console.log('   印档分布：', JSON.stringify(sealCounts));
assert(Object.keys(sealCounts).length >= 2, '印档分布合理（多档位）');

console.log('\n🎉 Phase 1 数据层全部验证通过');
