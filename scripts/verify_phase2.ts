// 验证 Phase2：香气历 streak/freeze 逻辑 + daily 分享卡并入宜忌
import { markVisited, getStreakView, titleFor } from '@/lib/daily/history';
import { renderShareCard, type DailyShareData } from '@/lib/shareCardRender';
import { drawDaily, getTodayStr, RARITY_LABEL, type DrawnPerfume } from '@/lib/daily/draw';
import { drawAlmanac } from '@/lib/daily/almanac';

// ── mock localStorage ──
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
(globalThis as any).localStorage = new MemStorage();

function addDays(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

let pass = 0, fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.log('  ❌', msg); }
}

async function main() {
  console.log('\n— 1. 连续 + 里程碑发令牌 + freeze 补断点 —');
  const base = '2026-08-20';
  // 签 08-10..08-16（连续7天，第7天发令牌）
  let r: any;
  for (let i = 10; i <= 16; i++) r = markVisited(`2026-08-${String(i).padStart(2, '0')}`);
  assert(r.view.current === 7, `连续7天 current=7 (实际 ${r.view.current})`);
  assert(r.grantedFreeze === true, '第7天获赠续签令牌');
  assert(r.view.freezes === 1, `freezes=1 (实际 ${r.view.freezes})`);
  assert(r.view.title.name === '初嗅', `称号=初嗅 (实际 ${r.view.title.name})`);
  // 签 08-17, 08-18（连续 → current 9，未到14天不再发）
  r = markVisited('2026-08-17'); r = markVisited('2026-08-18');
  assert(r.view.freezes === 1, `未到14天不增发 freezes 仍=1 (实际 ${r.view.freezes})`);
  // 断 08-19，签 08-20（今天）：用令牌补 08-19
  r = markVisited(base);
  assert(r.frozeGap === true, '断一天被续签令牌补上');
  assert(r.view.freezes === 0, `freezes 消耗归 0 (实际 ${r.view.freezes})`);
  const v = getStreakView(base);
  assert(v.current === 11, `续上后 current=11 (实际 ${v.current})`);
  assert(v.best === 11, `best=11 (实际 ${v.best})`);

  console.log('\n— 2. 无令牌断点归零 —');
  (globalThis as any).localStorage = new MemStorage(); // reset
  markVisited('2026-08-15'); markVisited('2026-08-16');
  const v2 = markVisited('2026-08-18'); // 跳过 17
  assert(v2.view.current === 1, `跳过一天 current 重置为1 (实际 ${v2.view.current})`);
  assert(v2.view.freezes === 0, '无令牌可消耗');

  console.log('\n— 3. title 阈值 —');
  assert(titleFor(6).name === '初遇香气', 'best<7 无称号');
  assert(titleFor(7).name === '初嗅', 'best>=7 初嗅');
  assert(titleFor(30).name === '沉香客', 'best>=30 沉香客');
  assert(titleFor(100).name === '一缕成香', 'best>=100 一缕成香');
  assert(titleFor(400).name === '香气旧友', 'best>=365 香气旧友');

  console.log('\n— 4. monthGrid 当月分类 —');
  (globalThis as any).localStorage = new MemStorage();
  markVisited('2026-08-10'); markVisited('2026-08-20'); // 两个 visited
  const v3 = getStreakView('2026-08-20');
  const todayCell = v3.monthGrid.find((c) => c.kind === 'today');
  const visitedCells = v3.monthGrid.filter((c) => c.kind === 'visited');
  const missedCells = v3.monthGrid.filter((c) => c.kind === 'missed');
  const futureCells = v3.monthGrid.filter((c) => c.kind === 'future');
  assert(!!todayCell && todayCell.day === 20, 'today 格落在 20 号');
  assert(visitedCells.length === 1, `visited=1 (仅 08-10，today 单独分类，实际 ${visitedCells.length})`);
  assert(missedCells.length === 18, `missed=18 (08-01..09 与 08-11..19，实际 ${missedCells.length})`);
  assert(futureCells.length === 11, `future=11 (08-21..31，实际 ${futureCells.length})`);

  console.log('\n— 5. daily 分享卡并入宜忌（3:4 长图）—');
  const dates = ['2026-08-20', '2026-01-01', '2026-12-31'];
  const fmts: '3to4'[] = ['3to4'];
  for (const date of dates) {
    const draw = drawDaily(date);
    const alm = drawAlmanac(date);
    const fmt = (p: DrawnPerfume) => ({
      name: p.name, brandCn: p.brandCn,
      notes: `前 ${p.notes.top.join('·')} ｜ 中 ${p.notes.heart.join('·')} ｜ 后 ${p.notes.base.join('·')}`,
      rarity: RARITY_LABEL[p.rarity],
    });
    const data: DailyShareData = {
      scene: 'daily', date,
      main: fmt(draw.main),
      inspirationA: fmt(draw.inspirations[0]),
      inspirationB: fmt(draw.inspirations[1]),
      almanac: { yi: alm.yi, ji: alm.ji, note: alm.note },
    };
    for (const f of fmts) {
      const buf = await renderShareCard(data, f);
      const ok = buf.byteLength > 1000 && alm.yi.length === 3 && alm.ji.length === 3;
      assert(ok, `daily ${date} ${f} 含宜忌渲染 (${buf.byteLength} bytes, 宜${alm.yi.length}/忌${alm.ji.length})`);
    }
  }
  // 额外存一张 3:4 长图到 /tmp 供视觉确认（1:1 已下线）
  const draw = drawDaily('2026-08-20');
  const alm = drawAlmanac('2026-08-20');
  const fmt = (p: DrawnPerfume) => ({
    name: p.name, brandCn: p.brandCn,
    notes: `前 ${p.notes.top.join('·')} ｜ 中 ${p.notes.heart.join('·')} ｜ 后 ${p.notes.base.join('·')}`,
    rarity: RARITY_LABEL[p.rarity],
  });
  const sample: DailyShareData = {
    scene: 'daily', date: '2026-08-20',
    main: fmt(draw.main),
    inspirationA: fmt(draw.inspirations[0]),
    inspirationB: fmt(draw.inspirations[1]),
    almanac: { yi: alm.yi, ji: alm.ji, note: alm.note },
  };
  const b3 = await renderShareCard(sample, '3to4');
  require('fs').writeFileSync('/tmp/daily_almanac_3.png', b3);
  console.log('  💾 已存 /tmp/daily_almanac_3.png');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
}

main();
