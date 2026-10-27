// ============================================================
// F5 · 今日香签个性化文案离线生成（L1）
//
// 为什么做：现在签面短评用的是 `p.description`（事实性短描述，全员同一句），
// 今日一语是全站 8 句循环。同一个人每天读到的「意味」和他自己无关 ——
// 而抽到的香其实是可以按「你这类人」重新说一遍的。AI 只负责这句「重新说」。
//
// 规模：224 条 = 96（16 人格 × 6 香调族）+ 128（16 人格 × 8 句原句）
//   不按「人格 × 225 支」= 3600 条生成 —— 签面只需要一句意味，不需要逐支档案（那是 F7）。
//
// ⚠️ 最关键的一条硬约束：
//   这些文案会配到**任意一支香**上，所以**一个字都不许出现香调名词**。
//   出现「雪松」就意味着抽到 224 支别的香时是错的 —— 按「零香调词」硬卡（比 checkNoteClaims 更严）。
//
// ⚠️ 绝不碰抽签：只产出展示层文案。`audit-pool-stable` 必须保持「历史结果零改动」。
//
// 用法：
//   npx tsx scripts/gen-daily-signs.ts --limit 6        试跑（两类各 6 条）
//   npx tsx scripts/gen-daily-signs.ts --limit 0 --emit 全量落盘
//   npx tsx scripts/gen-daily-signs.ts --review 8       抽检（不调模型）
//   npx tsx scripts/gen-daily-signs.ts --edits-only     只应用人工校订
// ============================================================

import "./_env";
import * as fs from "node:fs";
import * as path from "node:path";
import { PERSONALITY_TYPES } from "@/lib/data";
import { SIGN_LINES, SIGN_WORDS } from "@/lib/data/dailySigns";
import { NOTE_POOL } from "@/lib/daily/almanac";
import { SIGN_FAMILIES, FAMILY_LABEL, type SignFamily } from "@/lib/daily/signCopy";
import { PERFUMES } from "@/lib/data";
import { checkCopy, checkPriceClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { chatJson, type ModelAlias } from "@/lib/ai/client";
import { countNoteWords, echoSegments } from "./_narrativeQuality";

const SYSTEM = [
  "你是 Crush 香鉴的文案撰写者，现在写「今日香签」上的短句。",
  "品牌调性：克制、高级、留白，像一句短诗，不像广告，也不像鸡汤。",
  "",
  "硬规则（违反任何一条都不合格）：",
  "1. **不许出现任何香调/香料名词**：雪松、檀香、玫瑰、茉莉、柑橘、佛手柑、麝香、琥珀、",
  "   香草、皮革、乳香、广藿香… 一个都不许。写的是气质与心境，不是成分。",
  "2. 禁止医疗与疗效暗示（治愈、助眠、安神、镇静、消炎）。情绪词一律用「舒缓」。",
  "3. 禁止迷信与宿命表述（转运、改命、破灾、缘分、命中注定、招桃花、灵验）。",
  "4. 不得写心理诊断（「你其实害怕被抛下」这种），只谈气息与当下的状态。",
  "5. 不得出现价格数字、货币符号、极限承诺词（绝对、永久、100%、顶级）。",
  "6. 不得使用明喻词：像、如同、仿佛、好似。",
  "7. 不得用「替你」这类拟人句式。",
  "8. 一个人称到底，直接对人说，不要写「愿你…」以外的祈使连发。",
  "9. 只输出 JSON，不要解释。",
].join("\n");

/** 写法池：按序号轮转，把 96 / 128 条分成 8 种写法，分布由我们控制（不是靠模型自觉） */
const ANGLE_POOL = [
  "写今天的状态：适合把自己放在什么位置",
  "写一个可以做的小动作（闻一下、停一会儿、走出去）",
  "写「不必」的事：今天可以不做什么",
  "写注意力放在哪里：留意什么、放过什么",
  "写时间感：今天适合快一点还是慢一点",
  "写距离感：和人对齐还是留出空隙",
  "写接纳：允许自己保留哪一部分",
  "写一句很轻的判断，不下结论",
] as const;

const SIMILE_WORDS = ["如同", "仿佛", "好似", "像"];
const PERSONIFY_WORDS = ["替你", "替我们"];
const MAX_LINE_LEN = 26;
const MAX_WORD_LEN = 24;

/**
 * 运行时注入的「禁用句式」（--ban "不必|今天|停一会"）。
 * 为什么需要：首轮 224 条里 81 条含「不必」、79 条以「今天」开头 —— 单独看每条都通顺，
 * 但同一个人格的 14 条里有 5~7 条同一个开头，读起来就是模板。
 * 这类塌缩靠「请写得多样一点」是求不来的，只能**外部指派**：指定这一批不许用哪些词。
 */
const BAN_WORDS: string[] = [];

/**
 * 句末标点规范化：中文句子统一以 。/！/？ 收尾。
 * 首轮 28 条没有句末标点（「允许自己保留那份不急着解释的柔软」），
 * 放在这里统一处理，比逐条手改可靠（手改会被下次生成覆盖）。
 */
function normalizeEnd(s: string): string {
  const t = s.trim();
  return /[。！？]$/.test(t) ? t : `${t}。`;
}

const editKeyLine = (p: string, f: SignFamily) => `${p}::${f}`;
const editKeyWord = (p: string, i: number) => `${p}::${i}`;

/**
 * 人工校订表。首轮跑完按 --review 逐条看，把不顺的句子放这里，
 * **绝不直接改产物文件** —— 产物整体重写会静默覆盖手改。
 */
const HUMAN_EDITS: Record<string, string> = {
  // 2026-10-27 首轮 224 条量化：81 条含「不必」（36%）、79 条以「今天」开头 ——
  // 同一个人格 14 条里有 5~7 条同一开头，读起来就是模板。
  // 已用 --ban "不必|今天" 重跑 35 条；剩下这 10 条是模型 3 次都没躲开禁用词，
  // 或与同组其它条语义重复（空号/烬生各有一对几乎同义），人工改写。
  "暗流::5": "不追着谁的节奏走，静水自会认路。",
  "裂岸::4": "快一点也没关系，气息已经先你动身。",
  "寒岭::2": "站远一点听，独处时你更接近真相。",
  "空号::0": "把今天留出一小块，谁都不用进来。",
  "空号::2": "留白不需要理由，它自己成立。",
  "沉湾::5": "同频这件事，可以慢慢来。",
  "霜冷::2": "不出声也可以，静里更有你的样子。",
  "霜冷::4": "留一点空隙，人和人之间可以不那么近。",
  "烬生::1": "停一会儿，柔软留在原处就好。",
  "烬生::fruity": "留一步空隙，甜和圆先给自己。",
};

function angleFor(i: number): string {
  return ANGLE_POOL[i % ANGLE_POOL.length];
}

const vocab = buildNoteVocabulary(PERFUMES);

interface Verdict {
  blocks: string[];
  quality: string[];
}

/** 生成与门禁共用同一套判定，避免「生成时查、上线后不查」 */
function judge(text: string, echoSources: string[], maxLen: number): Verdict {
  const blocks: string[] = [];
  const quality: string[] = [];

  for (const v of [...checkCopy(text), ...checkPriceClaims(text, null)]) {
    if (v.severity === "block") blocks.push(`${v.label}「${v.word}」`);
  }
  const notes = countNoteWords(text, vocab);
  if (notes.length) blocks.push(`出现香调词「${notes.join("、")}」（会被配到任意一支香上，必须零香调词）`);
  const echo = echoSegments(text, ...echoSources);
  if (echo.length) blocks.push(`复述底稿「${echo.join("、")}」`);

  const simile = SIMILE_WORDS.filter((w) => text.includes(w));
  if (simile.length) quality.push(`明喻词「${simile.join("、")}」`);
  const person = PERSONIFY_WORDS.filter((w) => text.includes(w));
  if (person.length) quality.push(`拟人句式「${person.join("、")}」`);
  const banned = BAN_WORDS.filter((w) => text.includes(w));
  if (banned.length) quality.push(`用了本轮禁用的句式「${banned.join("、")}」`);
  if (text.length > maxLen) quality.push(`超过 ${maxLen} 字（${text.length}）`);

  return { blocks, quality };
}

// ── 两类任务的定义 ──

interface Task {
  key: string;
  kind: "line" | "word";
  personality: string;
  tagline: string;
  prompt: string;
  echoSources: string[];
  maxLen: number;
  /** 组内判重用的键（line: 族；word: 原句下标） */
  group: string;
}

function buildTasks(): Task[] {
  const tasks: Task[] = [];
  let i = 0;

  // ① 签面短评：人格 × 族
  for (const per of PERSONALITY_TYPES) {
    for (const fam of SIGN_FAMILIES) {
      const angle = angleFor(i++);
      tasks.push({
        key: editKeyLine(per.name, fam),
        kind: "line",
        personality: per.name,
        tagline: per.tagline,
        group: `line:${fam}`,
        echoSources: [per.tagline, per.matchingReport?.coreMessage ?? ""],
        maxLen: MAX_LINE_LEN,
        prompt: [
          `这个人格：${per.name} —— ${per.tagline}`,
          `气味方向：${per.scentDirection}`,
          `今天抽到的香属于「${FAMILY_LABEL[fam]}」这一类（具体是哪支不重要，别猜香名）。`,
          ``,
          `写一句签面短评：这支香今天对这个类型的人意味着什么。`,
          `- 不超过 ${MAX_LINE_LEN} 字，一句话，不加引号，不要写香名`,
          `- 不许出现任何香调/香料名词`,
          `- 不复述上面那句人格描述`,
          `- 指定写法：${angle}`,
          ``,
          `输出 JSON：{"text":"..."}`,
        ].join("\n"),
      });
    }
  }

  // ② 今日一语：人格 × 原句
  for (const per of PERSONALITY_TYPES) {
    for (let n = 0; n < NOTE_POOL.length; n++) {
      const angle = angleFor(i++);
      tasks.push({
        key: editKeyWord(per.name, n),
        kind: "word",
        personality: per.name,
        tagline: per.tagline,
        group: `word:${n}`,
        echoSources: [NOTE_POOL[n], per.tagline],
        maxLen: MAX_WORD_LEN,
        prompt: [
          `今日一语（当前全站共用这一句）：${NOTE_POOL[n]}`,
          `这个人格：${per.name} —— ${per.tagline}`,
          ``,
          `把它改写成「只对这个类型的人说」的一句：保留原意，但换一种说法。`,
          `- 不超过 ${MAX_WORD_LEN} 字，一句话，不加引号`,
          `- 不得照抄原句里连续 5 个字以上`,
          `- 不许出现任何香调/香料名词`,
          `- 指定写法：${angle}`,
          ``,
          `输出 JSON：{"text":"..."}`,
        ].join("\n"),
      });
    }
  }

  return tasks;
}

function writeProduct(lines: Record<string, string>, words: Record<string, string>, modelUsed: string): void {
  const outPath = path.join(process.cwd(), "lib", "data", "dailySigns.ts");
  const fmt = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      .join("\n");

  const src = `// ============================================================
// ⚠️ 本文件由 scripts/gen-daily-signs.ts 自动生成，请勿手改。
//    改文案请改生成脚本的 prompt 或 HUMAN_EDITS 表，手改会在下次生成时被静默覆盖。
//
// L1 离线生成产物：今日香签的个性化文案（F5）。
//   ① SIGN_LINES  签面短评：16 人格 × 6 香调族 = ${Object.keys(lines).length} 条
//   ② SIGN_WORDS  今日一语：16 人格 × 8 句原句 = ${Object.keys(words).length} 条
//
// 只有一句，所以直接存字符串。
// ⚠️ 这些文案会被配到**任意一支香**上，因此一个字都不许出现香调名词 ——
//    出现即意味着 224/225 的场合是错的（门禁按「零香调词」硬卡）。
//
// 覆盖度与合规由 scripts/audit-daily-advice.ts 的 F5 段守着。
//
// 生成信息：
//   条数    ${Object.keys(lines).length + Object.keys(words).length}
//   模型    ${modelUsed}
//   时间    ${new Date().toISOString()}
// ============================================================

/** 签面短评：键 = \`\${人格名}::\${香调族}\` */
export const SIGN_LINES: Record<string, string> = {
${fmt(lines)}
};

/** 今日一语：键 = \`\${人格名}::\${原句下标}\` */
export const SIGN_WORDS: Record<string, string> = {
${fmt(words)}
};
`;
  fs.writeFileSync(outPath, src, "utf8");
  console.log(`\n  💾 已写入 lib\\data\\dailySigns.ts（短评 ${Object.keys(lines).length} + 一语 ${Object.keys(words).length}）`);
}

function review(n: number): void {
  const total = Object.keys(SIGN_LINES).length + Object.keys(SIGN_WORDS).length;
  console.log(`══════ 日签文案抽检（${Math.min(n, total)} / ${total} 条）══════\n`);
  const rows: Array<[string, string, number, string[]]> = [
    ...Object.entries(SIGN_LINES).map(([k, v]) => [k, v, MAX_LINE_LEN, [] as string[]] as [string, string, number, string[]]),
    ...Object.entries(SIGN_WORDS).map(([k, v]) => [k, v, MAX_WORD_LEN, [] as string[]] as [string, string, number, string[]]),
  ];
  const step = Math.max(1, Math.floor(rows.length / Math.min(n, rows.length)));
  for (let i = 0; i < rows.length && i / step < n; i += step) {
    const [k, v, maxLen] = rows[i];
    const [per, tail] = k.split("::");
    const echoSrc =
      k in SIGN_LINES ? [PERSONALITY_TYPES.find((p) => p.name === per)?.tagline ?? ""] : [NOTE_POOL[Number(tail)] ?? ""];
    const r = judge(v, echoSrc, maxLen);
    console.log(`── ${k}${k in SIGN_LINES ? `（${FAMILY_LABEL[tail as SignFamily]}）` : ""}`);
    console.log(`   ${v}`);
    console.log(r.blocks.length || r.quality.length ? `   ❌/⚠️ ${[...r.blocks, ...r.quality].join("；")}` : "   ✅ 过闸");
    console.log("");
  }
}

function applyEditsOnly(): void {
  console.log("══════ 应用人工校订（不调模型）══════\n");
  const lines: Record<string, string> = {};
  const words: Record<string, string> = {};
  const seen = new Map<string, string>();
  let changed = 0;
  let bad = 0;

  for (const [k, v] of Object.entries(SIGN_LINES)) {
    const fin = normalizeEnd(HUMAN_EDITS[k] ?? v);
    if (fin !== v) {
      changed++;
      console.log(`✏️ ${k}\n   ${v}\n   → ${fin}`);
    }
    const per = k.split("::")[0];
    const tagline = PERSONALITY_TYPES.find((p) => p.name === per)?.tagline ?? "";
    const r = judge(fin, [tagline], MAX_LINE_LEN);
    if (r.blocks.length) {
      console.log(`❌ ${k}：${r.blocks.join("；")}`);
      bad++;
      continue;
    }
    if (r.quality.length) console.log(`⚠️ ${k}：${r.quality.join("；")}`);
    lines[k] = fin;
  }
  for (const [k, v] of Object.entries(SIGN_WORDS)) {
    const fin = normalizeEnd(HUMAN_EDITS[k] ?? v);
    if (fin !== v) {
      changed++;
      console.log(`✏️ ${k}\n   ${v}\n   → ${fin}`);
    }
    const idx = Number(k.split("::")[1]);
    const r = judge(fin, [NOTE_POOL[idx] ?? ""], MAX_WORD_LEN);
    if (r.blocks.length) {
      console.log(`❌ ${k}：${r.blocks.join("；")}`);
      bad++;
      continue;
    }
    if (r.quality.length) console.log(`⚠️ ${k}：${r.quality.join("；")}`);
    words[k] = fin;
  }

  // 组内判重（同族不同人格、同原句不同人格都不该撞句）—— 撞句是硬伤，必须阻断写盘
  for (const [k, v] of [...Object.entries(lines), ...Object.entries(words)]) {
    const group = k in lines ? `line:${k.split("::")[1]}` : `word:${k.split("::")[1]}`;
    const gk = `${group}|${v}`;
    const prev = seen.get(gk);
    if (prev) {
      console.log(`❌ 撞句：${prev} 与 ${k} 完全相同「${v}」`);
      bad++;
    } else seen.set(gk, k);
  }

  console.log(`\n校订 ${changed} 条 / 短评 ${Object.keys(lines).length} + 一语 ${Object.keys(words).length}，违规 ${bad} 条`);
  if (bad > 0) {
    console.log("⛔ 存在违规 → **拒绝写文件**。");
    process.exit(1);
  }
  writeProduct(lines, words, "deepseek-flash + 人工校订");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 4;
  const model = (args.includes("--model") ? args[args.indexOf("--model") + 1] : "fast") as ModelAlias;
  const limit = Number.isFinite(limitArg) ? limitArg : 4;
  const emit = args.includes("--emit");

  if (args.includes("--review")) {
    const nArg = Number(args[args.indexOf("--review") + 1]);
    review(Number.isFinite(nArg) && nArg > 0 ? nArg : 8);
    return;
  }
  if (args.includes("--edits-only")) {
    applyEditsOnly();
    return;
  }

  const all = buildTasks();
  const onlyArg = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
  const onlyKeys = onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const merge = args.includes("--merge");
  if (args.includes("--ban")) {
    const raw = args[args.indexOf("--ban") + 1] ?? "";
    BAN_WORDS.push(...raw.split(/[|,，、]/).map((s) => s.trim()).filter(Boolean));
    console.log(`  本轮禁用句式：${BAN_WORDS.join("、")}`);
  }
  const tasks = onlyKeys ? all.filter((t) => onlyKeys.has(t.key)) : limit > 0 ? all.slice(0, limit) : all;
  console.log(`══════ 日签文案生成（model=${model}, 共 ${all.length} 条, 本次 ${tasks.length}, emit=${emit}, merge=${merge}）══════\n`);

  const results = new Map<string, string>();
  const groupSeen = new Map<string, string>(); // group|text → key，组内判重
  // 补跑/合并时，先用现有产物把「组内已占用的说法」填进去，避免新句和旧句撞车
  if (merge || onlyKeys) {
    for (const [k, v] of Object.entries(SIGN_LINES)) {
      if (!onlyKeys?.has(k)) groupSeen.set(`line:${k.split("::")[1]}|${v}`, k);
    }
    for (const [k, v] of Object.entries(SIGN_WORDS)) {
      if (!onlyKeys?.has(k)) groupSeen.set(`word:${k.split("::")[1]}|${v}`, k);
    }
  }
  let okCount = 0;
  let badCount = 0;
  let totalTokens = 0;
  const actualModels = new Set<string>();
  const warnList: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    let done = false;
    let correction = "";

    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const r = await chatJson<{ text: string }>({
          model,
          system: SYSTEM,
          prompt: correction ? `${t.prompt}\n\n${correction}` : t.prompt,
        });
        actualModels.add(r.actualModel);
        totalTokens += r.usage?.totalTokens ?? 0;

        const text = normalizeEnd((r.data.text ?? "").trim().replace(/^["「『]|["」』]$/g, ""));
        const v = judge(text, t.echoSources, t.maxLen);
        const groupHit = groupSeen.get(`${t.group}|${text}`);
        if (!v.blocks.length && groupHit) {
          v.quality.push(`与 ${groupHit} 撞句（同一组里说法必须不同）`);
        }

        if (!v.blocks.length && !v.quality.length) {
          const fin = HUMAN_EDITS[t.key] ?? text;
          const post = judge(fin, t.echoSources, t.maxLen);
          if (post.blocks.length) {
            console.log(`── ${i + 1}. ${t.key}\n   ❌ 人工校订后仍违规：${post.blocks.join("；")}`);
            badCount++;
            done = true;
            continue;
          }
          groupSeen.set(`${t.group}|${fin}`, t.key);
          results.set(t.key, fin);
          okCount++;
          done = true;
          console.log(`── ${i + 1}. ${t.key}${attempt > 1 ? `（第 ${attempt} 次）` : ""}\n   ${fin}`);
        } else {
          correction =
            `修正要求：${[...v.blocks, ...v.quality].join("；")}。` +
            `请重写这一句，按「${angleFor(i)}」这个写法，不得出现任何香料名词。`;
          if (attempt === 3) {
            console.log(`── ${i + 1}. ${t.key}\n   ❌ 重试 3 次未达标：${[...v.blocks, ...v.quality].join("；")}`);
            if (v.blocks.length) badCount++;
            else {
              const fin = HUMAN_EDITS[t.key] ?? text;
              warnList.push(`${t.key} —— ${v.quality.join("；")}`);
              groupSeen.set(`${t.group}|${fin}`, t.key);
              results.set(t.key, fin);
              okCount++;
            }
            done = true;
          }
        }
      } catch (e) {
        if (attempt === 3) {
          console.log(`── ${i + 1}. ${t.key}\n   ❌ 生成失败：${(e as Error).message}`);
          badCount++;
        }
      }
    }
  }

  console.log("\n══════ 汇总 ══════");
  console.log(`  过闸 ${okCount} / 失败 ${badCount}`);
  console.log(`  实际模型：${[...actualModels].join(", ") || "-"}`);
  console.log(`  累计 token：${totalTokens}`);
  if (warnList.length) {
    console.log(`\n  ⚠️ 质量未达标 ${warnList.length} 条（合规已过，需人工改写）：`);
    for (const w of warnList) console.log(`     · ${w}`);
  }
  if (badCount > 0) {
    console.log("\n  ⚠️ 有未过闸项。");
    if (emit) console.log("  ⛔ 已 --emit 但存在失败项 → **拒绝写文件**。");
    process.exit(1);
  }

  if (emit) {
    // --merge：以现有产物为底，把本次结果覆盖上去（补跑单条时用）。
    // 不加 --merge 时必须是「本次跑满全部条目」，否则会静默截断未跑的条目。
    const lines: Record<string, string> = merge ? { ...SIGN_LINES } : {};
    const words: Record<string, string> = merge ? { ...SIGN_WORDS } : {};
    for (const t of all) {
      const v = results.get(t.key);
      if (!v) continue;
      if (t.kind === "line") lines[t.key] = v;
      else words[t.key] = v;
    }
    const total = Object.keys(lines).length + Object.keys(words).length;
    if (!merge && results.size < all.length) {
      console.log(`\n  ⛔ 本次只生成了 ${results.size}/${all.length} 条 → **拒绝写文件**（会截断其余条目）。`);
      process.exit(1);
    }
    if (merge && total < all.length) {
      console.log(`\n  ⛔ 合并后仍只有 ${total}/${all.length} 条 → **拒绝写文件**（还缺条目）。`);
      process.exit(1);
    }
    writeProduct(lines, words, [...actualModels].join(", ") || "unknown");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
