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
 *  - 文案只谈氛围与审美，不承诺功效，不碰医疗/财务/命理话术。
 *
 * ─── 2026-11-23：「不要做成固定映射」──────────────────────────
 *  上一版用 `hash(日期|标签|心情|预算) % 8` 在 top8 里取一支，看似随机，
 *  实际同一天同一组合永远同一支，而且只有 8 支轮得到、每个标签只有一句文案，
 *  用户看到的就是一张「标签 → 香水 + 固定说辞」的查表。现在改成：
 *   ① 候选窗口 top8 → top32，按分数**加权随机**（高分更可能，但中长尾有机会）；
 *   ② 种子加入 `seedKey`（组件传匿名 vid + 「换一支」计数），同一天也能换；
 *   ③ 最近推过的香只做**软降权**（权重 ×0.35），绝不排除；
 *   ④ 每个标签 3 条理由文案，按种子轮转，不再是一句模板套所有香。
 *  仍保证「同一种子完全可复现」（回归测试可锁），但不再有固定映射的观感。
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
  /** 未选中时的一句轻提示 */
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
  /** 理由文案池：按种子轮转，避免一个标签永远同一句套话 */
  reasons: readonly string[];
}

/** 现有场景标签（沿用 /discover 的场景语义，取用户点名的 4 个） */
export const SCENE_TAGS: PickTag[] = [
  {
    key: "solo", label: "独处", kind: "scene",
    hint: "只为自己，不必讨好",
    textures: { wood: 0.9, smoke: 0.5, powder: 0.3 }, temp: 0.15,
    intensity: -0.8, longevity: 0.3, dayNight: "any",
    reasons: [
      "独处时不必照顾谁的感受，{note} 的层次刚好留给自己慢慢闻。",
      "今天不用向谁交代，{note} 收得慢，适合一个人待着。",
      "把节奏交还给自己，{note} 这层气息不催人。",
    ],
  },
  {
    key: "date", label: "约会", kind: "scene",
    hint: "靠近时才闻得到",
    textures: { petal: 0.8, milk: 0.5, resin: 0.35 }, temp: 0.5,
    intensity: -0.2, longevity: 1.0, dayNight: "night",
    reasons: [
      "{note} 开场不争先，靠近时才浮出来，留香也够撑到散场。",
      "不必一进门就宣告存在，{note} 会在距离变近时慢慢显出来。",
      "留给两个人的距离，{note} 温温地跟在身后。",
    ],
  },
  {
    key: "office", label: "办公", kind: "scene",
    hint: "收敛克制，不打扰别人",
    textures: { green: 0.8, water: 0.6, petal: 0.2 }, temp: -0.3,
    intensity: -1.2, longevity: 0.2, dayNight: "day",
    reasons: [
      "{note} 清清爽爽，气味收在身侧，开会时也不会抢话。",
      "今天需要的是分寸感，{note} 不越界，也不缺席。",
      "把存在感调低一点，{note} 刚好够自己闻见。",
    ],
  },
  {
    key: "travel", label: "旅行", kind: "scene",
    hint: "清爽提神，扛得住折腾",
    textures: { fruit: 0.75, green: 0.7, water: 0.45 }, temp: -0.45,
    intensity: 0.6, longevity: 0.8, dayNight: "day",
    reasons: [
      "{note} 一开场就把人叫醒，路上换几个地方也还闻得见。",
      "行程会变，{note} 的清亮不用重新适应。",
      "轻装上路，{note} 不挑场合，走远了也还在。",
    ],
  },
];

/** 新增「小情绪」标签：只描述当下状态，不承诺任何改变 */
export const MOOD_TAGS: PickTag[] = [
  {
    key: "soothe", label: "想被安慰", kind: "mood",
    hint: "温软一点的氛围",
    textures: { milk: 1.0, powder: 0.6, petal: 0.4 }, temp: 0.7,
    intensity: -0.7, longevity: 0.4, dayNight: "any",
    reasons: [
      "想被接住的时候，{note} 这类温软的气息比浓香更让人舒缓。",
      "不必立刻好起来，{note} 先把呼吸放慢一点。",
      "给今天留一层软的，{note} 不追问，也不催促。",
    ],
  },
  {
    key: "invisible", label: "想隐身", kind: "mood",
    hint: "安静、不引人注意",
    textures: { water: 0.9, green: 0.65, powder: 0.4 }, temp: -0.4,
    intensity: -1.4, longevity: -0.2, dayNight: "any",
    reasons: [
      "{note} 很轻，几乎不宣告自己的存在，适合想安静一会儿的日子。",
      "今天不想被认出来，{note} 贴近皮肤，声音很低。",
      "把轮廓收起来，{note} 只留一点干净的余味。",
    ],
  },
  {
    key: "refresh", label: "想提神", kind: "mood",
    hint: "清亮、有精神",
    textures: { fruit: 0.9, green: 0.8, water: 0.5 }, temp: -0.6,
    intensity: 0.9, longevity: 0.3, dayNight: "day",
    reasons: [
      "{note} 的清亮先到，像把窗推开一条缝，人跟着醒过来。",
      "需要一点清醒的边界，{note} 来得干脆，不拖泥带水。",
      "困住的时候，{note} 先把空气换一遍。",
    ],
  },
  {
    key: "seen", label: "想被看见", kind: "mood",
    hint: "留一点记忆点",
    textures: { spice: 0.9, resin: 0.55, petal: 0.45 }, temp: 0.45,
    intensity: 1.1, longevity: 0.9, dayNight: "night",
    reasons: [
      "{note} 有棱角，进屋时会被人多问一句，正好留给想被看见的今天。",
      "想留下记忆点，{note} 不藏锋，转身之后还有余韵。",
      "今天不必收敛，{note} 会把存在感替你说出来。",
    ],
  },
  {
    key: "slow", label: "想慢下来", kind: "mood",
    hint: "不赶时间的节奏",
    textures: { wood: 0.85, smoke: 0.45, resin: 0.35 }, temp: 0.25,
    intensity: -0.5, longevity: 0.7, dayNight: "any",
    reasons: [
      "{note} 沉得慢，不催人，适合把今天过成一条长一点的路。",
      "不赶时间的话，{note} 的层次会一段一段自己展开。",
      "把日程留白，{note} 在慢下来的节奏里更清楚。",
    ],
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

/**
 * 把种子哈希雪崩成 [0,1)。
 * ⚠️ 纯 FNV 对「只差末尾一个数字」的种子几乎线性变化：实测 `v1|1`…`v1|12`
 * 全部挤在 0.37–0.43 与 0.75–0.77 两段，连换 12 次只能轮到 3 支香，
 * 又变成查表。这里补一层 murmur3 finalizer，让相邻种子彻底打散。
 */
function rand01(seed: string): number {
  let h = hashStr(seed);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Asia/Shanghai 日期键；复用同一套时区口径，避免第二份实现 */
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

/** 候选窗口：足够宽，才不会表现成「一个标签对应几支香」的查表 */
const CANDIDATE_WINDOW = 32;

/**
 * 按标签挑一支香。
 *
 * 同一种子完全可复现（测试可锁），但种子里加入了 `seedKey`
 * （组件传匿名 vid + 「换一支」计数），所以同一天同一标签也能换出不同的香。
 * `avoidNames` 只做软降权，绝不硬排除，守住项目「不硬过滤」的约定。
 */
export function pickScent(opts: {
  scene?: string;
  mood?: string;
  budget?: BudgetKey;
  dateKey?: string;
  /** 额外种子：匿名 vid、换一支计数等由调用方决定，数据层保持纯函数 */
  seedKey?: string;
  /** 最近推过的展示名，仅软降权 */
  avoidNames?: readonly string[];
}): ScentPick | null {
  const sceneTag = opts.scene ? findTag(opts.scene) : undefined;
  const moodTag = opts.mood ? findTag(opts.mood) : undefined;
  // 只选了情绪时，情绪就是主标签；场景+情绪都选了才叠加计权
  const tag = sceneTag ?? moodTag ?? SCENE_TAGS[0];
  const mood = sceneTag ? moodTag : undefined;
  const date = opts.dateKey ?? todayKey();
  const seed = `${date}|${tag.key}|${mood?.key ?? ""}|${opts.budget ?? "any"}|${opts.seedKey ?? ""}`;

  const ranked = (Object.values(PERFUMES) as Perfume[])
    .map((p) => ({ p, s: scoreOne(p, tag, mood, opts.budget) }))
    .sort((a, b) => (b.s - a.s) || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));

  const window = ranked.slice(0, CANDIDATE_WINDOW);
  if (!window.length) return null;

  const recent = new Set(opts.avoidNames ?? []);
  // ⚠️ 按**排名**线性降权，不按分数差加权：
  // 分数只负责圈定 top32（相关性），一旦用分差做权重，top1 常比第 32 名高几十分，
  // 会把概率几乎全吃掉（实测 12 次只轮到 3 支，又变回查表）。
  // 现在 14 → 3.2 线性递减，头名约 5% 概率，32 支都轮得到，高分仍略占优。
  // 最近推过的只把权重压到 35%，仍留在候选里（软降权 ≠ 硬过滤）。
  const weights = window.map(({ p }, i) =>
    Math.max(2, 14 - i * 0.35) * (recent.has(p.name) ? 0.35 : 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand01(seed) * total;
  let idx = window.length - 1;
  for (let i = 0; i < window.length; i++) {
    r -= weights[i];
    if (r <= 0) { idx = i; break; }
  }
  const chosen = window[idx].p;

  const topNote = chosen.notes.top[0] ?? chosen.notes.heart[0] ?? "这层气息";
  const pool = (mood ?? tag).reasons;
  // 文案种子也带上香名：换出不同香时更容易换到不同句式，避免连续撞同一句
  const reason = pool[Math.floor(rand01(`${seed}|reason|${chosen.name}`) * pool.length)].replace("{note}", topNote);

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
