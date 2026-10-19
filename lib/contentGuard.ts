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

/** 一次性把红线 + 价格主张都查了 */
export function checkAll(text: string | undefined | null, price?: { min: number; max: number } | null): GuardViolation[] {
  return [...checkCopy(text), ...checkPriceClaims(text, price ?? null)];
}
