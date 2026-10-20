/**
 * gen-narratives.ts —— 人格 × 香水「为什么是你」文案生成
 *
 * 这是 L1 离线生成的第一条管线。默认只跑 8 条样本（够看质量，又不烧钱），
 * 确认满意后再 `--limit 0` 跑全量。
 *
 * ⚠️ 三条硬原则（改 prompt 时别破）：
 *  1. **事实全部注入**：香水名/品牌/三调/扩散/留香/价位都从 PERFUMES 出来塞进 prompt，
 *     模型没有任何编造空间。它只负责「把人格与香气的关系讲动人」。
 *  2. **生成后必须过闸**：`contentGuard` 扫红线词 + `checkPriceClaims` 扫编造价格。
 *  3. **读回实际模型名**：公示与成本核算以供应商实际用的那个为准。
 *
 * 用法：
 *   npx tsx scripts/gen-narratives.ts                 # 8 条样本
 *   npx tsx scripts/gen-narratives.ts --limit 0       # 全量（16 人格 × 各 3 支）
 *   npx tsx scripts/gen-narratives.ts --model smart   # 换更强模型对比质量
 */

import "./_env";
import { PERSONALITY_TYPES, PERFUMES } from "@/lib/data";
import { getCalibratedRecommendations } from "@/lib/matchPerfumes";
import { findPerfume } from "@/lib/discover";
import { checkCopy, checkPriceClaims, checkNoteClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { chatJson, type ModelAlias } from "@/lib/ai/client";

const SYSTEM = [
  "你是 Crush 香鉴的文案撰写者。品牌调性：克制、高级、留白，像一句短诗，不像广告。",
  "",
  "硬规则（违反任何一条都不合格）：",
  "1. 只用我给你的事实。不得编造香水名、品牌、香调、价格、产地。",
  "   香调尤其严格：只能用「三调」里列出的那些词，**一个字都不要改**，",
  "   不得替换成近义词或上位词（例如「橙」不能写成「橙花」，「玫瑰」不能写成「白花」），",
  "   不得补充任何我没列出的香料。",
  "2. 禁止医疗与疗效暗示（治愈、助眠、安神、镇静、消炎…）。情绪词一律用「舒缓」。",
  "3. 禁止迷信与宿命表述（转运、命定、命中注定、招桃花、招财…）。这是趣味人格侧写，不是命理。",
  "4. 不得写成心理诊断：不要说「你的深层性格」「你其实害怕」，只谈气味与氛围。",
  "5. 不得出现任何价格数字与货币符号。",
  "6. 不得出现极限承诺词（绝对、永久、100%、顶级）。",
  "7. 只输出 JSON，不要解释。",
].join("\n");

interface Narrative {
  line1: string;
  line2: string;
}

function buildPrompt(f: {
  pName: string;
  tagline: string;
  scentDirection: string;
  radar: string;
  perfume: string;
  brand: string;
  notes: string;
  intensity: number;
  longevity: number;
  priceRange: string;
  role: string;
}): string {
  return [
    `人格：${f.pName}`,
    `人格一句话：${f.tagline}`,
    `香气方向：${f.scentDirection}`,
    `六维香气偏好（0-100）：${f.radar}`,
    ``,
    `这支香：${f.perfume}（${f.brand}）`,
    `三调：${f.notes}`,
    `扩散 ${f.intensity}/5，留香 ${f.longevity}/5`,
    `价位档：${f.priceRange}`,
    `它在推荐中的角色：${f.role}`,
    ``,
    `写两句「为什么是你」：`,
    `- line1：人格气质与这支香气的呼应（不超过 30 字）`,
    `- line2：它的气味气质，以及适合出现在什么时刻（不超过 30 字）`,
    ``,
    `输出 JSON：{"line1":"...","line2":"..."}`,
  ].join("\n");
}

const ROLE_CN: Record<string, string> = {
  signature: "本命香",
  advanced: "进阶香",
  budget: "尝试香",
};

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 8;
  const model = (args.includes("--model") ? args[args.indexOf("--model") + 1] : "fast") as ModelAlias;
  const limit = Number.isFinite(limitArg) ? limitArg : 8;

  console.log(`══════ 人格×香水文案生成（model=${model}, limit=${limit || "全量"}）══════\n`);

  const tasks: Array<Record<string, string> & { intensity: number; longevity: number; price: { min: number; max: number } | null }> = [];

  for (const p of PERSONALITY_TYPES) {
    const raw = p.radarScores as unknown as Record<string, number>;
    const radar = {
      floral: (raw.floral ?? 50) / 100,
      woody: (raw.woody ?? 50) / 100,
      fresh: (raw.fresh ?? 50) / 100,
      oriental: (raw.oriental ?? 50) / 100,
      citrus: (raw.citrus ?? 50) / 100,
      gourmand: (raw.gourmand ?? 50) / 100,
    };
    const recs = getCalibratedRecommendations(radar, ["cal1b", "cal2b", "cal3b"], [], p.id, true);
    for (const r of recs) {
      // ⚠️ 推荐给的是**展示名**，香水库里有 2 支「键≠名」。
      // 直接 PERFUMES[name] 会落空 —— 必须走 findPerfume（兼容按键/按名两种查法）。
      const pf = findPerfume(r.name);
      if (!pf) continue;
      tasks.push({
        pName: p.name,
        tagline: p.tagline,
        scentDirection: p.scentDirection,
        radar: `花香 ${raw.floral} / 木质 ${raw.woody} / 清新 ${raw.fresh} / 东方 ${raw.oriental} / 柑橘 ${raw.citrus} / 美食 ${raw.gourmand}`,
        perfume: pf.name,
        brand: pf.brandCn || pf.brand,
        notes: `前 ${pf.notes.top.join("、")}；中 ${pf.notes.heart.join("、")}；后 ${pf.notes.base.join("、")}`,
        intensity: pf.intensity,
        longevity: pf.longevity,
        role: ROLE_CN[r.role] ?? r.role,
        price: parseRangeForGuard(pf.priceRange),
      });
      if (limit > 0 && tasks.length >= limit) break;
    }
    if (limit > 0 && tasks.length >= limit) break;
  }

  // 香调白名单：225 支香真实三调的并集（唯一真源，不从别处抄词表）
  const vocab = buildNoteVocabulary(PERFUMES);
  console.log(`待生成：${tasks.length} 条（香调词表 ${vocab.length} 条）\n`);

  let okCount = 0;
  let badCount = 0;
  let totalTokens = 0;
  const actualModels = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const prompt = buildPrompt(t);
    try {
      const r = await chatJson<Narrative>({ model, system: SYSTEM, prompt });
      actualModels.add(r.actualModel);
      totalTokens += r.usage?.totalTokens ?? 0;

      const text = `${r.data.line1} ${r.data.line2}`;
      const guardHits = checkCopy(text);
      const priceHits = checkPriceClaims(text, t.price);
      // 香调白名单：模型必须只用这支香真实拥有的香调词（实测抓到过「橙」被写成「橙花」）
      const noteHits = checkNoteClaims(text, findPerfume(t.perfume), vocab);
      const blocks = [...guardHits, ...priceHits, ...noteHits].filter((v) => v.severity === "block");

      console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}（${t.brand}·${t.role}）`);
      console.log(`   ${r.data.line1}`);
      console.log(`   ${r.data.line2}`);
      if (blocks.length === 0) {
        console.log(`   ✅ 过闸`);
        okCount++;
      } else {
        console.log(`   ❌ 未过闸：${blocks.map((b) => `${b.label}「${b.word}」`).join("；")}`);
        badCount++;
      }
      console.log("");
    } catch (e) {
      console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}`);
      console.log(`   ❌ 生成失败：${(e as Error).message}\n`);
      badCount++;
    }
  }

  console.log("══════ 汇总 ══════");
  console.log(`  过闸 ${okCount} / 失败 ${badCount}`);
  console.log(`  实际模型：${[...actualModels].join(", ") || "-"}`);
  console.log(`  累计 token：${totalTokens}`);
  if (okCount + badCount > 0) {
    const perItem = Math.round(totalTokens / (okCount + badCount));
    console.log(`  单条均值：${perItem} token`);
  }
  if (badCount > 0) {
    console.log("\n  ⚠️ 有未过闸项，先修 prompt 或词表，别把脏文案进静态文件。");
    process.exit(1);
  }
}

/** 只为给 checkPriceClaims 提供区间；这里不解析价格就不校验价格主张 */
function parseRangeForGuard(_raw: string): { min: number; max: number } | null {
  // 文案里不允许出现价格，所以直接返回 null → 出现任何 ¥ 数字都算违规
  return null;
}

main();
