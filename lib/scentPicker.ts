/**
 * scentPicker —— 首屏「今天穿什么香」的独立选香路径（零 AI、零在线调用）
 *
 * ⚠️ 为什么必须是独立文件（2026-11-22）：
 *  `lib/daily/advice.ts` 有三条硬约束：全员同卡、个人化只体现在标注、
 *  绝不换候选；`lib/daily/draw.ts` / `pool.ts` 有日签零漂移契约。
 *  首屏这个模块要让用户**自主选标签并换候选**，两者语义冲突。
 *  所以这里另起一条路径：不 import 任何 lib/daily/*，不改主推荐算法，
 *  不新增「推荐输入通道」——canonical 指纹 fe9d2d70 与 225/225 可达率都不受影响。
 *
 * 规则与项目约定一致：
 *  - 所有信号都是**零中心软加减**，绝不硬过滤（硬过滤会砍可达率）；
 *  - 只用离线语义层 PERFUME_SEMANTICS 与香水库 PERFUMES，零 LLM；
 *  - 同一天 + 同一标签 → 同一支香（日期种子只在 top-N 内做稳定选取）；
 *  - 文案只谈氛围与审美，不承诺功效，不碰医疗/财务/命理话术。
 */

import { PERFUMES, type Perfume } from "./data";
import { PERFUME_SEMANTICS } from "./data/perfumeSemantics";
import { parsePriceRange } from "./priceRange";

export type TagKind = "scene" | "mood";
export type BudgetKey = "low" | "mid" | "high" | "any";

export interface PickTag {
  key: string;
  label: string;
  kind: TagKind;
  /** 未选中时的一句轻提示，也用作结果卡的理由引子 */
  hint: string;
  /** 质感偏好：键取自 PERFUME_SEMANTICS.texture，值为软权重 */
  textures: Partial<Record<string, number>>;
  /** 冷暖偏好：正=偏暖，负=偏冷，0=不挑 */
  temp: number;
  /** 扩散偏好：正=希望有存在感，负=希望收敛 */
  intensity: number;
  /** 留香偏好：正=希望持久 */
  longevity: number;
  /** 昼夜倾向 */
  dayNight: "day" | "night" | "any";
  /** 结果卡理由模板，{note} 会被替换成该香的前调首个词 */
  reason: string;
}

/** 现有场景标签（沿用 /discover 的场景语义，取用户点名的 4 个） */
export const SCENE_TAGS: PickTag[] = [
  {
    key: "solo", label: "独处", kind: "scene",
    hint: "只为自己，不必讨好",
    textures: { wood: 0.9, smoke: 0.5, powder: 0.3 }, temp: 0.15,
    intensity: -0.8, longevity: 0.3, dayNight: "any",
    reason: "独处时不必照顾谁的感受，{note} 的层次刚好留给自己慢慢闻。",
  },
  {
    key: "date", label: "约会", kind: "scene",
    hint: "靠近时才闻得到",
    textures: { petal: 0.8, milk: 0.5, resin: 0.35 }, temp: 0.5,
    intensity: -0.2, longevity: 1.0, dayNight: "night",
    reason: "{note} 开场不争先，靠近时才浮出来，留香也够撑到散场。",
  },
  {
    key: "office", label: "办公", kind: "scene",
    hint: "收敛克制，不打扰别人",
    textures: { green: 0.8, water: 0.6, petal: 0.2 }, temp: -0.3,
    intensity: -1.2, longevity: 0.2, dayNight: "day",
    reason: "{note} 清清爽爽，气味收在身侧，开会时也不会抢话。",
  },
  {
    key: "travel", label: "旅行", kind: "scene",
    hint: "清爽提神，扛得住折腾",
    textures: { fruit: 0.75, green: 0.7, water: 0.45 }, temp: -0.45,
    intensity: 0.6, longevity: 0.8, dayNight: "day",
    reason: "{note} 一开场就把人叫醒，路上换几个地方也还闻得见。",
  },
];

/** 新增「小情绪」标签：只描述当下状态，不承诺任何改变 */
export const MOOD_TAGS: PickTag[] = [
  {
    key: "soothe", label: "想被安慰", kind: "mood",
    hint: "温软一点的氛围",
    textures: { milk: 1.0, powder: 0.6, petal: 0.4 }, temp: 0.7,
    intensity: -0.7, longevity: 0.4, dayNight: "any",
    reason: "想被接住的时候，{note} 这类温软的气息比浓香更让人舒缓。",
  },
  {
    key: "invisible", label: "想隐身", kind: "mood",
    hint: "安静、不引人注意",
    textures: { water: 0.9, green: 0.65, powder: 0.4 }, temp: -0.4,
    intensity: -1.4, longevity: -0.2, dayNight: "any",
    reason: "{note} 很轻，几乎不宣告自己的存在，适合想安静一会儿的日子。",
  },
  {
    key: "refresh", label: "想提神", kind: "mood",
    hint: "清亮、有精神",
    textures: { fruit: 0.9, green: 0.8, water: 0.5 }, temp: -0.6,
    intensity: 0.9, longevity: 0.3, dayNight: "day",
    reason: "{note} 的清亮先到，像把窗推开一条缝，人跟着醒过来。",
  },
  {
    key: "seen", label: "想被看见", kind: "mood",
    hint: "留一点记忆点",
    textures: { spice: 0.9, resin: 0.55, petal: 0.45 }, temp: 0.45,
    intensity: 1.1, longevity: 0.9, dayNight: "night",
    reason: "{note} 有棱角，进屋时会被人多问一句，正好留给想被看见的今天。",
  },
  {
    key: "slow", label: "想慢下来", kind: "mood",
    hint: "不赶时间的节奏",
    textures: { wood: 0.85, smoke: 0.45, resin: 0.35 }, temp: 0.25,
    intensity: -0.5, longevity: 0.7, dayNight: "any",
    reason: "{note} 沉得慢，不催人，适合把今天过成一条长一点的路。",
  },
];

export const ALL_TAGS: PickTag[] = [...SCENE_TAGS, ...MOOD_TAGS];

export function findTag(key: string): PickTag | undefined {
  return ALL_TAGS.find((t) => t.key === key);
}

/** 结构化提问的三步选项（首屏 AI 入口用；不是自由输入框，不采 PII） */
export const QUESTION_STEPS = [
  { key: "scene", title: "今天要去哪里？", options: SCENE_TAGS.map((t) => ({ v: t.key, t: t.label })) },
  { key: "mood", title: "此刻是什么心情？", options: MOOD_TAGS.map((t) => ({ v: t.key, t: t.label })) },
  {
    key: "budget", title: "预算大概在？",
    options: [
      { v: "low", t: "300 内" },
      { v: "mid", t: "300–800" },
      { v: "high", t: "800 以上" },
      { v: "any", t: "先不设限" },
    ],
  },
] as const;

export interface ScentPick {
  name: string;
  brand: string;
  priceRange: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  intensity: number;
  longevity: number;
  reason: string;
  /** 用户所选标签，供埋点与结果卡回显 */
  tagKey: string;
  tagLabel: string;
  moodKey?: string;
  budget?: BudgetKey;
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Asia/Shanghai 日期键；复用埋点层的纯函数，避免第二份时区实现 */
function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function scoreOne(p: Perfume, tag: PickTag, mood?: PickTag, budget?: BudgetKey): number {
  // 零中心基准 50；所有项只做软加减，绝不因为某个条件把香水踢出候选
  let score = 50;
  const sem = PERFUME_SEMANTICS[p.id];
  // texture 的键是语义层的 Texture 联合类型，这里按字符串权重表查，统一放宽成 string 索引
  const texture = sem?.texture as Record<string, number> | undefined;
  const weights = [tag, mood].filter(Boolean) as PickTag[];

  for (const w of weights) {
    for (const [tex, weight] of Object.entries(w.textures)) {
      const v = (texture?.[tex] ?? 0) * 100;
      score += (v - 20) * (weight ?? 0); // 20 ≈ 质感分布的常见中心
    }
    score += (sem?.temp ?? 0) * w.temp * 30;
    score += (p.intensity - 3) * w.intensity * 7;
    score += (p.longevity - 3) * w.longevity * 7;
    if (w.dayNight !== "any" && sem?.dayNight === w.dayNight) score += 5;
  }

  // 预算也是软偏好：符合就加分，不符合绝不排除
  if (budget && budget !== "any") {
    const min = parsePriceRange(p.priceRange)?.min ?? null;
    if (min !== null) {
      const hit =
        (budget === "low" && min <= 300) ||
        (budget === "mid" && min > 300 && min <= 800) ||
        (budget === "high" && min > 800);
      score += hit ? 9 : -3;
    }
  }
  return score;
}

/**
 * 按标签挑一支香。同一天 + 同一组选择 → 同一支（日期种子只在 top-N 内稳定选取），
 * 既有「今日」的确定感，又让自主选择真的改变候选。
 */
export function pickScent(opts: {
  scene?: string;
  mood?: string;
  budget?: BudgetKey;
  dateKey?: string;
}): ScentPick | null {
  const sceneTag = opts.scene ? findTag(opts.scene) : undefined;
  const moodTag = opts.mood ? findTag(opts.mood) : undefined;
  // 只选了情绪时，情绪就是主标签；场景+情绪都选了才叠加计权
  const tag = sceneTag ?? moodTag ?? SCENE_TAGS[0];
  const mood = sceneTag ? moodTag : undefined;
  const date = opts.dateKey ?? todayKey();

  const ranked = (Object.values(PERFUMES) as Perfume[])
    .map((p) => ({ p, s: scoreOne(p, tag, mood, opts.budget) }))
    .sort((a, b) => (b.s - a.s) || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));

  const window = ranked.slice(0, 8);
  if (!window.length) return null;
  const seed = hashStr(`${date}|${tag.key}|${mood?.key ?? ""}|${opts.budget ?? "any"}`);
  const chosen = window[seed % window.length].p;

  const topNote = chosen.notes.top[0] ?? chosen.notes.heart[0] ?? "这层气息";
  const reason = (mood ?? tag).reason.replace("{note}", topNote);

  return {
    name: chosen.name,
    brand: chosen.brandCn || chosen.brand,
    priceRange: chosen.priceRange,
    notes: chosen.notes,
    intensity: chosen.intensity,
    longevity: chosen.longevity,
    reason,
    tagKey: tag.key,
    tagLabel: tag.label,
    moodKey: mood?.key,
    budget: opts.budget,
  };
}
