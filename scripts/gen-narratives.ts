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
import * as fs from "node:fs";
import * as path from "node:path";
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
  "   **香调词只能用来描述这支香本身** —— 不要拿它形容人格、心情，也不要做比喻",
  "   （不要写「海盐般的清透」「带着海盐的活力」这类；这支香没有的香调，一个字都别提）。",
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
  const emit = args.includes("--emit");

  console.log(`══════ 人格×香水文案生成（model=${model}, limit=${limit || "全量"}, emit=${emit}）══════\n`);

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
  /** 过闸的条目，--emit 时落盘 */
  const results: Array<{ key: string; line1: string; line2: string }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const prompt = buildPrompt(t);
    const pf = findPerfume(t.perfume);
    let done = false;

    // 单条最多 3 次：模型偶发编造香调或吐坏 JSON，重试通常就好了。
    // 批量生成时「整批重跑」比「逐条重试」贵得多，所以这里必须逐条重试。
    let correction = "";
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        // 把上一次的违规词回喂给它自我纠正 —— 单纯重试同一 prompt 会一直犯同一个错
        const r = await chatJson<Narrative>({
          model,
          system: SYSTEM,
          prompt: correction ? `${prompt}\n\n${correction}` : prompt,
        });
        actualModels.add(r.actualModel);
        totalTokens += r.usage?.totalTokens ?? 0;

        const text = `${r.data.line1} ${r.data.line2}`;
        const blocks = [
          ...checkCopy(text),
          ...checkPriceClaims(text, t.price),
          // 香调白名单：模型必须只用这支香真实拥有的香调词（实测抓到过「橙」被写成「橙花」）
          ...checkNoteClaims(text, pf, vocab),
        ].filter((v) => v.severity === "block");

        if (blocks.length !== 0) {
          const bad = blocks.map((b) => b.word).filter((w) => w && w !== "¥");
          correction = bad.length
            ? `修正要求：上一次你用了 ${[...new Set(bad)].map((w) => `「${w}」`).join("、")}，` +
              `但这支香并没有这些香调。请只使用上面「三调」里列出的词重写，不要再做比喻。`
            : "修正要求：上一次的输出不符合规则，请严格按规则重写。";
        }

        if (blocks.length === 0) {
          console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}（${t.brand}·${t.role}）`);
          console.log(`   ${r.data.line1}`);
          console.log(`   ${r.data.line2}`);
          console.log(`   ✅ 过闸${attempt > 1 ? `（第 ${attempt} 次）` : ""}`);
          okCount++;
          results.push({
            key: `${t.pName}::${t.perfume}`,
            line1: r.data.line1.trim(),
            line2: r.data.line2.trim(),
          });
          done = true;
        } else if (attempt === 3) {
          const why = blocks.map((b) => `${b.label}「${b.word}」`).join("；");
          console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}（${t.brand}·${t.role}）`);
          console.log(`   ❌ 重试 3 次仍未过闸：${why}`);
          badCount++;
        }
      } catch (e) {
        if (attempt === 3) {
          console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}`);
          console.log(`   ❌ 生成失败：${(e as Error).message}`);
          badCount++;
        }
      }
    }
    console.log("");
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
    if (emit) {
      console.log("  ⛔ 已 --emit 但存在失败项 → **拒绝写文件**。");
      console.log("     宁可少几条，也不能把没过闸的文案固化成静态数据。");
    }
    process.exit(1);
  }

  if (emit) {
    writeNarratives(results, [...actualModels].join(", ") || "unknown");
  }
}

/**
 * 落静态文件。
 *
 * ⚠️ 文件头必须标「自动生成，勿手改」—— 与 perfumeSemantics.ts 同一套约定：
 * 手改会在下次生成时被静默覆盖，而且没人知道改过什么。
 */
function writeNarratives(
  rows: Array<{ key: string; line1: string; line2: string }>,
  modelUsed: string,
): void {
  const outPath = path.join(process.cwd(), "lib", "data", "perfumeNarratives.ts");
  const body = rows
    .map(
      (r) =>
        `  ${JSON.stringify(r.key)}: { line1: ${JSON.stringify(r.line1)}, line2: ${JSON.stringify(r.line2)} },`,
    )
    .join("\n");

  const src = `// ============================================================
// ⚠️ 本文件由 scripts/gen-narratives.ts 自动生成，请勿手改。
//    改文案请改生成脚本的 prompt（或改词典后重跑），手改会在下次生成时被静默覆盖。
//
// L1 离线生成产物：人格 × 香水 的「为什么是你」双句解读。
//   键格式："人格名::香水展示名"
//   运行时只读本表，零 LLM 调用、零延迟、完全可复现。
//   覆盖度与文案合规由 scripts/audit-perfume-data.ts 的 F 项守着。
//
// 生成信息：
//   条数    ${rows.length}
//   模型    ${modelUsed}
//   时间    ${new Date().toISOString()}
// ============================================================

export interface PerfumeNarrative {
  /** 人格气质与这支香气的呼应 */
  line1: string;
  /** 它的气味气质，以及适合出现的时刻 */
  line2: string;
}

export const PERFUME_NARRATIVES: Record<string, PerfumeNarrative> = {
${body}
};

/** 取文案；没有则返回 null（调用方自行决定是否展示） */
export function getNarrative(
  personalityName: string,
  perfumeName: string,
): PerfumeNarrative | null {
  return PERFUME_NARRATIVES[\`\${personalityName}::\${perfumeName}\`] ?? null;
}
`;

  fs.writeFileSync(outPath, src, "utf8");
  console.log(`\n  💾 已写入 ${path.relative(process.cwd(), outPath)}（${rows.length} 条）`);
}

/** 只为给 checkPriceClaims 提供区间；这里不解析价格就不校验价格主张 */
function parseRangeForGuard(_raw: string): { min: number; max: number } | null {
  // 文案里不允许出现价格，所以直接返回 null → 出现任何 ¥ 数字都算违规
  return null;
}

main();
