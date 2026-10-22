// ============================================================
// F4 · CP 合香文案离线生成（L1）
//
// 现在的问题：lib/cpResonance.ts 只有 4 条按「差几调」分档的解读，
//   256 对人格共用 —— 暗流×荒岛 和 残温×裂岸 看出去是同一句话。
// 这一步：给每一对人格写专属解读，运行时零 LLM 调用。
//
// 规模：**136 条不是 256 条**。
//   合香卡已修成可交换（A×B ≡ B×A，见 cpResonance 的 sort），
//   文案又是以「你们」视角写的，两个方向本该同一句 → 无序对 C(16+1,2) = 136。
//   省一半成本，也避免同一对两个方向说法打架。
//
// 用法：
//   npx tsx scripts/gen-cp-narratives.ts --limit 8          试跑
//   npx tsx scripts/gen-cp-narratives.ts --limit 0 --emit   全量落盘
//   npx tsx scripts/gen-cp-narratives.ts --review 12        抽检（不调模型）
//   npx tsx scripts/gen-cp-narratives.ts --edits-only       只应用人工校订
// ============================================================

import "./_env";
import * as fs from "node:fs";
import * as path from "node:path";
import { PERSONALITY_TYPES } from "@/lib/data";
import { CP_NARRATIVES } from "@/lib/data/cpNarratives";
import { getCpResonance } from "@/lib/cpResonance";
import {
  checkCopy,
  checkPriceClaims,
  checkNoteClaims,
  buildNoteVocabulary,
} from "@/lib/contentGuard";
import { PERFUMES } from "@/lib/data";
import { chatJson, type ModelAlias } from "@/lib/ai/client";
import { countNoteWords, echoSegments, MAX_NOTE_WORDS_IN_LINE2 } from "./_narrativeQuality";

const SYSTEM = [
  "你是 Crush 香鉴的文案撰写者，现在写的是两个人格「合香卡」上的解读。",
  "品牌调性：克制、高级、留白，像一句短诗，不像广告。",
  "",
  "硬规则（违反任何一条都不合格）：",
  "1. 只用我给你的事实。不得编造香水名、品牌、香调、价格、产地。",
  "   香调尤其严格：只能用「合香三调」里列出的那些词，**一个字都不要改**，",
  "   不得替换成近义词或上位词（例如「橙」不能写成「橙花」），不得补充我没列出的香料。",
  "   **香调词只能用来描述这支合香本身** —— 不要拿它形容人格、心情，也不要做比喻。",
  "2. 禁止医疗与疗效暗示（治愈、助眠、安神、镇静、消炎…）。情绪词一律用「舒缓」。",
  "3. **禁止缘分与宿命表述** —— 这是合香文案最容易踩的坑。",
  "   不许出现：缘分、命中注定、天生一对、灵魂伴侣、天造地设、前世、注定、宿命、羁绊、",
  "   非你不可、唯一。",
  "   合香是「你们合起来是什么味道」的审美侧写，不是对关系下断言。",
  "4. 不得写成心理诊断或关系建议：不要说「你们其实害怕」「你应该多理解他」，",
  "   只谈气味与氛围。",
  "5. 不得出现任何价格数字与货币符号。",
  "6. 不得出现极限承诺词（绝对、永久、100%、顶级）。",
  "7. **不得复述或改写两个人格的一句话**。它们只是背景，不是素材。",
  "   line 必须从这支合香自身的气味出发。",
  "8. line 里点到的香调词**最多 2 个**，不要罗列三调。",
  "9. hint 必须落在我在下面「指定时刻」里给的那一个，不要自己换。",
  // 10/11 来自首轮 136 条的量化：71% 的 line 在用「像…」明喻，63% 的 hint 在用「替你…」。
  // 这不是抄人格一句话那种硬伤，是**句式塌缩** —— 连看几对会觉得是同一套模板。
  // 跟「场景」同一个道理：求模型「换个说法」没用，得明令禁止 + 外部指派写法。
  "10. line **不得使用明喻词**：像、如同、仿佛、好似、似。",
  "    （首轮 96/136 条都在用「像」，读起来是同一句。）",
  "11. hint 不得用「替你 / 替你们 / 替沉默」这类拟人句式。直接写那一刻气息是什么状态。",
  "12. 只输出 JSON，不要解释。",
].join("\n");

/**
 * line 的写法池 —— 禁掉明喻之后必须给替代路径，否则模型只会干巴巴地陈述。
 * 按序号轮转，136 条被分成 8 种写法，分布由我们控制。
 */
const ANGLE_POOL = [
  "写两种气息怎么相遇：谁先来，谁压着谁，还是各占一头",
  "写一个具体画面（画面本身，不要用比喻词引出来）",
  "写距离感：它们挨得多近，中间留了多少空隙",
  "写温度与质感：冷或暖、干或润、轻或沉",
  "写时间感：哪个先到，哪个留得最久",
  "写留白：什么没有被说满，哪里故意轻了一点",
  "直接说这支合香是什么味道，不加任何修饰",
  "写它落在空气里、落在衣料上的感觉",
] as const;

function angleFor(i: number): string {
  return ANGLE_POOL[i % ANGLE_POOL.length];
}

/** 明喻词（规则 10）—— 用于质量闸，禁了就得能自动抓 */
const SIMILE_WORDS = ["如同", "仿佛", "好似", "像"];

/** 「替…」拟人（规则 11） */
const PERSONIFY_WORDS = ["替你", "替你们", "替沉默", "替它"];

interface CpNarrative {
  line: string;
  hint: string;
}

/**
 * 「你们一起的时刻」池 —— 与 F1 同一个道理：求模型「多样一点」没用，
 * 不指派它会一路写「安静待着」。分布由我们控制。
 */
const MOMENT_POOL = [
  "并肩走路",
  "各自忙碌",
  "久别重逢",
  "第一次见面",
  "待到很晚",
  "周末下午",
  "一起赶路",
  "人多的时候",
  "只剩你们两个",
  "临别之前",
  "重新开始的那天",
  "说了很多话之后",
] as const;

function momentFor(i: number): string {
  return MOMENT_POOL[i % MOMENT_POOL.length];
}

const DIFF_CN: Record<number, string> = {
  0: "同调（两人主导香调族相同）",
  1: "隔 1 调（相邻）",
  2: "隔 2 调",
  3: "隔 3 调（6 调环上最远）",
};

/**
 * 人工校订表。
 * 与 F1 同一个约定：校订**必须放这里而不是直接改产物文件** ——
 * 产物每次生成整体重写，手改会被静默覆盖。校订后会再跑一次闸。
 */
const HUMAN_EDITS: Record<string, Partial<CpNarrative>> = {
  // 2026-10-22 首轮人工审读：136 条里有 15 条香调词点了 3–4 个（模型重试 3 次也没降下来），
  // 读起来像成分表。这里逐条压到 2 个，画面尽量留住。
  // ⚠️ 键必须按字典序排（与 getCpNarrative 的 [a,b].sort() 一致），否则校订不生效
  "暗流::残温": { line: "紫罗兰贴近雪松，中间只隔一层薄雾。" },
  "寒岭::暗流": { hint: "待到很晚，气息转沉，贴近皮肤。" },
  "暗流::砾迹": { line: "杜松子压在紫罗兰上，清冽里带一点沉。" },
  "暗流::荒原": { line: "紫罗兰沉在下面，黄葵从上面落下来。" },
  "荒岛::裂岸": { line: "苦橙叶挨着橙花，中间留一段空。" },
  "寒岭::残温": { line: "皮革摊开，茉莉落在边上，不占满。" },
  "残温::渊海": { line: "棉花糖先落，茉莉跟在后面，都不争。", hint: "夜已深，气息转淡，仍留一层温。" },
  "寒岭::沉湾": { line: "皮革贴着雪松，中间留一道窄缝。" },
  "冲浪::极夜": { line: "青柠先到，黄瓜随后压上半程。" },
  "极夜::空号": { line: "玫瑰压在雪松上，前头退后半寸。" },
  "极夜::沉湾": { line: "薰衣草散得早，玫瑰只说了一半。" },
  "极夜::烬生": { line: "肉桂先落，玫瑰退回中间。" },
  "渊海::砾迹": { line: "松针打底，雪松接住，往后一路沉下去。" },
  "温砾::荒原": { line: "当归压着茉莉，中间隔着一层甜。" },
  "沉湾::渊海": { line: "玫瑰与雪松挨近，又留着空隙。", hint: "久别重逢，气息隔着一层薄薄的暖。" },
};

function applyHumanEdit(key: string, nar: CpNarrative): CpNarrative {
  const e = HUMAN_EDITS[key];
  return e ? { line: e.line ?? nar.line, hint: e.hint ?? nar.hint } : nar;
}

function buildPrompt(f: {
  aName: string;
  aTagline: string;
  aScent: string;
  bName: string;
  bTagline: string;
  bScent: string;
  blendName: string;
  top: string;
  heart: string;
  base: string;
  diff: number;
  seal: string;
  moment: string;
  angle: string;
  isSame: boolean;
}): string {
  return [
    `人格 A：${f.aName}`,
    `  ${f.aTagline}｜${f.aScent}`,
    `人格 B：${f.bName}`,
    `  ${f.bTagline}｜${f.bScent}`,
    `（上面两段「人格一句话」仅作背景，**禁止在文案里复述或改写**）`,
    f.isSame ? `注意：这两个人格相同，写的是「同类气息叠在一起」是什么样子，不要写成两个人。` : "",
    ``,
    `合香名：${f.blendName}`,
    `合香三调：前 ${f.top}；中 ${f.heart}；后 ${f.base}`,
    `香调距离：${DIFF_CN[f.diff] ?? f.diff}`,
    `合香印：${f.seal}`,
    `指定时刻：${f.moment}`,
    `指定写法：${f.angle}`,
    ``,
    `写两句：`,
    `- line：${f.angle}（不超过 36 字）。` +
      `香调词最多点 2 个，不要复述人格一句话，不要用「像/如同/仿佛」。`,
    `- hint：它适合出现在「${f.moment}」这个时刻（不超过 22 字）。` +
      `不要用「替你/替你们」这类拟人句式。`,
    ``,
    `输出 JSON：{"line":"...","hint":"..."}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 无序对（含自配）：C(16+1,2) = 136。
 *
 * ⚠️ 键必须按 **字典序** 排（[a,b].sort()），不能按人格表顺序。
 * 首轮踩过：生成时按人格表顺序写键，而 getCpNarrative 查询时按 sort() 排序 ——
 * 两边不一致，136 条里 51 条（37%）根本查不到，静默回落到通用分档文案。
 * 门禁 audit-perfume-data 的 G 项会守这条。
 */
function buildPairs(): Array<[string, string]> {
  const names = PERSONALITY_TYPES.map((p) => p.name);
  const out: Array<[string, string]> = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i; j < names.length; j++) {
      const [a, b] = [names[i], names[j]].sort();
      out.push([a, b]);
    }
  }
  return out;
}

function findPersonality(name: string) {
  return PERSONALITY_TYPES.find((p) => p.name === name);
}

/** 抽检：打印文案 + 依据的事实 + 过闸与质量结论 */
function reviewNarratives(): void {
  const nArg = Number(process.argv[process.argv.indexOf("--review") + 1]);
  const n = Number.isFinite(nArg) && nArg > 0 ? nArg : 12;
  const vocab = buildNoteVocabulary(PERFUMES);
  const entries = Object.entries(CP_NARRATIVES);

  console.log(`══════ CP 合香文案抽检（${Math.min(n, entries.length)} / ${entries.length} 条）══════\n`);
  const step = Math.max(1, Math.floor(entries.length / Math.min(n, entries.length)));
  for (let i = 0; i < entries.length && i / step < n; i += step) {
    const [key, nar] = entries[i];
    const [aName, bName] = key.split("::");
    const pa = findPersonality(aName);
    const pb = findPersonality(bName);
    const cp = getCpResonance(aName, bName);
    console.log(`── ${key}`);
    console.log(`   ${pa?.tagline ?? "-"} × ${pb?.tagline ?? "-"}`);
    if (cp) {
      console.log(
        `   合香：${cp.blendName}｜前 ${cp.top.join("、")}；中 ${cp.heart.join("、")}；后 ${cp.base.join("、")}｜${cp.diffTones === 0 ? "同调" : `隔${cp.diffTones}调`}·印 ${cp.seal}`,
      );
    }
    console.log(`   文案：${nar.line}`);
    console.log(`         ${nar.hint}`);
    const blocks = [
      ...checkCopy(`${nar.line} ${nar.hint}`),
      ...checkPriceClaims(`${nar.line} ${nar.hint}`, null),
      ...checkNoteClaims(`${nar.line} ${nar.hint}`, cpAsPerfume(cp), vocab),
    ].filter((v) => v.severity === "block");
    console.log(blocks.length ? `   ❌ ${blocks.map((b) => b.word).join("、")}` : "   ✅ 过闸");
    const echoes = echoSegments(nar.line ?? "", pa?.tagline ?? "", pb?.tagline ?? "");
    const hits = countNoteWords(`${nar.line} ${nar.hint}`, vocab);
    const flags = [
      echoes.length ? `复读了人格一句话（${[...new Set(echoes)].join("、")}）` : "",
      hits.length > MAX_NOTE_WORDS_IN_LINE2 ? `香调词 ${hits.length} 个（${hits.join("、")}）` : "",
    ].filter(Boolean);
    console.log(flags.length ? `   ⚠️ ${flags.join("；")}` : `   ✓ 未复读｜香调词 ${hits.length} 个`);
    console.log("");
  }
}

/** 把合香三调伪装成一个「香水」喂给香调白名单闸（闸只认 top/heart/base/name） */
function cpAsPerfume(cp: ReturnType<typeof getCpResonance>) {
  if (!cp) return null;
  return {
    name: cp.blendName,
    notes: { top: cp.top, heart: cp.heart, base: cp.base },
  } as never;
}

/** 只应用人工校订，不调模型（理由同 F1：整批重跑会把其余条目随机换掉） */
function applyEditsOnly(): void {
  const vocab = buildNoteVocabulary(PERFUMES);
  const rows: Array<{ key: string; line: string; hint: string }> = [];
  let bad = 0;
  let changed = 0;

  console.log("══════ 应用人工校订（不调模型）══════\n");
  const seen = new Set<string>();
  let renamed = 0;
  for (const [rawKey, nar] of Object.entries(CP_NARRATIVES)) {
    const [x, y] = rawKey.split("::");
    // 规范化键：必须与 getCpNarrative 的 [a,b].sort() 完全一致，
    // 否则写进去的键查不到，会静默回落到通用分档文案（首轮 51/136 中招）。
    const [a, b] = [x, y].sort();
    const key = `${a}::${b}`;
    if (key !== rawKey) renamed++;
    if (seen.has(key)) {
      console.log(`❌ 键冲突：${rawKey} 与已有条目规范化后都是 ${key}`);
      bad++;
      continue;
    }
    seen.add(key);
    const cp = getCpResonance(a, b);
    const fin = applyHumanEdit(key, nar);
    const text = `${fin.line} ${fin.hint}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, null),
      ...checkNoteClaims(text, cpAsPerfume(cp), vocab),
    ].filter((v) => v.severity === "block");
    if (blocks.length) {
      console.log(`❌ ${key}：${blocks.map((x) => `${x.label}「${x.word}」`).join("；")}`);
      bad++;
      continue;
    }
    if (fin.line !== nar.line || fin.hint !== nar.hint) {
      changed++;
      console.log(`✏️ ${key}`);
      if (fin.line !== nar.line) console.log(`   line: ${nar.line}  →  ${fin.line}`);
      if (fin.hint !== nar.hint) console.log(`   hint: ${nar.hint}  →  ${fin.hint}`);
    }
    rows.push({ key, line: fin.line.trim(), hint: fin.hint.trim() });
  }
  console.log(`\n校订 ${changed} 条 / 键规范化 ${renamed} 条 / 共 ${rows.length} 条，违规 ${bad} 条`);
  if (bad > 0) {
    console.log("⛔ 存在违规 → **拒绝写文件**。");
    process.exit(1);
  }
  writeNarratives(rows, `deepseek-flash + 人工校订 ${changed} 条`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 8;
  const model = (args.includes("--model") ? args[args.indexOf("--model") + 1] : "fast") as ModelAlias;
  const limit = Number.isFinite(limitArg) ? limitArg : 8;
  const emit = args.includes("--emit");

  if (args.includes("--review")) {
    reviewNarratives();
    return;
  }
  if (args.includes("--edits-only")) {
    applyEditsOnly();
    return;
  }

  const pairs = buildPairs();
  const tasks = pairs.map(([a, b]) => ({ a, b }));
  const picked = limit > 0 ? tasks.slice(0, limit) : tasks;

  console.log(`══════ CP 合香文案生成（model=${model}, 共 ${pairs.length} 条, 本次 ${picked.length}, emit=${emit}）══════`);
  console.log(`   为什么是 ${pairs.length} 条而不是 256：合香卡已可交换，文案以「你们」视角写，两个方向同一句。\n`);

  const vocab = buildNoteVocabulary(PERFUMES);
  let okCount = 0;
  let badCount = 0;
  let totalTokens = 0;
  const actualModels = new Set<string>();
  const warnList: Array<{ key: string; why: string }> = [];
  const results: Array<{ key: string; line: string; hint: string }> = [];

  for (let i = 0; i < picked.length; i++) {
    const { a, b } = picked[i];
    const pa = findPersonality(a)!;
    const pb = findPersonality(b)!;
    const cp = getCpResonance(a, b);
    if (!cp) {
      console.log(`── ${i + 1}. ${a} × ${b}：❌ 无守护香，跳过`);
      badCount++;
      continue;
    }
    const prompt = buildPrompt({
      aName: a,
      aTagline: pa.tagline,
      aScent: pa.scentDirection,
      bName: b,
      bTagline: pb.tagline,
      bScent: pb.scentDirection,
      blendName: cp.blendName,
      top: cp.top.join("、"),
      heart: cp.heart.join("、"),
      base: cp.base.join("、"),
      diff: cp.diffTones,
      seal: cp.seal,
      moment: momentFor(i),
      angle: angleFor(i),
      isSame: a === b,
    });

    let done = false;
    let correction = "";
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const r = await chatJson<CpNarrative>({
          model,
          system: SYSTEM,
          prompt: correction ? `${prompt}\n\n${correction}` : prompt,
        });
        actualModels.add(r.actualModel);
        totalTokens += r.usage?.totalTokens ?? 0;

        const raw = `${r.data.line} ${r.data.hint}`;
        const blocks = [
          ...checkCopy(raw),
          ...checkPriceClaims(raw, null),
          ...checkNoteClaims(raw, cpAsPerfume(cp), vocab),
        ].filter((v) => v.severity === "block");

        const echoes = echoSegments(r.data.line ?? "", pa.tagline, pb.tagline);
        const hits = countNoteWords(raw, vocab);
        const tooMany = hits.length > MAX_NOTE_WORDS_IN_LINE2;
        const simile = SIMILE_WORDS.filter((w) => (r.data.line ?? "").includes(w));
        const personify = PERSONIFY_WORDS.filter((w) => (r.data.hint ?? "").includes(w));
        const qualityBad =
          echoes.length > 0 || tooMany || simile.length > 0 || personify.length > 0;
        const qualityNote = qualityBad
          ? [
              echoes.length ? `line 复读了人格一句话（${[...new Set(echoes)].map((w) => `「${w}」`).join("")}）` : "",
              tooMany ? `香调词点了 ${hits.length} 个（${hits.join("、")}），最多 ${MAX_NOTE_WORDS_IN_LINE2} 个` : "",
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
              `但这支合香并没有这些香调，或它属于被禁的宿命表述。请只用「合香三调」里列出的词重写。`
            : "修正要求：上一次的输出不符合规则，请严格按规则重写。";
        } else if (qualityBad) {
          correction =
            `修正要求：${qualityNote}。` +
            `line 请按「${angleFor(i)}」这个写法重写，从合香自身的气味写起，` +
            `不要碰人格一句话，不要用「像/如同/仿佛」，香调词只留 1–2 个；` +
            `hint 不要用「替你/替你们」，直接写那一刻气息的状态。`;
        }

        if (blocks.length === 0 && !qualityBad) {
          const key = `${a}::${b}`;
          const fin = applyHumanEdit(key, r.data);
          const post = [
            ...checkCopy(`${fin.line} ${fin.hint}`),
            ...checkPriceClaims(`${fin.line} ${fin.hint}`, null),
            ...checkNoteClaims(`${fin.line} ${fin.hint}`, cpAsPerfume(cp), vocab),
          ].filter((v) => v.severity === "block");

          console.log(`── ${i + 1}. ${a} × ${b}（${cp.blendName}｜${cp.diffTones === 0 ? "同调" : `隔${cp.diffTones}调`}｜${momentFor(i)}）`);
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
          results.push({ key, line: fin.line.trim(), hint: fin.hint.trim() });
          done = true;
        } else if (attempt === 3) {
          const why = blocks.length ? blocks.map((x) => `${x.label}「${x.word}」`).join("；") : qualityNote;
          console.log(`── ${i + 1}. ${a} × ${b}`);
          console.log(`   ${blocks.length ? "❌ 合规未过闸" : "⚠️ 质量未达标"}，重试 3 次：${why}`);
          if (blocks.length) {
            badCount++;
          } else {
            const key = `${a}::${b}`;
            const fin = applyHumanEdit(key, { line: r.data.line ?? "", hint: r.data.hint ?? "" });
            warnList.push({ key, why: qualityNote });
            results.push({ key, line: fin.line.trim(), hint: fin.hint.trim() });
            okCount++;
          }
        }
      } catch (e) {
        if (attempt === 3) {
          console.log(`── ${i + 1}. ${a} × ${b}`);
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
    console.log(`\n  ⚠️ 质量未达标 ${warnList.length} 条（合规已过，需人工改写）：`);
    for (const w of warnList) console.log(`     · ${w.key} —— ${w.why}`);
  }
  console.log(`  实际模型：${[...actualModels].join(", ") || "-"}`);
  console.log(`  累计 token：${totalTokens}`);
  if (badCount > 0) {
    console.log("\n  ⚠️ 有未过闸项，先修 prompt 或词表。");
    if (emit) {
      console.log("  ⛔ 已 --emit 但存在失败项 → **拒绝写文件**。");
    }
    process.exit(1);
  }
  if (emit) {
    writeNarratives(results, [...actualModels].join(", ") || "unknown");
  }
}

/** 落静态文件。文件头必须标「自动生成，勿手改」——手改会在下次生成时被静默覆盖。 */
function writeNarratives(
  rows: Array<{ key: string; line: string; hint: string }>,
  modelUsed: string,
): void {
  const outPath = path.join(process.cwd(), "lib", "data", "cpNarratives.ts");
  const body = rows
    .map(
      (r) =>
        `  ${JSON.stringify(r.key)}: { line: ${JSON.stringify(r.line)}, hint: ${JSON.stringify(r.hint)} },`,
    )
    .join("\n");

  const src = `// ============================================================
// ⚠️ 本文件由 scripts/gen-cp-narratives.ts 自动生成，请勿手改。
//    改文案请改生成脚本的 prompt 或 HUMAN_EDITS 表，手改会在下次生成时被静默覆盖。
//
// L1 离线生成产物：人格对 × 合香的解读。
//   键格式："人格A::人格B"（A、B 已按名字排序，A×B 与 B×A 取到同一条）
//   条数 136 = C(16+1,2)，不是 256 —— 合香卡可交换，文案以「你们」视角写。
//   运行时只读本表，零 LLM 调用、零延迟、完全可复现。
//   覆盖度与合规由 scripts/audit-perfume-data.ts 的 G 项守着。
//
// 生成信息：
//   条数    ${rows.length}
//   模型    ${modelUsed}
//   时间    ${new Date().toISOString()}
// ============================================================

export interface CpNarrative {
  /** 合香解读（替代原先按「差几调」分档的 4 条通用文案） */
  line: string;
  /** 适合一起出现的时刻 */
  hint: string;
}

export const CP_NARRATIVES: Record<string, CpNarrative> = {
${body}
};

/** 取文案；没有则返回 null（调用方回落到分档文案）。键内两人名已排序，保证可交换。 */
export function getCpNarrative(nameA: string, nameB: string): CpNarrative | null {
  const [a, b] = [nameA, nameB].sort();
  return CP_NARRATIVES[\`\${a}::\${b}\`] ?? null;
}
`;

  fs.writeFileSync(outPath, src, "utf8");
  console.log(`\n  💾 已写入 lib\\data\\cpNarratives.ts（${rows.length} 条）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
