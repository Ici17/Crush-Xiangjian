/**
 * priceRange —— 把「¥1200-1600/50ml」这种展示字符串解析成可计算的结构
 *
 * 为什么单独一个文件：
 * 香水库里 225 支的价格历来是**给人看的字符串**，不是给程序比较的数值
 * （`lib/data.ts` 的 `Perfume.priceRange`）。于是任何「预算 800 以内」类的
 * 需求都没法在代码里实现 —— 包括未来的 AI 顾问做预算硬过滤。
 *
 * 这不是 AI 专属需求：**现在就能让推荐引擎用上预算过滤**，且是 L0 数据契约的第一步。
 *
 * ⚠️ 设计约束：解析失败返回 `null`，绝不返回 0。
 * 价格未知与价格为 0 是两件事，返回 0 会让「预算 800 以内」把所有解析失败的
 * 香水全选进来 —— 这类静默错误正是本项目最怕的那一类。
 */

export type Currency = "CNY";

export interface ParsedPrice {
  /** 原始展示字符串，便于回溯与展示 */
  raw: string;
  currency: Currency;
  /** 价格区间下限（人民币元） */
  min: number;
  /** 价格区间上限（人民币元） */
  max: number;
  /** 区间中值，用于排序与打分（不是承诺价，仅内部比较用） */
  mid: number;
  /** 容量（毫升）；解析不到为 null —— 此时每毫升价格一律为 null */
  capacityMl: number | null;
  /** 每毫升最低价；容量未知时为 null */
  perMlMin: number | null;
  /** 每毫升最高价；容量未知时为 null */
  perMlMax: number | null;
  /** 每毫升中值；容量未知时为 null */
  perMlMid: number | null;
}

/** 把各种全角/异体写法归一成一种，再交给正则 */
function normalize(raw: string): string {
  return raw
    .replace(/[￥]/g, "¥")
    .replace(/[－–—〜~～]/g, "-")
    .replace(/[／]/g, "/")
    .replace(/\s+/g, "")
    .replace(/毫升|ML|Ml/gi, "ml");
}

// ¥1200-1600/50ml
const RANGE_WITH_CAPACITY = /^¥(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)ml$/;
// ¥1200/50ml（单值，不做区间展开）
const SINGLE_WITH_CAPACITY = /^¥(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)ml$/;
// 没有容量时也要能解析，只是不提供每毫升价格
const RANGE_NO_CAPACITY = /^¥(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;
const SINGLE_NO_CAPACITY = /^¥(\d+(?:\.\d+)?)$/;

/**
 * 解析价格区间字符串。无法解析时返回 `null`（不是 0）。
 * 未知价格与零价格必须区分，否则预算过滤会把所有未知价格的香水全部放行。
 */
export function parsePriceRange(raw: string | undefined | null): ParsedPrice | null {
  if (typeof raw !== "string") return null;
  const s = normalize(raw.trim());
  if (!s) return null;

  let min: number;
  let max: number;
  let capacityMl: number | null = null;

  const mRange = s.match(RANGE_WITH_CAPACITY);
  const mSingle = s.match(SINGLE_WITH_CAPACITY);
  const mRangeNoCap = s.match(RANGE_NO_CAPACITY);
  const mSingleNoCap = s.match(SINGLE_NO_CAPACITY);

  if (mRange) {
    min = Number(mRange[1]);
    max = Number(mRange[2]);
    capacityMl = Number(mRange[3]);
  } else if (mSingle) {
    min = Number(mSingle[1]);
    max = Number(mSingle[1]);
    capacityMl = Number(mSingle[2]);
  } else if (mRangeNoCap) {
    min = Number(mRangeNoCap[1]);
    max = Number(mRangeNoCap[2]);
  } else if (mSingleNoCap) {
    min = Number(mSingleNoCap[1]);
    max = Number(mSingleNoCap[1]);
  } else {
    return null;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null;
  if (min > max) [min, max] = [max, min];
  if (capacityMl !== null && (!Number.isFinite(capacityMl) || capacityMl <= 0)) capacityMl = null;

  const perMlMin = capacityMl ? round2(min / capacityMl) : null;
  const perMlMax = capacityMl ? round2(max / capacityMl) : null;

  return {
    raw,
    currency: "CNY",
    min,
    max,
    mid: round2((min + max) / 2),
    capacityMl,
    perMlMin,
    perMlMax,
    perMlMid: perMlMin !== null && perMlMax !== null ? round2((perMlMin + perMlMax) / 2) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 预算硬过滤：香水是否落在预算上限内。
 *
 * **返回值是三态，不是两态** —— 这是本函数最重要的设计：
 *  · `true`  区间下限 ≤ 预算 → 明确「买得起」
 *  · `false` 区间下限 > 预算 → 明确「买不起」
 *  · `null`  价格未知 → **不能判断，交回调用方决定**
 *
 * 用「下限 ≤ 预算」而不是「上限 ≤ 预算」：价格是区间，"¥1200-1600" 的香水
 * 存在 1200 拿下的可能，按上限判会把大量真实可得的香水误杀。
 * 若业务上要保守，可改用 `p.max <= maxBudget`。
 *
 * ⚠️ 调用方必须显式处理 `null`。默认放行 = 把解析失败的全放进来（等于没过滤）；
 * 默认拒绝 = 把数据缺失的香水全隐藏。两者都不对，只能由调用方按场景选。
 */
export function withinBudget(price: ParsedPrice | null, maxBudget: number): boolean | null {
  if (price === null) return null;
  if (!Number.isFinite(maxBudget) || maxBudget <= 0) return null;
  return price.min <= maxBudget;
}

/** 格式化回展示文案（用于结果页/分享卡，保证与原始数据口径一致） */
export function formatPriceRange(price: ParsedPrice | null): string {
  if (!price) return "价格待确认";
  const cap = price.capacityMl ? `/${price.capacityMl}ml` : "";
  if (price.min === price.max) return `¥${price.min}${cap}`;
  return `¥${price.min}-${price.max}${cap}`;
}
