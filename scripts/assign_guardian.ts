// 从完整香水库（225 款）为 16 人格计算「最优不重复」本命守护香分配
// 评分：cosineSimilarity18D（前/中/后调分阶段加权余弦，产品真实匹配算法）
// 求解：匈牙利算法（最大化总契合度 + 香水互不重复）
import { PERFUMES, PERSONALITY_TYPES, type Perfume } from "@/lib/data";
import { getPerfumeProfile18D, cosineSimilarity18D } from "@/lib/matchPerfumes";
import { getRadarScores } from "@/lib/personalities";

const RADAR_CN_TO_EN: Record<string, string> = {
  花香: "floral", 木质: "woody", 清新: "fresh", 东方: "oriental", 柑橘: "citrus", 美食: "gourmand",
};

function radarEn(name: string) {
  const cn = getRadarScores(name);
  const out: Record<string, number> = { floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0 };
  for (const k of Object.keys(cn)) {
    const en = RADAR_CN_TO_EN[k];
    if (en) out[en] = cn[k];
  }
  return out;
}

// 标准匈牙利算法（最小成本，方阵），返回 result[row] = column
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = Infinity;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) res[p[j] - 1] = j - 1;
  return res;
}

function solve(pers: { name: string }[], pool: Perfume[]) {
  const radar = pers.map((p) => radarEn(p.name));
  const profs = pool.map((p) => getPerfumeProfile18D(p));
  const N = pers.length;
  const M = pool.length;
  const scores: number[][] = [];
  for (let i = 0; i < N; i++) {
    const row: number[] = [];
    for (let j = 0; j < M; j++) row.push(cosineSimilarity18D(radar[i], profs[j]));
    scores.push(row);
  }
  // 成本 = 1 - 契合度；用 N 行真实 + (M-N) 行 dummy(成本0) 补齐方阵
  const cost: number[][] = [];
  for (let i = 0; i < N; i++) cost.push(scores[i].map((s) => 1 - s));
  for (let d = 0; d < M - N; d++) cost.push(new Array(M).fill(0));
  const assignCols = hungarian(cost);
  const result: { perfIdx: number; score: number; rank: number }[] = [];
  for (let i = 0; i < N; i++) {
    const j = assignCols[i];
    const ordered = scores[i].map((s, idx) => ({ s, idx })).sort((a, b) => b.s - a.s);
    const rank = ordered.findIndex((o) => o.idx === j) + 1;
    result.push({ perfIdx: j, score: scores[i][j], rank });
  }
  return result;
}

function printTable(title: string, pers: { name: string }[], pool: Perfume[], res: { perfIdx: number; score: number; rank: number }[]) {
  console.log(`\n═══ ${title} ═══`);
  console.log("人格\t本命守护香\t品牌\t档位\t契合%\t该人格内排名");
  const used = new Set<number>();
  for (let i = 0; i < pers.length; i++) {
    const pf = pool[res[i].perfIdx];
    used.add(res[i].perfIdx);
    const tier = pf.tier === "premium" ? "高端" : "平价";
    console.log(
      `${pers[i].name}\t${pf.name}\t${pf.brandCn}\t${tier}\t${Math.round(res[i].score * 100)}\t#${res[i].rank}/${pool.length}`
    );
  }
  // 唯一性校验
  const dup = used.size !== pers.length;
  console.log(`\n唯一性: ${used.size === pers.length ? "✅ 16 支互不重复" : "❌ 有重复"}`);
  const premiumUsed = [...used].filter((idx) => pool[idx].tier === "premium").length;
  console.log(`使用档位: 高端 ${premiumUsed} / 平价 ${used.size - premiumUsed}`);
  const avg = res.reduce((a, b) => a + b.score, 0) / res.length;
  console.log(`平均契合度: ${Math.round(avg * 100)}%`);
  return used;
}

const all = Object.values(PERFUMES);
const premium = all.filter((p) => p.tier === "premium");
const pers = PERSONALITY_TYPES.map((t) => ({ name: t.name }));

console.log(`香水库: 总 ${all.length} 款 | 高端(premium) ${premium.length} 款 | 平价(budget) ${all.length - premium.length} 款`);

// 方案 A：高端专属（本命守护香保持 premium 定位，且互不重复）
const resPremium = premium.length >= pers.length ? solve(pers, premium) : solve(pers, all);
printTable(`方案A · 高端专属本命守护香（推荐）`, pers, premium.length >= pers.length ? premium : all, resPremium);

// 方案 B：全库（含平价，最大化不重复覆盖 + 用满香水库）
const resAll = solve(pers, all);
printTable(`方案B · 全库本命守护香（含平价）`, pers, all, resAll);
