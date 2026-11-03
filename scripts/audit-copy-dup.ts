/**
 * audit-copy-dup.ts —— 文案重复 / 句式塌缩门禁（第 13 个）
 *
 * 为什么需要它：
 *   这已经是第四次踩「文案塌缩」了（F1 复读底稿 → F5 六成人格同一开头 → F3 语气软词 →
 *   2026-11-03 结果页 4 类区块 100% 以「你」开头、「你是那种」被 4 个人格共用）。
 *   每次都是「合规闸全绿，但用户读起来像同一篇」。合规闸管不了这个，必须单独量化。
 *
 * 三条判据（都是**用户可感知**的重复）：
 *   A. 整条完全相同 —— 0 容忍
 *   B. 同一句出现在 ≥3 个不同条目 —— 说明这句话在当模板用
 *   C. 人格级文案「开头 4 字」撞车 —— 用户换人格时最先看到的就是开头
 *
 * 注意 B 的阈值是 3 而不是 2：不同香水共用一句「通勤路上…」属于正常（场景本来就重复），
 * 但同一句铺到 3 条以上，就说明它在当模板。
 */

import { PERSONALITY_TYPES } from "@/lib/data";
import { getHiddenFace, getScentAdvice, getScentPhilosophy } from "@/lib/personalities";
import { PERFUME_NARRATIVES } from "@/lib/data/perfumeNarratives";
import { CP_NARRATIVES } from "@/lib/data/cpNarratives";
import { PERFUME_PROFILES } from "@/lib/data/perfumeProfiles";
import { UNLOCK_DEEP } from "@/lib/data/unlockDeep";
import { SIGN_LINES, SIGN_WORDS } from "@/lib/data/dailySigns";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

const norm = (s: string) =>
  s.replace(/[，。！？、；：""''（）()\s·—…《》「」]/g, "").toLowerCase();
const flatten = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Object.values(v as Record<string, unknown>)
        .filter((x): x is string => typeof x === "string")
        .join("。");

type Entry = { who: string; text: string };

function checkWholeAndSentence(label: string, entries: Entry[]) {
  // A. 整条完全相同
  const byWhole = new Map<string, string[]>();
  for (const e of entries) {
    const k = norm(e.text);
    byWhole.set(k, [...(byWhole.get(k) ?? []), e.who]);
  }
  const dupWhole = [...byWhole.entries()].filter(([, w]) => new Set(w).size > 1);
  dupWhole.length === 0
    ? ok(`${label}：${entries.length} 条，无整条重复`)
    : no(`${label}：${dupWhole.length} 组整条重复（${dupWhole.slice(0, 2).map(([, w]) => [...new Set(w)].join("/")).join("；")}）`);

  // B. 同一句出现在 ≥3 条
  const bySentence = new Map<string, Set<string>>();
  for (const e of entries) {
    for (const s of e.text.split(/(?<=[。！？；])/)) {
      const t = s.trim();
      if (t.length < 8) continue;
      const k = norm(t);
      if (!bySentence.has(k)) bySentence.set(k, new Set());
      bySentence.get(k)!.add(e.who);
    }
  }
  const hot = [...bySentence.entries()].filter(([, w]) => w.size >= 3);
  hot.length === 0
    ? ok(`${label}：无「同一句铺 3 条以上」的模板句`)
    : no(
        `${label}：${hot.length} 句被 3 条以上复用 —— ` +
          hot.slice(0, 3).map(([s, w]) => `「${s.slice(0, 18)}…」×${w.size}`).join("；"),
      );
}

/** C. 人格级文案的开头撞车（用户换人格时第一眼就会撞上） */
function checkHeadCollision(label: string, items: Array<{ who: string; text: string }>, len = 4) {
  const heads = new Map<string, string[]>();
  for (const it of items) {
    const h = it.text.slice(0, len);
    heads.set(h, [...(heads.get(h) ?? []), it.who]);
  }
  const dup = [...heads.entries()].filter(([, w]) => w.length > 1);
  dup.length === 0
    ? ok(`${label}：16 条开头 ${len} 字互不相同`)
    : no(`${label}：${dup.length} 组开头撞车（${dup.slice(0, 3).map(([h, w]) => `「${h}」${w.join("/")}`).join("；")}）`);

  const youHead = items.filter((i) => /^你/.test(i.text)).length;
  youHead <= Math.floor(items.length * 0.4)
    ? ok(`${label}：以「你」开头 ${youHead}/${items.length}（上限 40%）`)
    : no(`${label}：以「你」开头 ${youHead}/${items.length} —— 超过四成，换人格读起来会像同一篇`);
}

console.log("══════ 文案重复 / 句式塌缩门禁 ══════\n");

console.log("A. 人格级文案（结果页各区块正文）");
const per = (f: (n: string) => string) =>
  PERSONALITY_TYPES.map((p) => ({ who: p.name, text: f(p.name) }));

checkHeadCollision("性格解读", per((n) => PERSONALITY_TYPES.find((p) => p.name === n)!.description));
checkHeadCollision("隐藏人格面", per((n) => getHiddenFace(n).content));
checkHeadCollision("用香哲学", per((n) => getScentPhilosophy(n)));
checkHeadCollision("关系建议", per((n) => getScentAdvice(n).relationAdvice));
checkHeadCollision("初次见面", per((n) => getScentAdvice(n).firstMeeting));
checkHeadCollision("亲密关系", per((n) => getScentAdvice(n).intimateRelation));

console.log("\nB. 生成产物（整条重复 / 模板句）");
checkWholeAndSentence("F1 逐支解读", Object.entries(PERFUME_NARRATIVES).map(([k, v]) => ({ who: k, text: flatten(v) })));
checkWholeAndSentence("F4 CP 合香", Object.entries(CP_NARRATIVES).map(([k, v]) => ({ who: k, text: flatten(v) })));
checkWholeAndSentence("F3 解锁区深度", Object.entries(UNLOCK_DEEP).map(([k, v]) => ({ who: k, text: v })));
checkWholeAndSentence("F7 单香档案", Object.entries(PERFUME_PROFILES).map(([k, v]) => ({ who: k, text: flatten(v) })));
checkWholeAndSentence("F5 日签", [
  ...Object.entries(SIGN_LINES).map(([k, v]) => ({ who: k, text: v })),
  ...Object.entries(SIGN_WORDS).map(([k, v]) => ({ who: k, text: v })),
]);

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
