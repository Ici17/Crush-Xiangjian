/**
 * contentGuard —— 文案合规校验器（离线生成的最后一道闸）
 *
 * 为什么需要它：
 * 项目的合规目前是靠「人工写死的文案 + 门禁脚本」保障的 —— 禁迷信表述、
 * 情绪词统一用「舒缓」不用「治愈」、回避医疗/法律/财务暗示。
 * 一旦把文案交给模型（无论在线还是离线批量生成），**这套防线就没有任何机制保证不被踩**。
 * 本文件就是把防线做成可执行的规则。
 *
 * 三档用途：
 *  1. L1 离线生成后 → 批量跑一遍，违规条目直接打回，不让脏文案进静态文件
 *  2. L2 运行时 → 模型输出先过闸再渲染（配合《人工智能生成合成内容标识办法》的 AI 标识）
 *  3. 现有静态文案 → `scripts/audit-perfume-content.ts` 会全量扫一遍，看看老文案有没有历史遗留
 *
 * ⚠️ 设计约束：
 *  · 只做「词表命中 + 位置回溯」，不做语义判断 —— 规则要可预测、可审计、可解释
 *  · `block` 是真红线（迷信/医疗/财务法律），命中必须处理
 *  · `warn` 是广告法极限词，**只提醒不阻断**：这类词常有无害用法，交给人工判断
 */

import type { Perfume } from "@/lib/data";

export type GuardSeverity = "block" | "warn";

export interface GuardRule {
  id: string;
  label: string;
  severity: GuardSeverity;
  words: readonly string[];
  /** 建议替换词，用于给生成侧修文案的提示 */
  suggest?: string;
}

export const GUARD_RULES: readonly GuardRule[] = [
  {
    id: "superstition",
    label: "迷信 / 宿命表述",
    severity: "block",
    words: [
      "转运", "改命", "破灾", "招桃花", "灵验", "命中注定", "开运", "护身",
      "旺财", "招财", "驱邪", "辟邪", "化煞", "风水", "命理", "八字",
      "占卜", "算命", "宿命", "命中", "运势",
    ],
    suggest: "改为情绪与审美表达，如「让你更靠近自己想要的氛围」",
  },
  {
    id: "medical",
    label: "医疗 / 疗效暗示",
    severity: "block",
    words: [
      "治愈", "疗效", "治疗", "药用", "药效", "消炎", "杀菌", "抗抑郁",
      "助眠", "安神", "镇静", "保健", "疗效显著",
    ],
    suggest: "情绪类用词统一用「舒缓」（温暖舒缓 / 清新舒缓 / 精致舒缓）",
  },
  {
    id: "finance-law",
    label: "财务 / 法律暗示",
    severity: "block",
    words: ["投资", "理财", "回报率", "保本", "股市", "法律意见", "胜诉"],
    suggest: "删除；Crush 只谈情绪与审美，不做任何财务法律建议",
  },
  {
    id: "absolute",
    label: "广告法极限词（仅提醒）",
    severity: "warn",
    words: ["100%", "永久", "绝对", "保证", "顶级", "极致", "无敌", "万能", "彻底", "唯一"],
    suggest: "改为有依据的具体描述，如「留香 4-5」而非「留香最久」",
  },
];

export interface GuardViolation {
  ruleId: string;
  label: string;
  severity: GuardSeverity;
  word: string;
  index: number;
  snippet: string;
  suggest?: string;
}

/** 命中位置上下文，便于人工定位与复核 */
function snippetOf(text: string, index: number, word: string): string {
  const start = Math.max(0, index - 8);
  const end = Math.min(text.length, index + word.length + 8);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

/**
 * 扫一段文案，返回所有违规项（按出现位置排序）。
 * 长串会被去重：同一个词在一段文案里出现多次只报一条，避免刷屏。
 */
export function checkCopy(text: string | undefined | null): GuardViolation[] {
  if (typeof text !== "string" || !text) return [];
  const found = new Map<string, GuardViolation>();
  for (const rule of GUARD_RULES) {
    for (const word of rule.words) {
      const idx = text.indexOf(word);
      if (idx < 0) continue;
      const key = `${rule.id}:${word}`;
      if (found.has(key)) continue;
      found.set(key, {
        ruleId: rule.id,
        label: rule.label,
        severity: rule.severity,
        word,
        index: idx,
        snippet: snippetOf(text, idx, word),
        suggest: rule.suggest,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

/** 是否命中真红线（warn 不算） */
export function hasBlock(text: string | undefined | null): boolean {
  return checkCopy(text).some((v) => v.severity === "block");
}

/** 只取红线项，便于生成侧直接打回 */
export function blockingViolations(text: string | undefined | null): GuardViolation[] {
  return checkCopy(text).filter((v) => v.severity === "block");
}

/**
 * 价格主张校验：文案里出现的每个「¥数字」都必须落在该香水的价格区间内。
 *
 * 这条是防模型编造价格的最后一道闸。价格必须来自 `PERFUMES[].priceRange`，
 * 模型不能自己算一个数。
 * 价格未知（parse 结果为 null）时，文案里出现任何 ¥ 数字都算违规。
 */
export function checkPriceClaims(text: string | undefined | null, price: { min: number; max: number } | null): GuardViolation[] {
  if (typeof text !== "string" || !text) return [];
  const out: GuardViolation[] = [];
  const re = /¥\s*(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const amount = Number(m[1]);
    const inRange = price ? amount >= price.min && amount <= price.max : false;
    if (!inRange) {
      out.push({
        ruleId: "price-claim",
        label: price ? "价格超出该香水区间（疑似编造）" : "该香水无可靠价格，文案不应出现具体价格",
        severity: "block",
        word: m[0],
        index: m.index,
        snippet: snippetOf(text, m.index, m[0]),
        suggest: price ? `应落在 ¥${price.min}-${price.max} 之间` : "删除价格描述",
      });
    }
  }
  return out;
}

/**
 * 香调主张校验：文案里出现的香调词，**必须是这支香真实拥有的**。
 *
 * 为什么要这道闸：实测抓到过 —— 库里写的是「橙」，模型自己补成了「橙花」。
 * 这种「近义词替换」看起来无害，但它已经不是我们的数据了：
 * 用户照着去找会找错，而且它是幻觉的入口（今天换橙花，明天可能换出整段三调）。
 *
 * 词典复用 P2 语义层的 `noteSemantics`（203 个香调词），不另建一份。
 * 允许命中范围 = 该香水的三调 + 我们的描述文案（都来自 PERFUMES，是事实）。
 */
/**
 * 类别词 → 支撑它的具体香调。
 *
 * 为什么需要：文案说「木质」是正当的 —— 只要这支香真的有雪松/檀香。
 * 一刀切禁掉类别词会让文案变得像成分表；一律放行又会回到编造。
 * 所以规则是：**类别词必须由该香真实拥有的具体香调支撑**。
 *
 * 这是本文件里唯一「人工维护」的知识，改动时请只加不减，并在
 * audit-perfume-data 的自检里确认它仍然工作。
 */
const NOTE_CATEGORIES: Record<string, string[]> = {
  // ⚠️ 「檀木」和「檀香」都列 —— 库里两种写法都有（漏一个就会把正当的「木质」误判为编造）
  木质: ["雪松", "檀香", "檀木", "乌木", "沉香", "松木", "柏木", "香根草", "愈创木", "桦木", "杉木", "广藿香", "木质"],
  柑橘: ["柠檬", "橙", "葡萄柚", "佛手柑", "香柠檬", "橘子", "青柠", "柚", "柑橘", "西柚", "血橙"],
  花香: ["茉莉", "玫瑰", "橙花", "晚香玉", "栀子", "铃兰", "鸢尾", "紫罗兰", "牡丹", "桂花", "鸡蛋花", "木兰"],
  白花: ["茉莉", "橙花", "晚香玉", "栀子", "铃兰", "鸡蛋花", "木兰", "依兰"],
  辛香: ["肉桂", "胡椒", "丁香", "豆蔻", "孜然", "姜", "藏红花"],
  东方: ["乳香", "没药", "焚香", "安息香", "琥珀", "香草", "树脂", "苏合香"],
  美食: ["香草", "焦糖", "蜂蜜", "可可", "杏仁", "零陵香豆", "太妃", "巧克力", "奶油"],
  水生: ["海盐", "海洋", "水生", "海藻", "西瓜酮"],
  绿意: ["薰衣草", "鼠尾草", "薄荷", "罗勒", "青草", "茶叶", "绿茶", "无花果叶", "紫苏"],
  麝香: ["麝香", "白麝香", "麝猫香"],
  皮革: ["皮革", "麂皮", "烟草"],
  粉感: ["鸢尾", "紫罗兰", "米粉", "粉末"],
};

/** 该香是否真的拥有足以支撑这个类别词的香调 */
function categorySupported(word: string, owned: string): boolean {
  const members = NOTE_CATEGORIES[word];
  if (!members) return false;
  return members.some((m) => owned.includes(m));
}

export function checkNoteClaims(
  text: string | undefined | null,
  perfume: Perfume | null,
  vocabulary: readonly string[] = [],
): GuardViolation[] {
  if (typeof text !== "string" || !text || !perfume) return [];
  // 允许命中范围 = 三调 + 我们的描述 + **香水名本身**。
  // 名字必须算进去：有一支香就叫「木质玫瑰」，而它的三调里并没有「木质」「玫瑰」，
  // 文案提它的名字是完全正当的 —— 不把 name 加进来会产生假阳性。
  const owned = [
    perfume.name ?? "",
    ...(perfume.notes?.top ?? []),
    ...(perfume.notes?.heart ?? []),
    ...(perfume.notes?.base ?? []),
    perfume.description ?? "",
  ].join(" ");

  const out: GuardViolation[] = [];
  const seen = new Set<string>();
  // 贪心最长匹配：短词会「吃掉」近义词 —— 比如库里是「橙」，模型写「橙花」，
  // 若按「橙」匹配就放行了。必须从长到短匹配，才能抓到「橙花」这种替换。
  const sorted = [...vocabulary].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < text.length) {
    let hit: string | null = null;
    for (const w of sorted) {
      if (w.length < 2) continue;
      if (text.startsWith(w, i)) {
        hit = w;
        break;
      }
    }
    if (hit) {
      // 两类放行：① 字面就是它的香调 ② 是类别词但被它真实拥有的香调支撑
      const allowed = owned.includes(hit) || categorySupported(hit, owned);
      if (!seen.has(hit) && !allowed) {
        seen.add(hit);
        out.push({
          ruleId: "note-claim",
          label: "出现了这支香没有的香调词（疑似模型自行补充）",
          severity: "block",
          word: hit,
          index: i,
          snippet: snippetOf(text, i, hit),
          suggest: `该香真实的香调：${[...(perfume.notes?.top ?? []), ...(perfume.notes?.heart ?? []), ...(perfume.notes?.base ?? [])].join("、")}`,
        });
      }
      i += hit.length;
    } else {
      i += 1;
    }
  }
  return out;
}

/**
 * 从香水库推导「香调词表」—— 225 支香真实三调的并集。
 *
 * 为什么不用 noteSemantics 的词典：那个模块只导出了查表函数与**数量**
 * （`ANNOTATED_NOTE_COUNT` 是 number 不是 Set），词表本身没导出。
 * 而我们要校验的是「这个词是不是我们香水库里的香调」，
 * 直接从 PERFUMES 推导反而更贴切 —— 它就是我们的事实宇宙，且同样是唯一真源。
 */
export function buildNoteVocabulary(perfumes: Record<string, Perfume>): string[] {
  const set = new Set<string>();
  for (const p of Object.values(perfumes)) {
    for (const n of [...(p.notes?.top ?? []), ...(p.notes?.heart ?? []), ...(p.notes?.base ?? [])]) {
      const w = n.trim();
      if (w.length >= 2) set.add(w);
    }
  }
  return [...set];
}

/** 一次性把红线 + 价格主张 + 香调主张都查了 */
export function checkAll(
  text: string | undefined | null,
  price?: { min: number; max: number } | null,
  perfume?: Perfume | null,
): GuardViolation[] {
  return [
    ...checkCopy(text),
    ...checkPriceClaims(text, price ?? null),
    ...checkNoteClaims(text, perfume ?? null),
  ];
}
