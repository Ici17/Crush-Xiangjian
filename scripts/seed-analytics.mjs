/**
 * 本地灌入模拟埋点数据，用来验证 /admin 看板（仅 dev 用）。
 *
 * 用法：
 *   node scripts/seed-analytics.mjs                       # 默认 http://localhost:3456，14 天
 *   node scripts/seed-analytics.mjs http://localhost:3000 30
 */

const BASE = process.argv[2] || 'http://localhost:3456';
const DAYS = Number(process.argv[3] || 14) || 14;

const PERSONALITIES = [
  '暗流', '荒岛', '残温', '裂岸', '寒岭', '极夜', '砾迹', '冲浪',
  '温砾', '空号', '冷砚', '渊海', '沉湾', '霜冷', '荒原', '烬生',
];
const REFS = ['直接访问', '微信', '小红书', '抖音', '微博', '百度', '知乎', 'Google'];
const PATHS = ['/', '/question', '/result', '/friend', '/codex'];
const TIERS = ['极高', '很高', '较高', '一般', '较低'];
const PRICES = ['unlockFull', 'unlockDiscounted'];
const CONTEXTS = ['full', 'perfume', 'preference'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

function shanghaiDateKey(ts) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(ts));
  const g = (t) => parts.find((p) => p.type === t)?.value ?? '01';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

async function post(payload) {
  const res = await fetch(`${BASE}/api/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`HTTP ${res.status}`);
  }
}

async function main() {
  console.log(`→ 向 ${BASE} 灌入 ${DAYS} 天模拟数据…`);
  let count = 0;
  const now = Date.now();

  for (let d = DAYS - 1; d >= 0; d -= 1) {
    const dayStart = now - d * 86400000;
    const sessions = 8 + Math.floor(Math.random() * 22); // 每日 8~30 个匿名访客

    for (let s = 0; s < sessions; s += 1) {
      const sessionId = `seed_${shanghaiDateKey(dayStart)}_${s}_${Math.random().toString(36).slice(2, 8)}`;
      const ref = rand(REFS);
      const ts = dayStart - Math.floor(Math.random() * 3600000);
      const send = (event, props = {}, path = '/') =>
        post({ event, props, sessionId, path, ref, ts: ts + Math.floor(Math.random() * 600000) });

      await send('page_view', {}, '/');
      count += 1;

      if (!chance(0.82)) continue; // 一部分直接离开

      await send('test_start', {}, '/');
      count += 1;

      // 问卷中途流失
      for (let q = 0; q < 2; q += 1) {
        if (chance(0.6)) { await send('page_view', {}, '/question'); count += 1; }
      }

      if (!chance(0.68)) continue;

      const personality = rand(PERSONALITIES);
      await send('test_complete', { personality }, '/result');
      count += 1;

      if (chance(0.35)) {
        await send('share_card_generate', { scene: 'self', format: '3to4', personality }, '/result');
        count += 1;
      }
      if (chance(0.18)) {
        await send('friend_match_start', {}, '/friend');
        count += 1;
        if (chance(0.7)) {
          await send('friend_match_complete', { tier: rand(TIERS) }, '/friend');
          count += 1;
        }
      }
      if (chance(0.22)) {
        const price = rand(PRICES);
        await send('pay_modal_open', { price, context: rand(CONTEXTS) }, '/result');
        count += 1;
        if (chance(0.45)) {
          await send('pay_claim', { price, context: 'full' }, '/result');
          count += 1;
        }
      }
      if (chance(0.25)) {
        await send('daily_draw', { sign: rand(['常', '雅', '隐']) }, '/');
        count += 1;
      }
      if (chance(0.12)) {
        await send('page_view', {}, rand(PATHS));
        count += 1;
      }
    }
    process.stdout.write(`\r  ${shanghaiDateKey(dayStart)} 完成，累计 ${count} 条`);
  }

  console.log(`\n✔ 共上报 ${count} 条事件。打开 ${BASE}/admin 查看（本地口令见 ADMIN.md）`);
}

main().catch((e) => {
  console.error('✖ 失败：', e.message);
  console.error('  确认 dev server 已启动，或指定端口：node scripts/seed-analytics.mjs http://localhost:3456');
  process.exit(1);
});
