// ============================================================
// F3 · 解锁区「更深一层」解读离线生成（L1）
//
// 为什么做：解锁区是唯一同时满足「付费只卖解读深度」+「AI 成本可摊薄」的位置 ——
// 生成一次卖无数次。但现有四个区块的文案都只有 1~2 句（隐藏面约 55 字、
// 关系建议约 50 字），付费之后的「更厚」感知不够。这里给每个区块补一段深度解读。
//
// 规模：16 人格 × 4 区块 = 64 条（每 90~140 字）
//   区块：hidden 隐藏人格面 / relation 关系解读 / contrast 反差香 / blueprint 气味底稿
//
// ⚠️ 两条边界：
//   ① **不带任何香调词**。三调、底稿、反差香香调都由现有 UI 从数据里给出，
//      AI 再点一次香调就是在编事实（也一定会有 1/225 的错配）。门禁按「零香调词」硬卡。
//   ② **不改现有静态文案**（HIDDEN_FACES / SCENT_ADVICE / SCENT_BLUEPRINTS 是产品定过的口径），
//      只在其后追加一段，且必须换角度，不得复述。
//
// 用法：
//   npx tsx scripts/gen-unlock-deep.ts --limit 4          试跑（四区块各 1 条）
//   npx tsx scripts/gen-unlock-deep.ts --limit 0 --emit   全量落盘
//   npx tsx scripts/gen-unlock-deep.ts --review 8         抽检（不调模型）
//   npx tsx scripts/gen-unlock-deep.ts --edits-only       只应用人工校订
// ============================================================

import "./_env";
import * as fs from "node:fs";
import * as path from "node:path";
import { PERSONALITY_TYPES, PERFUMES } from "@/lib/data";
import { UNLOCK_DEEP, type UnlockDeepBlock } from "@/lib/data/unlockDeep";
import { UNLOCK_DEEP_BLOCKS } from "@/lib/unlockDeep";
import {
  getHiddenFace,
  getScentAdvice,
  getScentBlueprint,
  getContrastScent,
  getScentPhilosophy,
} from "@/lib/personalities";
import { checkCopy, checkPriceClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { chatJson, type ModelAlias } from "@/lib/ai/client";
import { countNoteWords, echoSegments } from "./_narrativeQuality";

const SYSTEM = [
  "你是 Crush 香鉴的资深解读作者，现在为「付费解锁区」写更深一层的解读。",
  "品牌调性：克制、高级、留白；像一封写给对方的短信，不像测评报告，也不像心理咨询。",
  "",
  "硬规则（违反任何一条都不合格）：",
  "1. **不许出现任何香调/香料名词**（雪松、檀香、玫瑰、柑橘、麝香、琥珀、香草、皮革…）。",
  "   这一层只谈人、谈状态、谈相处方式；具体香调由界面另外给出。",
  "2. 禁止医疗与疗效暗示（治愈、助眠、安神、镇静、疗愈）。情绪词一律用「舒缓」。",
  "3. 禁止迷信与宿命表述（转运、改命、破灾、缘分、命中注定、天作之合、招桃花、灵验）。",
  "4. 不做心理诊断、不贴病理标签。可以用「也许 / 往往 / 有时」，不下断言。",
  "5. 不出现价格数字、货币符号、极限承诺词（绝对、永久、100%、顶级）。",
  "6. 不复述我给的现有文案（那是已经给用户看过的话），必须换一个角度往下说。",
  "7. 不写「你」「你」连发的祈使句堆叠；一段话不分行、不用列表。",
  "8. 只输出 JSON，不要解释。",
].join("\n");

/** 四个区块各自的「往哪里深」——外部指派，不让模型自己选题 */
const BLOCK_BRIEF: Record<UnlockDeepBlock, { label: string; briefs: string[] }> = {
  hidden: {
    label: "隐藏人格面",
    briefs: [
      "写这层是怎么被养成的：什么样的场合把它练出来了",
      "写它在日常里的具体显形：一个很小的动作或习惯",
      "写它与你的关系：它替挡掉了什么，又让你错过了什么",
      "写怎么与它相处：一件这周就能做的小事",
    ],
  },
  relation: {
    label: "关系解读",
    briefs: [
      "写你在关系里的默认动作：靠近之前你先做什么",
      "写对方容易误解你的那一点，以及它其实是什么",
      "写你觉得舒服的关系节奏：快慢、远近、频率",
      "写一次可以尝试的调整：不用变成另一个人",
    ],
  },
  contrast: {
    label: "反差香",
    briefs: [
      "写为什么你需要一支「不像自己」的香",
      "写它适合出现的具体时刻，以及那一刻你想成为谁",
      "写穿上它时别人的反应，与你自己心里的反应",
      "写它和你本命香的关系：不是替换，是松一口气",
    ],
  },
  blueprint: {
    label: "气味底稿",
    briefs: [
      "写怎么拿着这份底稿去店里开口，第一句话说什么",
      "写试香时的判断顺序：先闻哪里、等多久、看什么",
      "写什么情况下这份底稿要微调，以及往哪个方向调",
      "写为什么这份底稿属于你：它对应的不是流行，而是你的节奏",
    ],
  },
};

const SIMILE_WORDS = ["如同", "仿佛", "好似"];
const MIN_LEN = 80;
// 上限只用来提示，不阻断：160~175 字读起来依然通顺，真正的代价只是页面高度。
// 阻断留给「红线 / 香调词 / 复读」这三类硬伤 —— 长度不该让一条好文案报废。
const MAX_LEN = 170;

/** 人工校订：键 = `${人格}::${区块}` */
const HUMAN_EDITS: Record<string, string> = {
  // 2026-10-28 首轮 64 条量化：语气软词塌缩 —— 7 个人格 4 条里 4 条都含「往往/也许」，
  // 5 个人格 3/4 条含「不必」。已用 --ban "往往|也许|不必" 重跑 28 条；
  // 剩下这 6 条模型 3 次都没躲开（每人只超 1 条），人工改写。
  "裂岸::relation":
    "你习惯把每件事都握在手里，好像只有这样才配得上别人递来的信任。也可以换个方式：在一场不那么重要的会面里晚一点开口，让别人的话多走几步；在熟悉的场合故意留一个空位不去填。这不是要你变成另一个人，只是让那份一直绷着的力气，暂时找到更柔和的落点。你依然是那个在混乱里站得住的人，只是这一次，选择不把所有重量都扛在自己身上。",
  "寒岭::blueprint":
    "走进店里，先别急着描述想要什么，说一句「我想找一支能让我安静下来的」就够了。剩下的留给他们追问，你在回答里慢慢确认。这支底稿适合在人不多的下午试：喷在手腕内侧，别立刻凑近，先去做点别的事，隔半小时再回来，看它还在不在、有没有变得更贴你。真正合适的那支，不会在第一秒打动你，而是在你快要忘记它的那一刻，忽然被注意到。",
  "极夜::hidden":
    "会议结束，所有人都松了口气，只有它会把纪要翻回去，改掉一个标点。那个动作小到没人看见，像把桌上歪了一毫米的杯子重新摆正，然后才允许自己离开。它不说这是较劲，只是心里有一道无声的尺，量过一遍才肯放过。而真正让它反复回去的，并非那处标点，是那个没被任何人留意到、自己先看见了的瞬间。",
  "空号::relation":
    "有人把你的沉默当成距离，把你的不解释当成冷淡。其实那只是你把话留给了值得的时刻，把位置留给了想靠近的人。你不擅长热闹，却擅长在场；不急着填满空气，反而让相处有了呼吸的余地。那些被误读的克制，是你最诚实的表达方式——不多说，是因为不想敷衍；不退让，是因为有些东西本就该守住。",
  "渊海::relation":
    "把节奏放慢一点，不是妥协，是让对的人有机会走近。健谈不是门槛，把想法摊开也不是义务，在某个瞬间先开口说一句就够了。深度不需要一直用沉默来证明，偶尔往前半步，让人看见你在，也让人知道怎么靠近。这不是变成另一个人，是让原本的你有被读到的可能。",
  "荒原::relation":
    "有些关系让人舒服，是因为不用赶。你不需要对方时刻在场，也不急着把彼此的距离填满。真正合拍的节奏，有时是隔一阵子才说话，再开口时仍接得上；有时是并肩走一段很长的路，谁也没打算先到终点。你愿意留给对方空间，也希望被同样对待。那种不追问、不催促的相处，会让心里那片旷野保持开阔，而你知道有人正走在来的路上。",
};

const vocab = buildNoteVocabulary(PERFUMES);

interface Task {
  key: string;
  personality: string;
  block: UnlockDeepBlock;
  prompt: string;
  echoSources: string[];
}

function buildTasks(): Task[] {
  const tasks: Task[] = [];
  let i = 0;
  for (const per of PERSONALITY_TYPES) {
    for (const block of UNLOCK_DEEP_BLOCKS) {
      const brief =
        BLOCK_BRIEF[block].briefs[Math.floor(i / UNLOCK_DEEP_BLOCKS.length) % BLOCK_BRIEF[block].briefs.length];
      i++;

      const common = [
        `这个人格：${per.name} —— ${per.tagline}`,
        `气质描述：${per.description}`,
        `气味方向：${per.scentDirection}`,
        `核心讯息（已给用户看过，不要复述）：${per.matchingReport?.coreMessage ?? ""}`,
      ];
      const echoSources: string[] = [per.tagline, per.matchingReport?.coreMessage ?? "", per.description];

      let blockContext: string[] = [];
      if (block === "hidden") {
        const h = getHiddenFace(per.name);
        blockContext = [
          `现有「隐藏人格面」文案（不要复述）：${h.content}`,
          `已给出的三个特质标签：${h.traits.join("、")}`,
          `写作方向：${brief}`,
        ];
        echoSources.push(h.content, h.traits.join(""));
      } else if (block === "relation") {
        const a = getScentAdvice(per.name);
        blockContext = [
          `现有「关系解读」文案（不要复述）：初次见面「${a.firstMeeting}」；亲密关系「${a.intimateRelation}」；建议「${a.relationAdvice}」`,
          `写作方向：${brief}`,
        ];
        echoSources.push(a.firstMeeting, a.intimateRelation, a.relationAdvice);
      } else if (block === "contrast") {
        const c = getContrastScent(per.name);
        blockContext = [
          `界面上已经展示的反差香：${c?.name ?? "（无）"}（${c?.brand ?? ""}），现有说明「${c?.why ?? ""}」`,
          `注意：不要点出这支香的任何香调，也不要提香名，只谈「为什么需要反面」`,
          `写作方向：${brief}`,
        ];
        echoSources.push(c?.why ?? "");
      } else {
        const bp = getScentBlueprint(per.name);
        blockContext = [
          `界面上已经展示的气味底稿签名：「${bp.signature}」（三调已由界面给出，**不要复述、不要点名任何香调**）`,
          `个人香气哲学（不要复述）：${getScentPhilosophy(per.name)}`,
          `写作方向：${brief}`,
        ];
        echoSources.push(bp.signature, getScentPhilosophy(per.name));
      }

      tasks.push({
        key: `${per.name}::${block}`,
        personality: per.name,
        block,
        echoSources,
        prompt: [
          ...common,
          ``,
          `【${BLOCK_BRIEF[block].label}】`,
          ...blockContext,
          ``,
          `写一段 90–140 字的解读，一段话，不分行、不用列表、不加标题。`,
          `语气：像一个了解你的人，平静地说出一件你自己没说破的事。`,
          ``,
          `输出 JSON：{"text":"..."}`,
        ].join("\n"),
      });
    }
  }
  return tasks;
}

interface Verdict {
  blocks: string[];
  quality: string[];
}

function judge(text: string, echoSources: string[]): Verdict {
  const blocks: string[] = [];
  const quality: string[] = [];
  for (const v of [...checkCopy(text), ...checkPriceClaims(text, null)]) {
    if (v.severity === "block") blocks.push(`${v.label}「${v.word}」`);
  }
  const notes = countNoteWords(text, vocab);
  if (notes.length) blocks.push(`出现香调词「${notes.join("、")}」（这一层只谈人，不谈香调）`);
  const echo = echoSegments(text, ...echoSources);
  if (echo.length) blocks.push(`复述现有文案「${echo.join("、")}」`);
  const simile = SIMILE_WORDS.filter((w) => text.includes(w));
  if (simile.length) quality.push(`明喻词「${simile.join("、")}」`);
  // 长度只提示、不阻断（见 MAX_LEN 注释）
  return { blocks, quality };
}

function writeProduct(rows: Record<string, string>, modelUsed: string): void {
  const outPath = path.join(process.cwd(), "lib", "data", "unlockDeep.ts");
  const body = Object.entries(rows)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");

  const src = `// ============================================================
// ⚠️ 本文件由 scripts/gen-unlock-deep.ts 自动生成，请勿手改。
//    改文案请改生成脚本的 prompt 或 HUMAN_EDITS 表，手改会在下次生成时被静默覆盖。
//
// L1 离线生成产物：结果页解锁区的「更深一层」解读（F3）。
//   16 人格 × 4 区块 = ${Object.keys(rows).length} 条，每条约 90–140 字。
//   区块：hidden（隐藏人格面）/ relation（关系解读）/ contrast（反差香）/ blueprint（气味底稿）
//
// ⚠️ 不带任何香调词：香调事实已经在现有 UI 里（三调、底稿、反差香三调都由数据给出），
//    扩写只做「深度表达」。出现香调词＝模型在编事实（门禁按「零香调词」硬卡）。
//
// 覆盖度与合规由 scripts/audit-unlock-deep.ts 守着。
//
// 生成信息：
//   条数    ${Object.keys(rows).length}
//   模型    ${modelUsed}
//   时间    ${new Date().toISOString()}
// ============================================================

/** 解锁区四个区块 */
export type UnlockDeepBlock = "hidden" | "relation" | "contrast" | "blueprint";

/** 键 = \`\${人格名}::\${区块}\` */
export const UNLOCK_DEEP: Record<string, string> = {
${body}
};
`;
  fs.writeFileSync(outPath, src, "utf8");
  console.log(`\n  💾 已写入 lib\\data\\unlockDeep.ts（${Object.keys(rows).length} 条）`);
}

function review(n: number): void {
  const entries = Object.entries(UNLOCK_DEEP);
  console.log(`══════ 解锁区深度解读抽检（${Math.min(n, entries.length)} / ${entries.length} 条）══════\n`);
  const step = Math.max(1, Math.floor(entries.length / Math.min(n, entries.length)));
  for (let i = 0; i < entries.length && i / step < n; i += step) {
    const [k, v] = entries[i];
    const [per, block] = k.split("::") as [string, UnlockDeepBlock];
    const echoSources =
      block === "hidden"
        ? [getHiddenFace(per).content]
        : block === "relation"
          ? [getScentAdvice(per).relationAdvice]
          : block === "contrast"
            ? [getContrastScent(per)?.why ?? ""]
            : [getScentBlueprint(per).signature];
    const r = judge(v, echoSources);
    console.log(`── ${k}（${BLOCK_BRIEF[block].label}｜${v.length} 字）`);
    console.log(`   ${v}`);
    console.log(r.blocks.length || r.quality.length ? `   ❌/⚠️ ${[...r.blocks, ...r.quality].join("；")}` : "   ✅ 过闸");
    console.log("");
  }
}

function applyEditsOnly(): void {
  console.log("══════ 应用人工校订（不调模型）══════\n");
  const rows: Record<string, string> = {};
  let changed = 0;
  let bad = 0;
  const seen = new Map<string, string>();

  for (const [k, v] of Object.entries(UNLOCK_DEEP)) {
    const fin = HUMAN_EDITS[k] ?? v;
    if (fin !== v) {
      changed++;
      console.log(`✏️ ${k}\n   ${v}\n   → ${fin}`);
    }
    const [per, block] = k.split("::") as [string, UnlockDeepBlock];
    const echoSources =
      block === "hidden"
        ? [getHiddenFace(per).content]
        : block === "relation"
          ? [getScentAdvice(per).relationAdvice]
          : block === "contrast"
            ? [getContrastScent(per)?.why ?? ""]
            : [getScentBlueprint(per).signature];
    const r = judge(fin, echoSources);
    if (r.blocks.length) {
      console.log(`❌ ${k}：${r.blocks.join("；")}`);
      bad++;
      continue;
    }
    if (r.quality.length) console.log(`⚠️ ${k}：${r.quality.join("；")}`);
    const gk = `${block}|${fin}`;
    const prev = seen.get(gk);
    if (prev) {
      console.log(`❌ 撞句：${prev} 与 ${k} 完全相同`);
      bad++;
    } else seen.set(gk, k);
    rows[k] = fin;
  }

  console.log(`\n校订 ${changed} 条 / 共 ${Object.keys(rows).length} 条，违规 ${bad} 条`);
  if (bad > 0) {
    console.log("⛔ 存在违规 → **拒绝写文件**。");
    process.exit(1);
  }
  writeProduct(rows, "deepseek-flash + 人工校订");
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
  const banArg = args.includes("--ban") ? (args[args.indexOf("--ban") + 1] ?? "") : "";
  const banWords = banArg.split(/[|,，、]/).map((s) => s.trim()).filter(Boolean);
  const tasks = onlyKeys ? all.filter((t) => onlyKeys.has(t.key)) : limit > 0 ? all.slice(0, limit) : all;

  console.log(
    `══════ 解锁区深度解读生成（model=${model}, 共 ${all.length} 条, 本次 ${tasks.length}, emit=${emit}, merge=${merge}）══════\n`,
  );
  if (banWords.length) console.log(`  本轮禁用句式：${banWords.join("、")}\n`);

  const results = new Map<string, string>();
  const groupSeen = new Map<string, string>();
  if (merge || onlyKeys) {
    for (const [k, v] of Object.entries(UNLOCK_DEEP)) {
      if (!onlyKeys?.has(k)) groupSeen.set(`${k.split("::")[1]}|${v}`, k);
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

        const text = (r.data.text ?? "").trim().replace(/^["「『]|["」』]$/g, "");
        const v = judge(text, t.echoSources);
        const banned = banWords.filter((w) => text.includes(w));
        if (banned.length) v.quality.push(`用了本轮禁用的句式「${banned.join("、")}」`);
        const groupHit = groupSeen.get(`${t.block}|${text}`);
        if (!v.blocks.length && groupHit) v.quality.push(`与 ${groupHit} 撞句`);

        if (!v.blocks.length && !v.quality.length) {
          const fin = HUMAN_EDITS[t.key] ?? text;
          const post = judge(fin, t.echoSources);
          if (post.blocks.length) {
            console.log(`── ${i + 1}. ${t.key}\n   ❌ 人工校订后仍违规：${post.blocks.join("；")}`);
            badCount++;
            done = true;
            continue;
          }
          groupSeen.set(`${t.block}|${fin}`, t.key);
          results.set(t.key, fin);
          okCount++;
          done = true;
          console.log(`── ${i + 1}. ${t.key}（${fin.length} 字）${attempt > 1 ? `（第 ${attempt} 次）` : ""}\n   ${fin}`);
        } else {
          correction = `修正要求：${[...v.blocks, ...v.quality].join("；")}。请重写这一段，仍按原方向。`;
          if (attempt === 3) {
            console.log(`── ${i + 1}. ${t.key}\n   ❌ 重试 3 次未达标：${[...v.blocks, ...v.quality].join("；")}`);
            if (v.blocks.length) badCount++;
            else {
              const fin = HUMAN_EDITS[t.key] ?? text;
              warnList.push(`${t.key} —— ${v.quality.join("；")}`);
              groupSeen.set(`${t.block}|${fin}`, t.key);
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
    const draft = args.includes("--draft");
    const rows: Record<string, string> = merge ? { ...UNLOCK_DEEP } : {};
    for (const t of all) {
      const v = results.get(t.key);
      if (v) rows[t.key] = v;
    }
    const total = Object.keys(rows).length;
    if (draft) {
      console.log(`\n  ⚠️ --draft：只写了 ${total}/${all.length} 条，剩下的用 --only ... --merge 补齐（门禁会拦住不完整的产物）。`);
    } else if (!merge && results.size < all.length) {
      console.log(`\n  ⛔ 本次只生成了 ${results.size}/${all.length} 条 → **拒绝写文件**（会截断其余条目）。`);
      process.exit(1);
    }
    if (!draft && merge && total < all.length) {
      console.log(`\n  ⛔ 合并后仍只有 ${total}/${all.length} 条 → **拒绝写文件**。`);
      process.exit(1);
    }
    writeProduct(rows, [...actualModels].join(", ") || "unknown");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
