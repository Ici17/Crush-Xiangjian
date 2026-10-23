// ============================================================
// F7 · 单香档案文案离线生成（L1）
//
// 为什么做这个而不是「AI 扩香水库」：
//   香水库缺的不是数量 —— 用户每次只看 3 支，真实可达率已 96.9%，加到 2000 支也不会多看一支。
//   真正缺的是**长尾那批香没有解读、不吸引人**，所以永远沉底。
//   给 225 支各写一条独立的档案文案（不乘人格），成本低、合规安全（文案是表达层，不是事实层）。
//
// ⚠️ 与「扩库」的边界：AI 只写**文案类**字段。
//   价格/容量、三调、扩散/留香、品牌产品名一律不许 AI 生成 —— 那是事实，编了就是假数据。
//
// 用法：
//   npx tsx scripts/gen-perfume-profiles.ts --limit 8          试跑
//   npx tsx scripts/gen-perfume-profiles.ts --limit 0 --emit   全量落盘
//   npx tsx scripts/gen-perfume-profiles.ts --review 12        抽检（不调模型）
//   npx tsx scripts/gen-perfume-profiles.ts --edits-only       只应用人工校订
// ============================================================

import "./_env";
import * as fs from "node:fs";
import * as path from "node:path";
import { PERFUMES } from "@/lib/data";
import { PERFUME_PROFILES } from "@/lib/data/perfumeProfiles";
import {
  checkCopy,
  checkPriceClaims,
  checkNoteClaims,
  buildNoteVocabulary,
} from "@/lib/contentGuard";
import { parsePriceRange } from "@/lib/priceRange";
import { chatJson, type ModelAlias } from "@/lib/ai/client";
import { countNoteWords, echoSegments, MAX_NOTE_WORDS_IN_LINE2 } from "./_narrativeQuality";

const SYSTEM = [
  "你是 Crush 香鉴的文案撰写者，现在给单支香水写「香气档案」。",
  "品牌调性：克制、高级、留白，像一句短诗，不像广告。",
  "",
  "硬规则（违反任何一条都不合格）：",
  "1. 只用我给你的事实。不得编造香调、价格、品牌、产地。",
  "   香调尤其严格：只能用「三调」里列出的那些词，**一个字都不要改**，",
  "   不得替换成近义词或上位词（例如「橙」不能写成「橙花」），不得补充我没列出的香料。",
  "   **香调词只能用来描述这支香本身** —— 不要拿它形容心情，也不要做比喻。",
  "2. 禁止医疗与疗效暗示（治愈、助眠、安神、镇静、消炎…）。情绪词一律用「舒缓」。",
  "3. 禁止迷信与宿命表述（转运、命定、缘分、命中注定、招桃花…）。",
  "4. 不得写成心理诊断（「你其实害怕」），只谈气味与氛围。",
  "5. 不得出现任何价格数字与货币符号。",
  "6. 不得出现极限承诺词（绝对、永久、100%、顶级）。",
  "7. 不得复述我给的「现有描述」，要换个角度写。",
  "8. line 里点到的香调词**最多 2 个**，不要罗列三调。",
  // 9/10 沿用 CP 文案的经验：首轮量化里明喻与拟人句式会塌缩成模板
  "9. line **不得使用明喻词**：像、如同、仿佛、好似。",
  "10. hint 不得用「替你」这类拟人句式。直接写那一刻气息是什么状态。",
  "11. 只输出 JSON，不要解释。",
].join("\n");

interface PerfumeProfileCopy {
  line: string;
  hint: string;
}

/**
 * 写法池（单香版本，与 CP 合香的那套不同 —— 这里没有「你们」，只有这一支香）。
 * 按序号轮转，225 条被分成 8 种写法，分布由我们控制。
 */
const ANGLE_POOL = [
  "写它怎么开场：最先到的是什么",
  "写它停留多久、怎么收尾",
  "写一个具体画面（画面本身，不要用比喻词引出来）",
  "写温度与质感：冷或暖、干或润、轻或沉",
  "写它撑得起什么场合的氛围",
  "写它给人的距离感：亲近还是疏离",
  "直接说它是什么味道，不加任何修饰",
  "写它落在空气里、落在衣料上的感觉",
] as const;

const MOMENT_POOL = [
  "通勤路上",
  "周末出门",
  "睡前",
  "约会",
  "下雨天",
  "出差在途",
  "运动之后",
  "下午茶",
  "人多的场合",
  "一个人待着",
  "换季的时候",
  "要出席的场合",
] as const;

const SIMILE_WORDS = ["如同", "仿佛", "好似", "像"];
const PERSONIFY_WORDS = ["替你", "替我们"];

function angleFor(i: number): string {
  return ANGLE_POOL[i % ANGLE_POOL.length];
}
function momentFor(i: number): string {
  return MOMENT_POOL[i % MOMENT_POOL.length];
}

const HUMAN_EDITS: Record<string, Partial<PerfumeProfileCopy>> = {
  // 2026-10-23 首轮人工审读：225 条里 16 条香调词点了 3–7 个（"毒药"那支点满 7 个），
  // 读起来是成分表。逐条压到 2 个，画面尽量留住。键 = 香水 id。
  "超级雪松": { line: "雪松散得慢，收尾很轻，半天后还有一点底。" },
  "雨后花园": { hint: "雨声里，气息缓缓散开。" },
  "水中影": { line: "黑醋栗叶压着一点花香，青得很安静。" },
  "花之秘境": { line: "橙花与茉莉撑过午后，收得轻。" },
  "灰烬": { line: "焚香先散，皮革沉下来，收在衣角，半日已尽。", hint: "周末出门前喷一点，归来时只剩一点底。" },
  "琥珀君王": { hint: "雨天里，气息沉稳地漫开。" },
  "毒药": { line: "杏仁先甜，玫瑰压在后面，收得很沉。" },
  "银林": { line: "鸢尾带一点凉，蜂蜜压在后面。" },
  "岩兰物语": { line: "衣柜前翻出旧毛衣，岩兰草的气息在领口散开。" },
  "焦糖布蕾": { line: "焦糖与奶油，收尾带一点坚果气。" },
  "茉莉与烟草": { line: "茉莉与烟草散去得慢，最后收得很干。" },
  "五号之水": { line: "柠檬散去后，玫瑰再留几个钟头，收得干净。" },
  "小黑裙": { hint: "雨天室内，气息沉下来，贴近皮肤。" },
  "藤编": { hint: "运动之后，气息收得很干净。" },
  "椰子语": { line: "椰奶散去后，麝香慢慢收尾，大半天才淡去。" },
  "鹿头": { line: "白兰地开场，收尾干净，带一点皂感。" },
};

function applyHumanEdit(key: string, c: PerfumeProfileCopy): PerfumeProfileCopy {
  const e = HUMAN_EDITS[key];
  return e ? { line: e.line ?? c.line, hint: e.hint ?? c.hint } : c;
}

function buildPrompt(f: {
  name: string;
  brand: string;
  top: string;
  heart: string;
  base: string;
  intensity: number;
  longevity: number;
  priceRange: string;
  existing: string;
  angle: string;
  moment: string;
}): string {
  return [
    `这支香：${f.name}（${f.brand}）`,
    `三调：前 ${f.top}；中 ${f.heart}；后 ${f.base}`,
    `扩散 ${f.intensity}/5，留香 ${f.longevity}/5`,
    `价位档：${f.priceRange}`,
    `现有描述（**不要复述它**，换个角度写）：${f.existing}`,
    `指定写法：${f.angle}`,
    `指定时刻：${f.moment}`,
    ``,
    `写两句：`,
    `- line：${f.angle}（不超过 32 字）。香调词最多点 2 个，不要用「像/如同/仿佛」。`,
    `- hint：它适合出现在「${f.moment}」（不超过 20 字）。不要用「替你」。`,
    ``,
    `输出 JSON：{"line":"...","hint":"..."}`,
  ].join("\n");
}

/** 抽检：打印文案 + 依据的事实 */
function reviewProfiles(n: number): void {
  const vocab = buildNoteVocabulary(PERFUMES);
  const entries = Object.entries(PERFUME_PROFILES);
  console.log(`══════ 单香档案抽检（${Math.min(n, entries.length)} / ${entries.length} 条）══════\n`);
  const step = Math.max(1, Math.floor(entries.length / Math.min(n, entries.length)));
  for (let i = 0; i < entries.length && i / step < n; i += step) {
    const [id, c] = entries[i];
    const p = PERFUMES[id];
    console.log(`── ${id}${p ? `（${p.brandCn || p.brand}｜扩散 ${p.intensity}/5 留香 ${p.longevity}/5｜${p.priceRange}）` : ""}`);
    if (p) console.log(`   三调：前 ${p.notes.top.join("、")}；中 ${p.notes.heart.join("、")}；后 ${p.notes.base.join("、")}`);
    console.log(`   line: ${c.line}`);
    console.log(`   hint: ${c.hint}`);
    const text = `${c.line} ${c.hint}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, p ? parsePriceRange(p.priceRange) : null),
      ...checkNoteClaims(text, p ?? null, vocab),
    ].filter((v) => v.severity === "block");
    console.log(blocks.length ? `   ❌ ${blocks.map((b) => b.word).join("、")}` : "   ✅ 过闸");
    const echoes = echoSegments(c.line ?? "", p?.description ?? "");
    const hits = countNoteWords(text, vocab);
    const flags = [
      echoes.length ? `复述了现有描述（${[...new Set(echoes)].join("、")}）` : "",
      hits.length > MAX_NOTE_WORDS_IN_LINE2 ? `香调词 ${hits.length} 个（${hits.join("、")}）` : "",
    ].filter(Boolean);
    console.log(flags.length ? `   ⚠️ ${flags.join("；")}` : `   ✓ 未复述｜香调词 ${hits.length} 个`);
    console.log("");
  }
}

function applyEditsOnly(): void {
  const vocab = buildNoteVocabulary(PERFUMES);
  const rows: Array<{ key: string; line: string; hint: string }> = [];
  let bad = 0;
  let changed = 0;
  console.log("══════ 应用人工校订（不调模型）══════\n");
  for (const [id, c] of Object.entries(PERFUME_PROFILES)) {
    const p = PERFUMES[id];
    const fin = applyHumanEdit(id, c);
    const text = `${fin.line} ${fin.hint}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, p ? parsePriceRange(p.priceRange) : null),
      ...checkNoteClaims(text, p ?? null, vocab),
    ].filter((v) => v.severity === "block");
    if (blocks.length) {
      console.log(`❌ ${id}：${blocks.map((x) => `${x.label}「${x.word}」`).join("；")}`);
      bad++;
      continue;
    }
    if (fin.line !== c.line || fin.hint !== c.hint) {
      changed++;
      console.log(`✏️ ${id}`);
      if (fin.line !== c.line) console.log(`   line: ${c.line}  →  ${fin.line}`);
      if (fin.hint !== c.hint) console.log(`   hint: ${c.hint}  →  ${fin.hint}`);
    }
    rows.push({ key: id, line: fin.line.trim(), hint: fin.hint.trim() });
  }
  console.log(`\n校订 ${changed} 条 / 共 ${rows.length} 条，违规 ${bad} 条`);
  if (bad > 0) {
    console.log("⛔ 存在违规 → **拒绝写文件**。");
    process.exit(1);
  }
  writeProfiles(rows, `deepseek-flash + 人工校订 ${changed} 条`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 8;
  const model = (args.includes("--model") ? args[args.indexOf("--model") + 1] : "fast") as ModelAlias;
  const limit = Number.isFinite(limitArg) ? limitArg : 8;
  const emit = args.includes("--emit");

  if (args.includes("--review")) {
    const nArg = Number(args[args.indexOf("--review") + 1]);
    reviewProfiles(Number.isFinite(nArg) && nArg > 0 ? nArg : 12);
    return;
  }
  if (args.includes("--edits-only")) {
    applyEditsOnly();
    return;
  }

  const ids = Object.keys(PERFUMES);
  const picked = limit > 0 ? ids.slice(0, limit) : ids;
  console.log(`══════ 单香档案文案生成（model=${model}, 共 ${ids.length} 条, 本次 ${picked.length}, emit=${emit}）══════\n`);

  const vocab = buildNoteVocabulary(PERFUMES);
  let okCount = 0;
  let badCount = 0;
  let totalTokens = 0;
  const actualModels = new Set<string>();
  const warnList: Array<{ key: string; why: string }> = [];
  const results: Array<{ key: string; line: string; hint: string }> = [];

  for (let i = 0; i < picked.length; i++) {
    const id = picked[i];
    const p = PERFUMES[id];
    const price = parsePriceRange(p.priceRange);
    const prompt = buildPrompt({
      name: p.name,
      brand: p.brandCn || p.brand,
      top: p.notes.top.join("、"),
      heart: p.notes.heart.join("、"),
      base: p.notes.base.join("、"),
      intensity: p.intensity,
      longevity: p.longevity,
      priceRange: p.priceRange,
      existing: p.description,
      angle: angleFor(i),
      moment: momentFor(i),
    });

    let done = false;
    let correction = "";
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const r = await chatJson<PerfumeProfileCopy>({
          model,
          system: SYSTEM,
          prompt: correction ? `${prompt}\n\n${correction}` : prompt,
        });
        actualModels.add(r.actualModel);
        totalTokens += r.usage?.totalTokens ?? 0;

        const raw = `${r.data.line} ${r.data.hint}`;
        const blocks = [
          ...checkCopy(raw),
          ...checkPriceClaims(raw, price),
          ...checkNoteClaims(raw, p, vocab),
        ].filter((v) => v.severity === "block");

        const echoes = echoSegments(r.data.line ?? "", p.description);
        const hits = countNoteWords(raw, vocab);
        const simile = SIMILE_WORDS.filter((w) => (r.data.line ?? "").includes(w));
        const personify = PERSONIFY_WORDS.filter((w) => (r.data.hint ?? "").includes(w));
        const tooMany = hits.length > MAX_NOTE_WORDS_IN_LINE2;
        const qualityBad = echoes.length > 0 || tooMany || simile.length > 0 || personify.length > 0;
        const qualityNote = qualityBad
          ? [
              echoes.length ? `line 复述了现有描述（${[...new Set(echoes)].map((w) => `「${w}」`).join("")}）` : "",
              tooMany ? `香调词 ${hits.length} 个（${hits.join("、")}），最多 ${MAX_NOTE_WORDS_IN_LINE2} 个` : "",
              simile.length ? `line 用了明喻词「${simile.join("、")}」（禁）` : "",
              personify.length ? `hint 用了拟人句式「${personify.join("、")}」（禁）` : "",
            ]
              .filter(Boolean)
              .join("；")
          : "";

        if (blocks.length !== 0) {
          const bad = blocks.map((x) => x.word).filter((w) => w && w !== "¥");
          correction = bad.length
            ? `修正要求：上一次你用了 ${[...new Set(bad)].map((w) => `「${w}」`).join("、")}，` +
              `但这支香并没有这些香调，或它属于被禁的表述。请只用「三调」里列出的词重写。`
            : "修正要求：上一次的输出不符合规则，请严格按规则重写。";
        } else if (qualityBad) {
          correction =
            `修正要求：${qualityNote}。line 请按「${angleFor(i)}」这个写法重写，` +
            `不要复述现有描述，不要用「像/如同/仿佛」，香调词只留 1–2 个；hint 不要用「替你」。`;
        }

        if (blocks.length === 0 && !qualityBad) {
          const fin = applyHumanEdit(id, r.data);
          const post = [
            ...checkCopy(`${fin.line} ${fin.hint}`),
            ...checkPriceClaims(`${fin.line} ${fin.hint}`, price),
            ...checkNoteClaims(`${fin.line} ${fin.hint}`, p, vocab),
          ].filter((v) => v.severity === "block");
          console.log(`── ${i + 1}. ${p.name}（${p.brandCn || p.brand}｜${angleFor(i)}｜${momentFor(i)}）`);
          console.log(`   ${fin.line}`);
          console.log(`   ${fin.hint}`);
          if (post.length) {
            console.log(`   ❌ 人工校订后仍违规：${post.map((x) => `${x.label}「${x.word}」`).join("；")}`);
            badCount++;
            done = true;
            continue;
          }
          console.log(`   ✅ 过闸${attempt > 1 ? `（第 ${attempt} 次）` : ""}`);
          okCount++;
          results.push({ key: id, line: fin.line.trim(), hint: fin.hint.trim() });
          done = true;
        } else if (attempt === 3) {
          const why = blocks.length ? blocks.map((x) => `${x.label}「${x.word}」`).join("；") : qualityNote;
          console.log(`── ${i + 1}. ${p.name}`);
          console.log(`   ${blocks.length ? "❌ 合规未过闸" : "⚠️ 质量未达标"}，重试 3 次：${why}`);
          if (blocks.length) {
            badCount++;
          } else {
            const fin = applyHumanEdit(id, { line: r.data.line ?? "", hint: r.data.hint ?? "" });
            warnList.push({ key: id, why: qualityNote });
            results.push({ key: id, line: fin.line.trim(), hint: fin.hint.trim() });
            okCount++;
          }
        }
      } catch (e) {
        if (attempt === 3) {
          console.log(`── ${i + 1}. ${p.name}`);
          console.log(`   ❌ 生成失败：${(e as Error).message}`);
          badCount++;
        }
      }
    }
  }

  console.log("\n══════ 汇总 ══════");
  console.log(`  过闸 ${okCount} / 失败 ${badCount}`);
  if (warnList.length) {
    console.log(`\n  ⚠️ 质量未达标 ${warnList.length} 条（合规已过，需人工改写）：`);
    for (const w of warnList) console.log(`     · ${w.key} —— ${w.why}`);
  }
  console.log(`  实际模型：${[...actualModels].join(", ") || "-"}`);
  console.log(`  累计 token：${totalTokens}`);
  if (badCount > 0) {
    console.log("\n  ⚠️ 有未过闸项。");
    if (emit) console.log("  ⛔ 已 --emit 但存在失败项 → **拒绝写文件**。");
    process.exit(1);
  }
  if (emit) writeProfiles(results, [...actualModels].join(", ") || "unknown");
}

function writeProfiles(
  rows: Array<{ key: string; line: string; hint: string }>,
  modelUsed: string,
): void {
  const outPath = path.join(process.cwd(), "lib", "data", "perfumeProfiles.ts");
  const body = rows
    .map(
      (r) =>
        `  ${JSON.stringify(r.key)}: { line: ${JSON.stringify(r.line)}, hint: ${JSON.stringify(r.hint)} },`,
    )
    .join("\n");

  const src = `// ============================================================
// ⚠️ 本文件由 scripts/gen-perfume-profiles.ts 自动生成，请勿手改。
//    改文案请改生成脚本的 prompt 或 HUMAN_EDITS 表，手改会在下次生成时被静默覆盖。
//
// L1 离线生成产物：单支香水的「香气档案」文案（F7）。
//   键 = 香水的 **id**（即 PERFUMES 的键，库里有 2 支「键≠展示名」，所以按键存最稳）。
//   225 条不乘人格 —— 一支香一条独立档案，与人格无关。
//   运行时只读本表，零 LLM 调用、零延迟、完全可复现。
//   覆盖度与合规由 scripts/audit-perfume-data.ts 的 I 项守着。
//
// ⚠️ 只写文案类字段：价格 / 三调 / 扩散 / 留香 / 品牌 一律来自 PERFUMES，
//    绝不由模型生成（那是事实，编了就是假数据）。
//
// 生成信息：
//   条数    ${rows.length}
//   模型    ${modelUsed}
//   时间    ${new Date().toISOString()}
// ============================================================

export interface PerfumeProfile {
  /** 这支香的气质 */
  line: string;
  /** 适合出现的时刻 */
  hint: string;
}

export const PERFUME_PROFILES: Record<string, PerfumeProfile> = {
${body}
};

/** 按香水 id 取文案；没有则返回 null（调用方自行决定是否展示） */
export function getPerfumeProfileCopy(id: string): PerfumeProfile | null {
  return PERFUME_PROFILES[id] ?? null;
}
`;

  fs.writeFileSync(outPath, src, "utf8");
  console.log(`\n  💾 已写入 lib\\data\\perfumeProfiles.ts（${rows.length} 条）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
