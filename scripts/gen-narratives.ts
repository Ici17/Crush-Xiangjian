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
import { PERFUME_NARRATIVES } from "@/lib/data/perfumeNarratives";
import { getCalibratedRecommendations } from "@/lib/matchPerfumes";
import { findPerfume } from "@/lib/discover";
import { checkCopy, checkPriceClaims, checkNoteClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { chatJson, type ModelAlias } from "@/lib/ai/client";
import { countNoteWords, echoSegments, MAX_NOTE_WORDS_IN_LINE2 } from "./_narrativeQuality";

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
  // 8 是针对 48 条抽检发现的头号问题：44% 的 line1 在照抄「人格一句话」。
  // 用户点开「为什么是你」是想看「我 × 这支香」的关系，不是复读刚看过的人格标签。
  "8. **不得复述或改写「人格一句话」**。不要照抄它、不要只换个说法、不要用它的半句开头。",
  "   line1 必须从**这支香的具体气质**出发，落到它与人格的交点上；人格一句话只是背景，不是素材。",
  // 9 同样来自抽检：line2 平均点到 3.5 个香调词、最多 7 个 —— 读起来是成分表不是文案。
  "9. line2 里点到的香调词**最多 2 个**。不要罗列三调，挑一两个最能代表这支香的就够。",
  // 10 同样来自抽检：「独处」占了 48 条里的 20 条（42%），全员独处会让文案失去辨识度。
  "10. line2 的场景必须落在我在下面「指定场景」里给的那一个，不要自己换成别的",
  "   （尤其不要默认写「独处」）。",
  "11. 只输出 JSON，不要解释。",
].join("\n");

interface Narrative {
  line1: string;
  line2: string;
}

/**
 * 场景池：抽检发现「独处」占 42%，其余场景几乎没人用。
 * 与其在 prompt 里求模型「多样一点」（它会继续写独处），不如**外部指派** ——
 * 每条按序号确定性轮转，48 条的场景分布就由我们控制，而不是由模型的惯性决定。
 */
const SCENE_POOL = [
  "通勤路上",
  "开会/见人",
  "周末出门",
  "睡前",
  "清晨出发",
  "傍晚散步",
  "下雨天",
  "出差在途",
  "两三人小聚",
  "久违的约会",
  "一个人待着",
  "要上台/要发言",
] as const;

function sceneFor(i: number): string {
  return SCENE_POOL[i % SCENE_POOL.length];
}

/**
 * 人工校订表（2026-10-22 首轮人工审读 48 条后的改动）。
 *
 * 为什么放在脚本里而不是直接改产物：产物每次生成都会整体重写，手改会被静默覆盖。
 * 校订在生成末尾覆盖上去，并且**会再跑一次三道闸**（见下面的应用点）——
 * 人也会顺手写出「治愈」，手写的不能免检。
 *
 * 首轮改的 4 条，三类毛病：
 *  1. 温砾::香草奶昔 —— 两句都缺句号，格式不统一。
 *  2. 极夜::蜜藏琥珀 / 霜冷::灰色岩兰草 —— 把人格名直接写进句子（「恰是极夜的分量」），
 *     读起来像模板填空；其余 46 条都不点名，保持一致。
 *  3. 荒原::可可小姐 —— line2 三十字出头还罗列两个香调，收不住。
 */
const HUMAN_EDITS: Record<string, Partial<Narrative>> = {
  "温砾::香草奶昔": {
    line1: "不浓不淡的奶感，刚好把温和递出去。",
    line2: "香草与椰子的柔滑，周末出门时轻轻跟着你。",
  },
  "极夜::蜜藏琥珀": {
    line1: "不急着铺开，却在暗处层层推进，分量都在后头。",
  },
  "霜冷::灰色岩兰草": {
    line1: "岩兰草的沉稳不喧哗，却始终在场，分量恰好相称。",
  },
  "荒原::可可小姐": {
    line2: "玫瑰与广藿香陪你在途中，心绪慢慢舒缓下来。",
  },
};

function applyHumanEdit(key: string, nar: Narrative): Narrative {
  const e = HUMAN_EDITS[key];
  return e ? { line1: e.line1 ?? nar.line1, line2: e.line2 ?? nar.line2 } : nar;
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
  scene: string;
}): string {
  return [
    `人格：${f.pName}`,
    `人格一句话（仅作背景，**禁止在文案里复述或改写它**）：${f.tagline}`,
    `香气方向：${f.scentDirection}`,
    `六维香气偏好（0-100）：${f.radar}`,
    ``,
    `这支香：${f.perfume}（${f.brand}）`,
    `三调：${f.notes}`,
    `扩散 ${f.intensity}/5，留香 ${f.longevity}/5`,
    `价位档：${f.priceRange}`,
    `它在推荐中的角色：${f.role}`,
    `指定场景：${f.scene}`,
    ``,
    `写两句「为什么是你」,两句合起来不超过 60 字：`,
    `- line1：从**这支香的气质**出发，写它和这个人格的交点（不超过 30 字）。` +
      `不要复述人格一句话。`,
    `- line2：它的气味气质 + 它适合出现在「${f.scene}」这个时刻（不超过 30 字）。` +
      `香调词最多点 2 个。`,
    ``,
    `输出 JSON：{"line1":"...","line2":"..."}`,
  ].join("\n");
}

const ROLE_CN: Record<string, string> = {
  signature: "本命香",
  advanced: "进阶香",
  budget: "尝试香",
};

/** 抽检：按人格均匀取样，打印文案 + 它所依据的事实，便于人工判断有没有跑偏 */
async function reviewNarratives(): Promise<void> {
  const nArg = Number(process.argv[process.argv.indexOf("--review") + 1]);
  const n = Number.isFinite(nArg) && nArg > 0 ? nArg : 10;

  const entries = Object.entries(PERFUME_NARRATIVES);
  // 按人格分组，轮流取样 —— 避免抽到的全是前几个人格
  const byPerson = new Map<string, typeof entries>();
  for (const e of entries) {
    const p = e[0].split("::")[0];
    const list = byPerson.get(p) ?? [];
    list.push(e);
    byPerson.set(p, list);
  }
  const picked: typeof entries = [];
  const persons = [...byPerson.keys()];
  let idx = 0;
  while (picked.length < Math.min(n, entries.length)) {
    const p = persons[idx % persons.length];
    const list = byPerson.get(p)!;
    const taken = picked.filter((e) => e[0].startsWith(p + "::")).length;
    if (taken < list.length) picked.push(list[taken]);
    idx++;
    if (idx > persons.length * 5) break; // 保险：防止取样死循环
  }

  const vocab = buildNoteVocabulary(PERFUMES);
  console.log(`══════ 文案抽检（${picked.length} / ${entries.length} 条）══════\n`);

  for (const [key, nar] of picked) {
    const [pName, pfName] = key.split("::");
    const per = PERSONALITY_TYPES.find((x) => x.name === pName);
    const pf = findPerfume(pfName);
    console.log(`── ${key}`);
    console.log(`   人格：${per?.tagline ?? "-"}｜${per?.scentDirection ?? "-"}`);
    if (pf) {
      console.log(
        `   事实：${pf.brandCn}｜前 ${pf.notes.top.join("、")}；中 ${pf.notes.heart.join("、")}；后 ${pf.notes.base.join("、")}`,
      );
      console.log(`        扩散 ${pf.intensity}/5，留香 ${pf.longevity}/5，${pf.priceRange}`);
    }
    console.log(`   文案：${nar.line1}`);
    console.log(`         ${nar.line2}`);
    const blocks = [
      ...checkCopy(`${nar.line1} ${nar.line2}`),
      ...checkPriceClaims(`${nar.line1} ${nar.line2}`, null),
      ...checkNoteClaims(`${nar.line1} ${nar.line2}`, pf, vocab),
    ].filter((v) => v.severity === "block");
    console.log(blocks.length ? `   ❌ ${blocks.map((b) => b.word).join("、")}` : "   ✅ 过闸");

    // 质量三问：有没有复读人格一句话 / 香调词有没有写成成分表 / 场景是什么
    const echoes = echoSegments(nar.line1 ?? "", per?.tagline ?? "");
    const hits = countNoteWords(nar.line2 ?? "", vocab);
    const flags = [
      echoes.length ? `复读人格一句话（${[...new Set(echoes)].join("、")}）` : "",
      hits.length > MAX_NOTE_WORDS_IN_LINE2 ? `香调词 ${hits.length} 个（${hits.join("、")}）` : "",
    ].filter(Boolean);
    console.log(flags.length ? `   ⚠️ ${flags.join("；")}` : `   ✓ 未复读｜香调词 ${hits.length} 个`);
    console.log("");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 8;
  const model = (args.includes("--model") ? args[args.indexOf("--model") + 1] : "fast") as ModelAlias;
  const limit = Number.isFinite(limitArg) ? limitArg : 8;
  const emit = args.includes("--emit");
  const review = args.includes("--review");

  // ── 抽检模式：不调模型，把已落盘的文案连同「依据的事实」一起打出来 ──
  // 为什么要带上事实：判断一句文案好不好，必须能同时看到它依据的三调与人格气质，
  // 否则只能看顺不顺眼，看不出有没有跑偏。
  if (review) {
    await reviewNarratives();
    return;
  }

  // ── 只应用人工校订：不调模型 ──
  // 用完 48 条之后，如果只是改了几句话，没必要整批重跑：
  // 重跑会把其余 44 条随机换成新句子（模型是采样的），等于白审一遍，还多花一次钱。
  if (args.includes("--edits-only")) {
    applyEditsOnly();
    return;
  }

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
        // 场景由外部指派（第 i 条确定性轮转），不交给模型自选 —— 否则它会一路写「独处」
        scene: sceneFor(tasks.length),
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
  /** 合规过了但质量未达标的条目（需人工改写） */
  const warnList: Array<{ key: string; why: string }> = [];

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

        // 质量闸（区别于上面的合规闸）：过闸 ≠ 能用。
        // 抽检里抓到的两件事 —— line1 复读人格一句话、line2 罗列香调 —— 都要能被自动抓出来，
        // 否则 48 条全靠人眼扫，扫不干净。
        const echoes = echoSegments(r.data.line1 ?? "", t.tagline);
        const noteHits = countNoteWords(r.data.line2 ?? "", vocab);
        const tooManyNotes = noteHits.length > MAX_NOTE_WORDS_IN_LINE2;
        const qualityBad = echoes.length > 0 || tooManyNotes;
        const qualityNote = qualityBad
          ? [
              echoes.length ? `line1 复读了人格一句话（${[...new Set(echoes)].map((w) => `「${w}」`).join("")}）` : "",
              tooManyNotes
                ? `line2 点到了 ${noteHits.length} 个香调词（${noteHits.join("、")}），最多只能点 ${MAX_NOTE_WORDS_IN_LINE2} 个`
                : "",
            ]
              .filter(Boolean)
              .join("；")
          : "";

        if (blocks.length !== 0) {
          const bad = blocks.map((b) => b.word).filter((w) => w && w !== "¥");
          correction = bad.length
            ? `修正要求：上一次你用了 ${[...new Set(bad)].map((w) => `「${w}」`).join("、")}，` +
              `但这支香并没有这些香调。请只使用上面「三调」里列出的词重写，不要再做比喻。`
            : "修正要求：上一次的输出不符合规则，请严格按规则重写。";
        } else if (qualityBad) {
          correction = `修正要求：${qualityNote}。` +
            `line1 请改从这支香自身的气质写起，不要碰人格一句话；line2 只留最能代表它的 1–2 个香调词，其余换成气质或画面。`;
        }

        if (blocks.length === 0 && !qualityBad) {
          // 人工校订：模型产出之后由人改过的句子。
          // ⚠️ 校订**必须放在这里而不是直接改产物文件** —— 产物每次生成都会整体重写，
          //    手改会被静默覆盖（产物头那句「请勿手改」就是这个意思）。
          const key = `${t.pName}::${t.perfume}`;
          const final = applyHumanEdit(key, r.data);
          // 人工改写后**再跑一次闸**：人也会顺手写出「治愈」这类词，不能因为是手写的就放行。
          const postBlocks = [
            ...checkCopy(`${final.line1} ${final.line2}`),
            ...checkPriceClaims(`${final.line1} ${final.line2}`, t.price),
            ...checkNoteClaims(`${final.line1} ${final.line2}`, pf, vocab),
          ].filter((v) => v.severity === "block");

          console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}（${t.brand}·${t.role}｜${t.scene}）`);
          console.log(`   ${final.line1}`);
          console.log(`   ${final.line2}`);

          if (postBlocks.length) {
            console.log(`   ❌ 人工校订后仍违规：${postBlocks.map((b) => `${b.label}「${b.word}」`).join("；")}`);
            badCount++;
            done = true;
            continue;
          }
          console.log(
            `   ✅ 过闸${attempt > 1 ? `（第 ${attempt} 次）` : ""}` +
              (key in HUMAN_EDITS ? "｜已应用人工校订" : ""),
          );
          okCount++;
          results.push({ key, line1: final.line1.trim(), line2: final.line2.trim() });
          done = true;
        } else if (attempt === 3) {
          const why = blocks.length
            ? blocks.map((b) => `${b.label}「${b.word}」`).join("；")
            : qualityNote;
          const tag = blocks.length ? "❌ 合规未过闸" : "⚠️ 质量未达标";
          console.log(`── ${i + 1}. ${t.pName} × ${t.perfume}（${t.brand}·${t.role}｜${t.scene}）`);
          console.log(`   ${tag}，重试 3 次：${why}`);
          if (blocks.length) {
            badCount++;
          } else {
            // 质量问题是「能用但不好」，不是红线 —— 照写进文件，但登记进待人工改写清单。
            // 理由：这批文案本来就要人工过一遍；拦住整批反而让人看不见它。
            const k = `${t.pName}::${t.perfume}`;
            const fin = applyHumanEdit(k, { line1: r.data.line1 ?? "", line2: r.data.line2 ?? "" });
            warnList.push({ key: k, why: qualityNote });
            results.push({ key: k, line1: fin.line1.trim(), line2: fin.line2.trim() });
            okCount++;
          }
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
  if (warnList.length) {
    console.log(`\n  ⚠️ 质量未达标 ${warnList.length} 条（合规已过，但需人工改写）：`);
    for (const w of warnList) console.log(`     · ${w.key} —— ${w.why}`);
  }
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
 * 只把 HUMAN_EDITS 应用到已有产物上，不调模型。
 * 校订后**再跑一次三道闸** —— 人也会顺手写出「治愈」这类词，手写的不能免检。
 */
function applyEditsOnly(): void {
  const vocab = buildNoteVocabulary(PERFUMES);
  const rows: Array<{ key: string; line1: string; line2: string }> = [];
  let bad = 0;
  let changed = 0;

  console.log("══════ 应用人工校订（不调模型）══════\n");
  for (const [key, nar] of Object.entries(PERFUME_NARRATIVES)) {
    const pfName = key.split("::")[1];
    const pf = findPerfume(pfName);
    const fin = applyHumanEdit(key, nar);
    const text = `${fin.line1} ${fin.line2}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, pf ? parseRangeForGuard(pf.priceRange) : null),
      ...checkNoteClaims(text, pf, vocab),
    ].filter((v) => v.severity === "block");

    if (blocks.length) {
      console.log(`❌ ${key}：校订后违规 —— ${blocks.map((b) => `${b.label}「${b.word}」`).join("；")}`);
      bad++;
      continue;
    }
    if (fin.line1 !== nar.line1 || fin.line2 !== nar.line2) {
      changed++;
      console.log(`✏️ ${key}`);
      if (fin.line1 !== nar.line1) console.log(`   line1: ${nar.line1}  →  ${fin.line1}`);
      if (fin.line2 !== nar.line2) console.log(`   line2: ${nar.line2}  →  ${fin.line2}`);
    }
    rows.push({ key, line1: fin.line1.trim(), line2: fin.line2.trim() });
  }

  console.log(`\n校订 ${changed} 条 / 共 ${rows.length} 条，违规 ${bad} 条`);
  if (bad > 0) {
    console.log("⛔ 存在违规 → **拒绝写文件**。");
    process.exit(1);
  }
  writeNarratives(rows, `deepseek-flash + 人工校订 ${changed} 条`);
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
