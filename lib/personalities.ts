/**
 * 16 灵魂人格数据 + 问卷→结果数据桥接
 * 对应 PRD §7 人格命名表（v2 命名系统）
 *
 * 数据来源：
 * - 人格基础信息（name/mbtiAlias/tagline/description）：lib/data.ts → PERSONALITY_TYPES
 * - 香水推荐（3 档）：方案 B 代表性推荐（lib/matchPerfumes 的 getCalibratedRecommendations + inferArchetypeCal），不再用硬编码三香字段
 * - 雷达分值：lib/data.ts → PERSONALITY_TYPES[].radarScores
 * - 问卷写入 key：crushxiangjian_personality_id / radar_scores / path_labels
 *
 * v2 人格库（16 字一字不改）：
 *   暗流 / 荒岛 / 残温 / 裂岸 / 寒岭 / 极夜 / 砾迹 / 冲浪 /
 *   温砾 / 空号 / 冷砚 / 渊海 / 沉湾 / 霜冷 / 荒原 / 烬生
 */

import { PERSONALITY_TYPES, PERFUMES, type Perfume } from '@/lib/data';
import { getPerfumeProfile, getPerfumeProfile18D, cosineSimilarity18D, getCalibratedRecommendations, inferArchetypeCal, type ScentVector } from '@/lib/matchPerfumes';

export type Personality = {
  name: string;
  mbti: string;
  direction: string;
  tagline: string;
  description: string;
};

export const PERSONALITIES: readonly Personality[] = [
  { name: '暗流', mbti: '内向深度型',    direction: '克制的优雅（木质+玫瑰）',           tagline: '表面平静，内心自有深渊',           description: '你像深海，表面波澜不惊，底下藏着完整的宇宙。习惯独自消化情绪，却对真正重要的人毫无保留。' },
  { name: '荒岛', mbti: '自由探索型',    direction: '阳光活力（柑橘+无花果+海洋）',     tagline: '有光的地方，就是目的地',         description: '你是那种被丢到荒岛上，也能跟椰子树聊一下午的人。永远对世界保持好奇，随时准备出发。' },
  { name: '残温', mbti: '温暖守护型',    direction: '温暖舒缓（白花+橙花+麝香）',       tagline: '我的温度，恰好暖你一人',         description: '你有一种天然的安定感，坐在你旁边就让人觉得安心。不争不抢，却让身边的人变得更好。' },
  { name: '裂岸', mbti: '精准领袖型',    direction: '力量气场（乌木+檀香+琥珀）',       tagline: '方向若对，全力以赴',           description: '你天生有领袖气质，能在混乱中找到秩序，在迷雾中指明方向。目标感极强，从不废话。' },
  { name: '寒岭', mbti: '理性洞察型',    direction: '冷冽深邃（檀木+焚香+雪松）',       tagline: '想搞清楚世界的底层逻辑',     description: '你是那种会在凌晨三点研究一个哲学问题的人。逻辑极强，不喜欢废话，但对真正懂你的人极好。' },
  { name: '极夜', mbti: '极致追求型',    direction: '极致优雅（玫瑰+沉香+藏红花）',     tagline: '不做则已，做则极致',           description: '你对品质有极高的要求，不允许自己平庸。外表可能高冷，但内心燃烧着对完美的执念。' },
  { name: '砾迹', mbti: '可靠实务型',    direction: '稳重踏实（木质+香根草）',           tagline: '说到，便要做到',                 description: '你是团队最可靠的基石。守时、守信、务实，不说大话，永远在需要时出现。' },
  { name: '冲浪', mbti: '活力冒险型',    direction: '动感清新（柑橘+芳香+海盐）',       tagline: '人生一场，只管去体验',               description: '你是朋友圈里的活力源泉，永远在计划下一场冒险。乐观、积极，生活永远不缺新鲜事。' },
  { name: '温砾', mbti: '热情社交型',    direction: '温暖甜美（棉花+鼠尾草+柑橘）',     tagline: '愿把快乐，分你一半',           description: '你是朋友圈里的暖阳，热情好客，善于照顾每个人的情绪。容易满足，也容易感染他人。' },
  { name: '空号', mbti: '极简思考型',    direction: '极简冷感（Aesop+雪松+焚香）',      tagline: '少即是多，余即是乱',               description: '你追求极简和本质，对无意义的社交和物质有天然的抗拒。低调、深沉，喜欢有深度的对话。' },
  { name: '冷砚', mbti: '审美艺术型',    direction: '艺术优雅（晚香玉+鸢尾+玫瑰）',     tagline: '对美，自有标准',             description: '你有极高的审美品味，安静但有力量。不随大流，对品质和美感有近乎苛刻的要求。' },
  { name: '渊海', mbti: '战略深邃型',    direction: '深邃高阶（檀木33+玫瑰+皮革）',     tagline: '自有节奏，无需解释',             description: '你是长期主义者，不在乎短期波动。思维深邃，视野宏观，能在别人看不到的地方看到未来。' },
  { name: '沉湾', mbti: '细腻感受型',    direction: '文艺细腻（纸纹+玫瑰+紫罗兰）',     tagline: '你感受不到的，我都能感受',         description: '你对细节有超乎常人的感知力。敏感但不脆弱，能在别人忽略的地方，发现极致的美。' },
  { name: '霜冷', mbti: '沉稳可靠型',    direction: '清爽沉稳（雪松+薰衣草+木质）',     tagline: '该扛的，从不退缩',                 description: '你是那种让人放心把后背交给他的人。务实、可靠，默默承担，不邀功，不解释。' },
  { name: '荒原', mbti: '理想追寻型',    direction: '诗意自然（玫瑰+黑醋栗+木质）',     tagline: '内心有片旷野，无人到过',     description: '你有理想主义的火焰，不愿意妥协于现实。敏感、浪漫，永远在追寻某种更纯粹的东西。' },
  { name: '烬生', mbti: '温柔力量型',    direction: '精致舒缓（棉麻+玫瑰+白茶）',       tagline: '柔软是表，烈火在内',               description: '你是那种让人越相处越喜欢的人才。外表温柔得体，内心有自己的坚持，不张扬但有力量。' },
] as const;

/** 人格名 → 英文 ID 映射（对应 data.ts PERSONALITY_TYPES） */
export const PERSONALITY_ID_MAP: Record<string, string> = {
  暗流: 'anliu',
  荒岛: 'huangdao',
  残温: 'canwen',
  裂岸: 'liean',
  寒岭: 'hanling',
  极夜: 'jiaye',
  砾迹: 'licheng',
  冲浪: 'chonglang',
  温砾: 'wenli',
  空号: 'konghao',
  冷砚: 'lengyan',
  渊海: 'yuanhai',
  沉湾: 'chenwan',
  霜冷: 'shuangleng',
  荒原: 'huangyuan',
  烬生: 'jinsheng',
};

/** 反向映射：英文 ID → 中文人格名（用于 localStorage 存拼音 ID 时还原显示） */
export const PERSONALITY_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PERSONALITY_ID_MAP).map(([name, id]) => [id, name]),
);

// ─────────────────────────────────────────
// 香水推荐（来自 data.ts，懒导入避免循环）
// ─────────────────────────────────────────

/** 结构化三调 */
export type NotesStructured = {
  top: string[];
  heart: string[];
  base: string[];
};

export type Recommendation = {
  name: string;
  brand: string;
  brandCn: string;
  notes: string;                      // 扁平字符串（向后兼容）
  notesStructured: NotesStructured;    // 结构化三调（推荐使用）
  quote: string;
  tier: 'premium' | 'budget';      // 真实数据档位（premium = 原 signature+advanced 合并）
  role: 'signature' | 'advanced' | 'budget';      // 展示角色（本命香/进阶香/尝试香）
  match: number;
  priceRange: string;                  // 价格区间，如 "¥800-1200/50ml"
  intensity: number;                   // 扩散力 1-5
  longevity: number;                   // 留香 1-5
};

/**
 * 根据人格名获取香水推荐（3 档）+ 匹配度（改法 B：统一走方案 B 代表性推荐）
 *
 * 改法 B 要求「首屏/无校准数据也直接走方案 B」（不做固定硬编码映射）。
 * 这里用原型固有字段确定性推导代表性校准输入（inferArchetypeCal），
 * 再以该原型自身雷达向量跑 getCalibratedRecommendations，
 * 输出稳定、可复现的「代表性三香」（本命香/进阶香/尝试香）。
 * 与用户校准后的动态推荐共享同一套算法与全局平价去重分配表。
 */
export function getRecommendations(personalityName: string): readonly Recommendation[] {
  const id = PERSONALITY_ID_MAP[personalityName];
  const type = PERSONALITY_TYPES.find((t) => t.id === id);
  if (!type) return SAMPLE_RECOMMENDATIONS;

  try {
    const radarRaw = getRadarScores(personalityName); // 中文键 0-1
    const radarVector = {
      woody: radarRaw['木质'],
      fresh: radarRaw['清新'],
      oriental: radarRaw['东方'],
      gourmand: radarRaw['美食'],
      citrus: radarRaw['柑橘'],
      floral: radarRaw['花香'],
    };
    const { calChoices, pathLabels } = inferArchetypeCal(type);
    // canonical/原型视图：用按 16 原型去重的尝试香分配表，避免 16 原型共用尝试香
    const calibrated = getCalibratedRecommendations(radarVector, calChoices, pathLabels, id, true);
    if (calibrated.length === 0) return SAMPLE_RECOMMENDATIONS;
    return calibrated.map((r) => ({
      name: r.name,
      brand: r.brand,
      brandCn: r.brandCn,
      notes: r.notes,
      notesStructured: r.notesStructured,
      quote: r.quote,
      tier: r.tier,
      role: r.role,
      match: r.match,
      priceRange: r.priceRange,
      intensity: r.intensity,
      longevity: r.longevity,
    })) as readonly Recommendation[];
  } catch {
    return SAMPLE_RECOMMENDATIONS;
  }
}

/**
 * 校准匹配推荐：优先读取 localStorage 中的校准答案，从 225 支香水库动态推荐
 * @returns 校准推荐结果，若无校准数据则退回固定映射
 */
/** 动态推荐缓存 schema 版本（Recommendation shape 变化时 +1，老缓存自动失效）
 * v3：本命香 match 改为 85-95 映射值（v2 缓存存的是 raw 分，需失效） */
const DYNAMIC_RECS_SCHEMA_VERSION = 3;

/**
 * 同步读取动态推荐缓存（跨刷新锁定同一批 3 支）
 * - 仅当本地有完整 Recommendation[] 时返回；schema 不匹配或缺字段一律返回 null
 * - 与 getDynamicRecommendations 形成 fallback 链
 */
export function getCachedDynamicRecommendations(personalityName: string): readonly Recommendation[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DYNAMIC_RECS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; personalityName?: string; items?: readonly Recommendation[] };
    if (parsed.version !== DYNAMIC_RECS_SCHEMA_VERSION) return null;
    if (parsed.personalityName !== personalityName) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    // 校验每个 item 关键字段，避免老 schema 残留
    const ok = parsed.items.every((it: any) =>
      typeof it?.name === 'string' && typeof it?.tier === 'string' && typeof it?.match === 'number'
    );
    return ok ? parsed.items : null;
  } catch {
    return null;
  }
}

export async function getDynamicRecommendations(personalityName: string): Promise<readonly Recommendation[]> {
  if (typeof window === 'undefined') return getRecommendations(personalityName);

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CALIBRATION_CHOICES);
    if (!raw) return getRecommendations(personalityName);

    const calChoices: string[] = JSON.parse(raw);
    if (calChoices.length < 3) return getRecommendations(personalityName);

    const radarRaw = localStorage.getItem(STORAGE_KEYS.RADAR_SCORES);
    const radarScores: Record<string, number> = radarRaw ? JSON.parse(radarRaw) : {};
    const pathRaw = localStorage.getItem(STORAGE_KEYS.PATH_LABELS);
    const pathLabels: string[] = pathRaw ? JSON.parse(pathRaw) : [];

    // 转换 radarScores 从 0-100 → 0-1
    const radarVector = {
      floral: (radarScores.floral ?? 50) / 100,
      woody: (radarScores.woody ?? 50) / 100,
      fresh: (radarScores.fresh ?? 50) / 100,
      oriental: (radarScores.oriental ?? 50) / 100,
      citrus: (radarScores.citrus ?? 50) / 100,
      gourmand: (radarScores.gourmand ?? 50) / 100,
    };

    // 动态加载 matchPerfumes 模块（避免服务端导入客户端代码）
    const { getCalibratedRecommendations } = await import('@/lib/matchPerfumes');
    // 传入所属原型 id，启用「平价档全局去重分配表」（16 原型各拿一支互不重复的尝试香）
    const archetypeId = PERSONALITY_ID_MAP[personalityName];
    const calibrated = getCalibratedRecommendations(radarVector, calChoices, pathLabels, archetypeId);

    if (calibrated.length === 0) return getRecommendations(personalityName);

    const mapped = calibrated.map((r) => ({
      name: r.name,
      brand: r.brand,
      brandCn: r.brandCn,
      notes: r.notes,
      notesStructured: r.notesStructured,
      quote: r.quote,
      tier: r.tier,
      role: r.role,
      match: r.match,
      priceRange: r.priceRange,
      intensity: r.intensity,
      longevity: r.longevity,
    })) as readonly Recommendation[];

    // 跨刷新锁定同一批 3 支：写入 localStorage 缓存（仅在成功路径写，fallback 不写）
    try {
      localStorage.setItem(
        STORAGE_KEYS.DYNAMIC_RECS,
        JSON.stringify({
          version: DYNAMIC_RECS_SCHEMA_VERSION,
          personalityName,
          items: mapped,
        }),
      );
    } catch {
      // quota 满 / SSR 写入失败都不影响本次结果
    }

    return mapped;
  } catch {
    return getRecommendations(personalityName);
  }
}

/**
 * 根据人格名获取雷达分值（0~1）
 * 优先读 data.ts，降级为本文件示例
 */
export function getRadarScores(personalityName: string): Record<RadarDim, number> {
  const id = PERSONALITY_ID_MAP[personalityName];
  if (!id) return SAMPLE_RADAR;

  try {
    const type = PERSONALITY_TYPES.find((t) => t.id === id);
    if (!type) return SAMPLE_RADAR;
    const raw = type.radarScores;
    return {
      木质: raw.woody / 100,
      清新: raw.fresh / 100,
      东方: raw.oriental / 100,
      美食: raw.gourmand / 100,
      柑橘: raw.citrus / 100,
      花香: raw.floral / 100,
    };
  } catch {
    return SAMPLE_RADAR;
  }
}

/** 根据人格名称获取人格对象（基础信息）*/
export const getPersonality = (name: string): Personality => {
  const found = PERSONALITIES.find((p) => p.name === name);
  return found ?? (PERSONALITIES[0] as Personality);
};

// §4.3 六维中文标签（顺序固定：上=木质，顺时针）
export const RADAR_DIMS = ['木质', '清新', '东方', '美食', '柑橘', '花香'] as const;
export type RadarDim = (typeof RADAR_DIMS)[number];

// 展示层命名映射：内部 中文维度键 → 用户可见维度名（去"调"、方向更直观）
// 内部坐标体系（RADAR_DIMS / RadarDim / 英文键 / 色板键 / 路由解析键）一律不动，仅此处改展示文案。
export const RADAR_DIM_LABELS: Record<string, string> = {
  木质: '木质',
  清新: '水生',
  东方: '东方',
  美食: '馥奇',
  柑橘: '柑橘',
  花香: '花香',
};

// 示例：暗流 的六维分值（0~1）（降级兜底）
export const SAMPLE_RADAR: Record<RadarDim, number> = {
  木质: 0.9,
  清新: 0.4,
  东方: 0.8,
  美食: 0.1,
  柑橘: 0.2,
  花香: 0.75,
};

// 示例香水推荐（降级兜底）
export const SAMPLE_RECOMMENDATIONS: readonly Recommendation[] = [
  {
    name: 'Tom Ford Oud Wood',
    brand: 'Tom Ford',
    brandCn: '汤姆·福特',
    notes: '沉香 / 檀木 / 零陵香豆',
    notesStructured: { top: ['小豆蔻'], heart: ['沉香', '檀木'], base: ['零陵香豆', '琥珀'] },
    quote: '「它和你一样，初见是距离，再闻是深度。」',
    tier: 'premium',
    role: 'signature',
    match: 93,
    priceRange: '¥1500-2200/50ml',
    intensity: 4,
    longevity: 5,
  },
  {
    name: 'Le Labo Santal 33',
    brand: 'Le Labo',
    brandCn: '勒拉博',
    notes: '檀香 / 纸莎草 / 皮革',
    notesStructured: { top: ['小豆蔻'], heart: ['檀香', '纸莎草'], base: ['皮革', '雪松'] },
    quote: '「安静的人，往往最有故事。」',
    tier: 'premium',
    role: 'advanced',
    match: 82,
    priceRange: '¥1200-1800/50ml',
    intensity: 3,
    longevity: 4,
  },
  {
    name: 'Byredo Super Cedar',
    brand: 'Byredo',
    brandCn: '百瑞德',
    notes: '雪松 / 玫瑰 / 岩兰草',
    notesStructured: { top: ['雪松'], heart: ['玫瑰'], base: ['岩兰草', '麝香'] },
    quote: '「你不必热烈，也足够被记住。」',
    tier: 'premium',
    role: 'advanced',
    match: 68,
    priceRange: '¥1400-1600/50ml',
    intensity: 2,
    longevity: 3,
  },
] as const;

// ─────────────────────────────────────────
// localStorage 读取工具（结果页专用）
// ─────────────────────────────────────────

/** localStorage key 常量 */
export const STORAGE_KEYS = {
  PERSONALITY_ID: 'crushxiangjian_personality_id',
  RADAR_SCORES: 'crushxiangjian_radar_scores',
  PATH_LABELS: 'crushxiangjian_path_labels',
  CALIBRATION_CHOICES: 'crushxiangjian_calibration_choices',
  /** 动态推荐 3 支缓存（跨刷新保留，避免重开后换成另一批） */
  DYNAMIC_RECS: 'crushxiangjian_dynamic_recs',
} as const;

/** 英文雷达 key → 中文 key（0-100 → 0-1）*/
export const RADAR_KEY_MAP: Record<string, RadarDim> = {
  woody: '木质',
  fresh: '清新',
  oriental: '东方',
  gourmand: '美食',
  citrus: '柑橘',
  floral: '花香',
};

/** 读取人格 ID，转换为人格名 */
export function getPersonalityNameFromStorage(): string | null {
  const id = localStorage.getItem(STORAGE_KEYS.PERSONALITY_ID);
  if (!id) return null;
  const entry = Object.entries(PERSONALITY_ID_MAP).find(([, v]) => v === id);
  return entry ? entry[0] : null;
}

/**
 * 读取 localStorage 雷达分值（英文 key → 中文 key，0-100 → 0-1）
 * 返回 null 表示未找到
 */
export function getRadarScoresFromStorage(): Record<RadarDim, number> | null {
  const raw = localStorage.getItem(STORAGE_KEYS.RADAR_SCORES);
  if (!raw) return null;
  try {
    const parsed: Record<string, number> = JSON.parse(raw);
    const result: Partial<Record<RadarDim, number>> = {};
    for (const [en, cn] of Object.entries(RADAR_KEY_MAP)) {
      if (en in parsed) result[cn] = parsed[en] / 100;
    }
    for (const dim of RADAR_DIMS) {
      if (!(dim in result)) result[dim] = 0;
    }
    return result as Record<RadarDim, number>;
  } catch {
    return null;
  }
}

/** 读取路径标签列表（兼容旧的字符串格式 + 新的 {label, emoji} 对象格式） */
export function getPathLabelsFromStorage(): string[] {
  const raw = localStorage.getItem(STORAGE_KEYS.PATH_LABELS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 若是 {label, emoji} 对象数组，提取 label
    return parsed.map((x: unknown) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && "label" in x) return String((x as { label: unknown }).label);
      return "";
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────
// 付费解锁内容（P0/P1）数据层
// ─────────────────────────────────────────

/** 隐藏人格面（解锁内容 ③） */
export type HiddenFace = { title: string; content: string; traits: string[] };
/** 气味底稿 · 香调金字塔（解锁内容 ⑤） */
export type ScentBlueprint = { top: string; heart: string; base: string; signature: string };

const HIDDEN_FACES: Record<string, HiddenFace> = {
  暗流: { title: '表象之下的你', content: '你习惯保持疏离与克制，但独处时会被深邃、忧郁的美感牢牢吸住——那是对真实自我的忠诚，不是矫情。', traits: ['内省型敏感', '审美洁癖', '情感延迟'] },
  荒岛: { title: '表象之下的你', content: '你看似永远在出发，其实最怕被困在重复的日子里。自由是你的铠甲，也是你的软肋。', traits: ['表层乐观', '深层不安', '反抗路径'] },
  残温: { title: '表象之下的你', content: '你给所有人的温暖，有时是在填补自己没被接住的时刻。温柔，是你主动选的铠甲。', traits: ['利他消耗', '边界模糊', '渴被照顾'] },
  裂岸: { title: '表象之下的你', content: '你指挥若定，是因为害怕一旦松手就没人接。控制欲背后，是被忽视过的童年。', traits: ['责任过载', '表达障碍', '回避脆弱'] },
  寒岭: { title: '表象之下的你', content: '你用逻辑筑墙，是因为情绪一旦决堤就收不回。理性，是你允许的唯一的失控出口。', traits: ['情感隔离', '深夜涌现', '智性恋'] },
  极夜: { title: '表象之下的你', content: '你对完美的执念，是对“平庸被看见”的恐惧。极致，是你对自己的温柔暴力。', traits: ['高标自缚', '细节偏执', '渴求赞许'] },
  砾迹: { title: '表象之下的你', content: '你是最可靠的基石，却很少被人问“你还好吗”。务实，是你藏起疲惫的方式。', traits: ['自我压缩', '承诺强迫', '情绪滞后'] },
  冲浪: { title: '表象之下的你', content: '你不停换场景，是因为安静下来就要面对那个不想回答的问题。活力，是你的避难所。', traits: ['刺激依赖', '回避沉静', '表层联结'] },
  温砾: { title: '表象之下的你', content: '你照顾每个人的情绪，自己的却总排最后。热情，是你不被抛下的方式。', traits: ['讨好倾向', '情绪吸收', '独处恐惧'] },
  空号: { title: '表象之下的你', content: '你删掉多余的人和事，是因为曾被打扰得太久。极简，是你重建的秩序。', traits: ['社交筛选', '深度饥渴', '表层冷漠'] },
  冷砚: { title: '表象之下的你', content: '你对美的苛刻，是对“将就”的生理性排斥。审美，是你和世界保持距离的方式。', traits: ['完美凝视', '疏离鉴赏', '细节信徒'] },
  渊海: { title: '表象之下的你', content: '你不解释节奏，是因为多数人听不懂。深邃，是你的保护色，也是孤独的来源。', traits: ['延迟满足', '表达吝啬', '宏观孤独'] },
  沉湾: { title: '表象之下的你', content: '你感知力太强，常常替别人承受了情绪。细腻，是你的天赋，也是你的重。', traits: ['高敏体质', '共情过载', '隐性忧伤'] },
  霜冷: { title: '表象之下的你', content: '你默默承担，是因为怕成为别人的负担。可靠，是你不敢卸下的壳。', traits: ['责任内化', '求助困难', '情绪冷藏'] },
  荒原: { title: '表象之下的你', content: '你追的理想，是童年被许诺却未到的远方。浪漫，是你对现实的温柔叛逃。', traits: ['理想黏着', '现实眩晕', '诗意自留'] },
  烬生: { title: '表象之下的你', content: '你温柔得体，是怕冲突撕破关系。内心的火，只留给真正懂的人。', traits: ['冲突回避', '内核炽热', '选择敞亮'] },
};

const SCENT_BLUEPRINTS: Record<string, ScentBlueprint> = {
  暗流: { top: '佛手柑 · 绿茶', heart: '玫瑰 · 鸢尾', base: '雪松 · 檀木 · 白麝香', signature: '温暖的疏离' },
  荒岛: { top: '柑橘 · 海盐', heart: '无花果 · 橙花', base: '雪松 · 龙涎香', signature: '明亮的放逐' },
  残温: { top: '橙花 · 梨', heart: '白茉莉 · 鸢尾', base: '白麝香 · 香草', signature: '软壳里的火' },
  裂岸: { top: '黑胡椒 · 佛手柑', heart: '檀香 · 皮革', base: '乌木 · 琥珀', signature: '掌纹里的雷' },
  寒岭: { top: '薄荷 · 杜松', heart: '焚香 · 丝柏', base: '雪松 · 岩兰草', signature: '冷焰' },
  极夜: { top: '粉红胡椒 · 覆盆子', heart: '大马士革玫瑰 · 藏红花', base: '沉香 · 广藿香', signature: '锐光' },
  砾迹: { top: '葡萄柚 · 薄荷', heart: '香根草 · 鼠尾草', base: '木质 · 苔藓', signature: '沉石' },
  冲浪: { top: '柠檬 · 海盐', heart: '芳香草本 · 橙花', base: '雪松 · 龙涎香', signature: '浪尖' },
  温砾: { top: '柑橘 · 荔枝', heart: '棉花 · 鼠尾草', base: '麝香 · 檀木', signature: '暖流' },
  空号: { top: '佛手柑 · 青草', heart: '雪松 · 纸莎草', base: '焚香 · 檀木', signature: '留白' },
  冷砚: { top: '梨 · 紫罗兰叶', heart: '晚香玉 · 鸢尾', base: '玫瑰 · 檀木', signature: '冷釉' },
  渊海: { top: '佛手柑 · 粉红胡椒', heart: '玫瑰 · 皮革', base: '檀木 · 烟草', signature: '深蓝' },
  沉湾: { top: '紫罗兰 · 梨', heart: '玫瑰 · 纸莎草', base: '檀木 · 麝香', signature: '静湾' },
  霜冷: { top: '薰衣草 · 薄荷', heart: '雪松 · 鼠尾草', base: '木质 · 琥珀', signature: '霜刃' },
  荒原: { top: '黑醋栗 · 佛手柑', heart: '玫瑰 · 天竺葵', base: '木质 · 香草', signature: '旷野' },
  烬生: { top: '白茶 · 荔枝', heart: '玫瑰 · 棉麻', base: '檀木 · 麝香', signature: '余烬' },
};

export type ScentAdvice = {
  explore1: string; explore2: string;
  firstMeeting: string; intimateRelation: string;
  relationAdvice: string;
  dating: string; office: string; travel: string;
};

const SCENT_ADVICE: Record<string, ScentAdvice> = {
  暗流: { explore1: '加一点琥珀，让疏离感多一层温度', explore2: '试试皮革调，为内敛增加冲突的力度',
    firstMeeting: '佛手柑开场，让人放松；檀木收尾，留一点距离感',
    intimateRelation: '白麝香贴肤，是你的温柔只给特定的人',
    relationAdvice: '你的香气签名是「温暖的疏离」——不急着被读懂。前调清冽拉开距离，后调温润像慢慢卸下的壳。',
    dating: '靠近时才闻到的后调，让人想走近你的安静',
    office: '薄涂在手腕内侧，开会时闻到自己才安心',
    travel: '随身带一支，陌生酒店房间被你的气息覆盖' },
  荒岛: { explore1: '加一点无花果叶，让明亮多一些层次', explore2: '试试东方调，为自由的灵魂锚定一个方向',
    firstMeeting: '海盐开场，像一阵风；柑橘接住，阳光不刺眼',
    intimateRelation: '无花果的奶香，是你偶尔停下来的温柔',
    relationAdvice: '你的香气签名是「明亮的放逐」——像永远在出发。选一支让人想追上去的香，留一个让人想回来的尾调。',
    dating: '海盐开场像拥抱，柑橘接住他的目光',
    office: '明亮但不刺眼，在工位上像一阵穿堂风',
    travel: '海边日出时喷，让风成为你的香水' },
  残温: { explore1: '加一点雪松，让温柔长出骨骼', explore2: '试试烟熏调，露出壳里那团火',
    firstMeeting: '梨的清甜开场，让人想靠近；白麝香收尾，不打扰',
    intimateRelation: '香草贴肤，是你不需要说出口的暖',
    relationAdvice: '你的香气签名是「软壳里的火」——温柔是壳，底下在烧。让别人闻到你壳上的甜，只有懂你的人闻到底下的余温。',
    dating: '香草贴肤，他闻到的不是香水，是你的余温',
    office: '梨的清甜，让同事觉得和你相处很放松',
    travel: '长途飞行时必备，缓解不适应的水土' },
  裂岸: { explore1: '加一点广藿香，让力量多一层深沉', explore2: '试试柑橘调，偶尔也允许自己不紧绷',
    firstMeeting: '黑胡椒开场，快准狠；檀木收尾，沉稳但有压迫感',
    intimateRelation: '皮革贴肤，是你只对一个人卸下的铠甲',
    relationAdvice: '你的香气签名是「掌纹里的雷」——掌控全局的人，偶尔也让香气替你松一口气。',
    dating: '黑胡椒开场，前三秒让他记住你的锋利',
    office: '檀木收尾，开会不抢话但压得住场',
    travel: '出差谈判时喷，沉稳的木质调最不掉价' },
  寒岭: { explore1: '加一点焚香，让冷焰烧得更静', explore2: '试试花香调，让理性偶尔被感性入侵',
    firstMeeting: '薄荷开场，清醒但疏远；雪松收尾，干净利落',
    intimateRelation: '岩兰草贴肤，是你埋得很深但真实存在的那团火',
    relationAdvice: '你的香气签名是「冷焰」——冷在外面，烧在里面。不用急着热起来，低温的人最耐读。',
    dating: '薄荷开场打破距离，雪松留一个想靠近的尾',
    office: '冷调克制，开会时闻到自己不被打扰',
    travel: '在雪山的清晨喷，焚香调与松林互文' },
  极夜: { explore1: '加一点皮革，让锐利多一层粗粝', explore2: '试试木质调，给你的锋利找一个底座',
    firstMeeting: '粉红胡椒开场，一击入魂；沉香收尾，留一个悬念',
    intimateRelation: '大马士革玫瑰贴肤，是你的完美主义终于允许一丝柔软',
    relationAdvice: '你的香气签名是「锐光」——像刀刃上的光，锋利也孤独。让别人先被刺痛，再被你迷住。',
    dating: '粉红胡椒一击入魂，沉香让他记住你很久',
    office: '锐利但不刺伤，留一点想像空间',
    travel: '跨时区飞行时必备，气味是穿越时区的安全感' },
  砾迹: { explore1: '加一点海盐，让沉稳透出一丝呼吸', explore2: '试试柑橘调，让基石偶尔轻快一次',
    firstMeeting: '葡萄柚开场，清爽舒服；苔藓收尾，可靠但不会太过',
    intimateRelation: '香根草贴肤，是你最深处的那份安全感',
    relationAdvice: '你的香气签名是「沉石」——被所有人倚靠的那一块。偶尔也让香气替你轻一点，不那么可靠也没关系。',
    dating: '可靠但不出格，让他闻到稳定的存在感',
    office: '葡萄柚开场，开会时显得清新但不轻浮',
    travel: '熟悉的苔藓气息，让酒店房间一秒变家' },
  冲浪: { explore1: '加一点广藿香，让浪花也有海底的深度', explore2: '试试东方调，为不停变换的节奏添一个锚点',
    firstMeeting: '柠檬开场，劈头盖脸的阳光；龙涎香收尾，留一点想象',
    intimateRelation: '橙花贴肤，是你停下来才让人看见的柔软',
    relationAdvice: '你的香气签名是「浪尖」——永远在高处，永远在变。选一支让人想跟你一起出海的香，别太快散。',
    dating: '阳光的人自带流量，柠檬开场让他移不开眼',
    office: '清爽不沉闷，开会时显得有活力',
    travel: '海边必备，浪花打在身上有你的味道' },
  温砾: { explore1: '加一点焚香，让温暖多一层神秘', explore2: '试试柑橘调，为别人的避风港添一点俏皮',
    firstMeeting: '柑橘开场，像一声招呼；麝香收尾，让人想多待一会',
    intimateRelation: '棉花贴肤，是你让人想沉下去的那种暖',
    relationAdvice: '你的香气签名是「暖流」——所有人的情绪避风港。偶尔也为自己喷一下，暖自己一回。',
    dating: '柑橘开场像拥抱，麝香收尾像一直牵着',
    office: '暖棉是同事的能量饮料，让整组人状态在线',
    travel: '陌生城市里，让自己闻起来像在家里' },
  空号: { explore1: '加一点琥珀，让留白填进温度', explore2: '试试皮革调，给极简的灵魂一点不妥协的质感',
    firstMeeting: '佛手柑开场，干净利落；焚香收尾，不多说一个字',
    intimateRelation: '纸莎草贴肤，是你极少允许别人触碰的内心手稿',
    relationAdvice: '你的香气签名是「留白」——删掉多余的东西，才有空间放真正重要的。让别人在你的留白里找到自己的答案。',
    dating: '话少就让香气说话，焚香留个余韵让人想了解',
    office: '极简不打扰，干净的气息是你的边界感',
    travel: '佛手柑开场，陌生环境里给自己一个熟悉的起点' },
  冷砚: { explore1: '加一点檀木，让冷釉透出底下的温度', explore2: '试试皮革调，为完美的表面添一道裂痕',
    firstMeeting: '梨开场，清冷但不拒人；鸢尾收尾，优雅但保持距离',
    intimateRelation: '晚香玉贴肤，是你只给少数人看的繁盛',
    relationAdvice: '你的香气签名是「冷釉」——美得疏离，美得精准。让别人先被你拒之门外，再被你邀请进屋。',
    dating: '冷调开场让人想了解，紫罗兰收尾留个钩子',
    office: '优雅但不刻意，开会时像穿了一件好衣服',
    travel: '出差高级餐厅必备，不输环境又有自己的气场' },
  渊海: { explore1: '加一点海洋调，让深沉翻出浪花', explore2: '试试柑橘调，偶尔也让大海变浅、变亮',
    firstMeeting: '佛手柑开场，从容；烟草收尾，留一个让人想很久的尾调',
    intimateRelation: '皮革贴肤，是你最深处的执拗和柔软混在一起',
    relationAdvice: '你的香气签名是「深蓝」——看得远的人，更需要让人看见。选一支有穿透力的香，别让深度变成距离。',
    dating: '皮革开场，沉稳里有故事，烟草留尾',
    office: '深度让人信服，开会时显得有阅历',
    travel: '深海调配山林/草原，不挑目的地都合适' },
  沉湾: { explore1: '加一点海盐，让静谧泛起涟漪', explore2: '试试木质调，为敏感的心建一个不被干扰的空间',
    firstMeeting: '紫罗兰开场，轻柔；麝香收尾，像被轻轻揽住',
    intimateRelation: '纸莎草贴肤，是你敏锐感知力最温柔的那一层',
    relationAdvice: '你的香气签名是「静湾」——细腻是一种天赋，不用怕被读到。选一支内敛但有层次的香，让懂的人慢慢游进来。',
    dating: '紫罗兰贴肤，他闻到的不是香水是你',
    office: '柔和但有骨架，开会时不强势但有分量',
    travel: '敏感体质的救星，让陌生环境有熟悉的拥抱感' },
  霜冷: { explore1: '加一点檀香，让冷刃多一层温润', explore2: '试试美食调，给永远绷着的自己一块糖',
    firstMeeting: '薰衣草开场，清爽直接；琥珀收尾，不解释但可靠',
    intimateRelation: '雪松贴肤，是你把软肋藏得最深的地方',
    relationAdvice: '你的香气签名是「霜刃」——沉默的锋利，最容易被忽视。偶尔也让自己闻起来不那么硬，把刃口朝向自己就好。',
    dating: '薰衣草开场直接，琥珀收尾留温度',
    office: '克制不张扬，开会时闻到自己就稳了',
    travel: '陌生环境里给自己一个熟悉的锚点' },
  荒原: { explore1: '加一点雪松，让旷野有边界', explore2: '试试焚香调，为理想主义添一点仪式感',
    firstMeeting: '黑醋栗开场，像远方的召唤；香草收尾，让你记得回家的路',
    intimateRelation: '天竺葵贴肤，是你浪漫主义最私密的那面',
    relationAdvice: '你的香气签名是「旷野」——你追的远方，在路上。选一支有风感的香，让别人也想跟你一起流浪。',
    dating: '黑醋栗开场，远方的召唤感让他想靠近',
    office: '风感的香，开会时显得有远方和故事',
    travel: '灵魂契合度，旅途中带着它有归属感' },
  烬生: { explore1: '加一点焚香，让余烬重新烧起来', explore2: '试试木质调，为温柔的内核找一个更稳的底座',
    firstMeeting: '白茶开场，清润如玉；麝香收尾，像一场有礼貌的告别',
    intimateRelation: '荔枝贴肤，是你藏得最深的甜',
    relationAdvice: '你的香气签名是「余烬」——温柔是外衣，底下的火只给懂的人。不用急着亮给全世界看，你的温度有人会懂。',
    dating: '白茶开场清润，麝香收尾像有礼貌的告别',
    office: '温和有立场，开会不抢话但有分量',
    travel: '陌生环境里，让自己闻起来像回家' },
};

const HIDDEN_FACE_FALLBACK: HiddenFace = HIDDEN_FACES['暗流'];
const SCENT_BLUEPRINT_FALLBACK: ScentBlueprint = SCENT_BLUEPRINTS['暗流'];

export function getHiddenFace(name: string): HiddenFace {
  return HIDDEN_FACES[name] ?? HIDDEN_FACE_FALLBACK;
}
export function getScentBlueprint(name: string): ScentBlueprint {
  return SCENT_BLUEPRINTS[name] ?? SCENT_BLUEPRINT_FALLBACK;
}
export function getScentPhilosophy(name: string): string {
  const type = PERSONALITY_TYPES.find((t) => t.name === name);
  return type?.matchingReport.scentPhilosophy ?? PERSONALITY_TYPES[0].matchingReport.scentPhilosophy;
}
export function getScentAdvice(name: string): ScentAdvice {
  return SCENT_ADVICE[name] ?? SCENT_ADVICE['暗流'];
}

/** 本命香完整档案（解锁内容 ②）：从推荐香水程序化派生前/中/后调 */
export type PerfumeDetail = {
  name: string; brand: string; brandCn: string; tier: 'premium' | 'budget';
  role: 'signature' | 'advanced' | 'budget';
  top: string[]; heart: string[]; base: string[];
  lasting: string; lastingPct: number; scene: string; quote: string;
  match: number;
  priceRange: string;
  intensity: number;
  longevity: number;
};

export const TIER_META: Record<'premium' | 'budget', { lasting: string; lastingPct: number; scene: string }> = {
  premium: { lasting: '6–10 小时', lastingPct: 85, scene: '重要场合 · 通勤日常' },
  budget: { lasting: '4–6 小时', lastingPct: 50, scene: '周末 · 轻松社交' },
};

function splitNotes(notes: string): { top: string; heart: string; base: string } {
  const parts = notes.split(' / ').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { top: '—', heart: '—', base: '—' };
  if (parts.length === 1) return { top: parts[0], heart: parts[0], base: parts[0] };
  const top = parts[0];
  const base = parts[parts.length - 1];
  const heart = parts.slice(1, parts.length - 1).join(' · ') || parts[0];
  return { top, heart, base };
}

export function getPerfumeDetails(name: string): PerfumeDetail[] {
  const recs = getRecommendations(name);
  return recs.map((r) => {
    const meta = TIER_META[r.tier];
    return {
      name: r.name, brand: r.brand, brandCn: r.brandCn, tier: r.tier, role: r.role,
      top: r.notesStructured.top, heart: r.notesStructured.heart, base: r.notesStructured.base,
      lasting: meta.lasting, lastingPct: meta.lastingPct, scene: meta.scene, quote: r.quote,
      match: r.match,
      priceRange: r.priceRange,
      intensity: r.intensity,
      longevity: r.longevity,
    };
  });
}

/** 反差香（解锁内容 ④）：全量香水库中，与用户雷达余弦最低的那支（不是你，但值得一试） */
export type ContrastScent = { name: string; brand: string; notes: string; why: string };

function cosineDistance(a: { [k: string]: number }, b: { [k: string]: number }): number {
  let dot = 0, na = 0, nb = 0;
  for (const dim of RADAR_DIMS) {
    dot += a[dim] * b[dim];
    na += a[dim] * a[dim];
    nb += b[dim] * b[dim];
  }
  if (na === 0 || nb === 0) return 1;
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 品牌名显示：brandCn 看起来是「不合理的乱码音译」时回退到英文 brand（防御性兜底） */
export function brandLabel(p: { brand?: string; brandCn?: string }): string {
  const cn = (p.brandCn || "").trim();
  const en = (p.brand || "").trim();
  if (!cn) return en;
  // 1. brandCn 完全等于 brand（说明没翻译）→ 直接用 brand
  if (cn.toLowerCase() === en.toLowerCase()) return en;
  // 2. brandCn 中文占比 < 40%（疑似乱码）→ 回退 brand
  const chineseChars = (cn.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseChars / cn.length < 0.4) return en;
  // 3. 含明确乱码音译词 → 回退 brand
  if (/拜最|拜近|佛迪|圈枝|不准|吗蜂|不知/.test(cn)) return en;
  return cn;
}

/** 16 条定制反差文案（每人格一句，基于人格描述定制） */
const CONTRAST_WHYS: Record<string, string> = {
  暗流: "你习惯把情绪沉入海底。但这支香替你浮出水面——一种你极少示人的明亮与张扬。",
  荒岛: "你永远在出发。但这支香的深沉与克制，是你在旅途中偶尔需要一个锚的时候。",
  残温: "你习惯了做别人的避风港。但偶尔，你也该闻一闻风暴的味道。",
  裂岸: "你掌控一切。但这支香替你说出偶尔不想掌控的那一面——自由、松弛、任性。",
  寒岭: "你用逻辑包围自己。但这支香的温度，替你触达理性无法抵达的柔软角落。",
  极夜: "你追求极致，不允许缺口。但这支香的粗粝与不完美，是你不需要向他人展示的那一面。",
  砾迹: "你永远是别人的基石。但这支香的轻盈与意外，替你活出偶尔不那么「靠谱」的片刻。",
  冲浪: "你永远在阳光下奔跑。但这支香的暗调与内省，是你独处时才允许自己触碰的那一面。",
  温砾: "你习惯了给别人温暖。但这支香的清冷与距离感，是你留给自己的一小块领地。",
  空号: "你追求本质，厌恶喧嚣。但这支香的丰盈与盛大，是你偶尔纵容自己挥霍的奢侈。",
  冷砚: "你的品味从不张扬。但这支香替你宣告一次——我配得上被看见。",
  渊海: "你看得远。但这支香的瞬间爆发与任性，是你极少允许自己拥有的「当下」。",
  沉湾: "你敏锐到捕捉一切。但这支香的大胆与不加掩饰，是你偶尔想摘掉滤镜的时刻。",
  霜冷: "你默默扛起一切，不解释。但这支香的柔软与宣泄，是你不需要任何人理解的自我拥抱。",
  荒原: "你不愿妥协于现实。但这支香的冷静与秩序，是你在追逐星辰时偶尔踩回地面的力气。",
  烬生: "你的温柔是他人的日落。但这支香的烈度与决绝，是你不需要对任何人解释的内在锋芒。",
};

/** 全局反差香分配表：每人格分配到不同香水，贪心优先取最远处的 */
let _contrastMap: Map<string, Perfume> | null = null;
function getContrastMap(): Map<string, Perfume> {
  if (_contrastMap) return _contrastMap;
  const assigned = new Set<string>();
  const map = new Map<string, Perfume>();
  // 对每人格，从全库中找最远但尚未被他人占用的香水
  for (const p of PERSONALITY_TYPES) {
    const radar = getRadarScores(p.name);
    const recNames = new Set(getRecommendations(p.name).map((r) => r.name));
    const candidates = (Object.values(PERFUMES) as Perfume[])
      .filter((x) => !recNames.has(x.name) && !assigned.has(x.name))
      .map((x) => ({ p: x, dist: cosineDistance(radar, getPerfumeProfile(x)) }))
      .sort((a, b) => b.dist - a.dist);
    const best = candidates[0]?.p ?? (Object.values(PERFUMES) as Perfume[])[0];
    assigned.add(best.name);
    map.set(p.name, best);
  }
  _contrastMap = map;
  return map;
}

// ════════════════════════════════════════════════════════
// 本命守护香（玄学 / 守护体系固定映射）
// 从完整香水库（225 款）用 18 维分阶段余弦为 16 人格做「最优不重复分配」，
// 取高端(premium)专属、互不重复的一支作为「本命守护香」。
// 与动态本命香(getRecommendations)区分：守护香是「你是谁」的气息底色，常驻固定。
// 合规：外壳为守护/锚定语义，内核为气味契合，无任何吉凶/转运/桃花表述。
// ════════════════════════════════════════════════════════

// 人格 → 本命守护香（固定、互不重复、全 premium）
// 来源：scripts/assign_guardian.ts 匈牙利最优分配（方案 A · 高端专属）
export const GUARDIAN_PERFUME: Record<string, string> = {
  暗流: '莫哈维之影', 荒岛: '呵欠', 残温: '初恋', 裂岸: '焚香教堂',
  寒岭: '灰烬', 极夜: '亚历山大二世', 砾迹: '昆仑煮雪', 冲浪: '初熟之物',
  温砾: '月光天堂', 空号: '羊毛大衣', 冷砚: '精纯鸢尾', 渊海: '玫瑰31',
  沉湾: '一轮玫瑰', 霜冷: '冷杉之林', 荒原: '暗黑天使', 烬生: '珍珠乌木',
};

// 守护印（与每日香签金印「雅/隐」共用视觉，语义为「锚定的气息底色」）
// 隐=深邃内敛 | 雅=有故事感 | 常=明亮外放
export const GUARDIAN_SEAL: Record<string, '隐' | '雅' | '常'> = {
  暗流: '隐', 寒岭: '隐', 极夜: '隐', 空号: '隐', 渊海: '隐', 荒原: '隐',
  残温: '雅', 裂岸: '雅', 冷砚: '雅', 沉湾: '雅', 霜冷: '雅', 烬生: '雅',
  荒岛: '常', 砾迹: '常', 冲浪: '常', 温砾: '常',
};

// 守护签文（启示体 · 合规：讲情绪 / 审美，无吉凶 / 转运 / 桃花）
export const GUARDIAN_LINES: Record<string, string> = {
  暗流: '无人区的玫瑰，替你收着柔软',
  荒岛: '阳光落处，便是你不肯停留的岸',
  残温: '你给世界的光，有人替你温着',
  裂岸: '掌心的雷，替你劈开混沌',
  寒岭: '冷焰不灭，是你对自己的诚实',
  极夜: '极致处的光，只照给你自己',
  砾迹: '沉默的石，替所有人稳住脚',
  冲浪: '浪尖之上，你替无聊日子充电',
  温砾: '你的暖，是别人偷偷攒下的糖',
  空号: '留白之处，是你给自己的余地',
  冷砚: '冷釉覆火，是你看穿美的眼',
  渊海: '深蓝之下，你早看见远处',
  沉湾: '静湾藏细浪，你接住所有微妙',
  霜冷: '霜刃藏柔，是你不说的承担',
  荒原: '心中旷野，无人到过，你也不急',
  烬生: '余烬不灭，是你给人的落日',
};

const GUARDIAN_RADAR_CN_TO_EN: Record<string, string> = {
  花香: 'floral', 木质: 'woody', 清新: 'fresh', 东方: 'oriental', 柑橘: 'citrus', 美食: 'gourmand',
};

export interface GuardianPerfume {
  name: string;
  brand: string;
  brandCn: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  tier: 'premium' | 'budget';
  seal: '隐' | '雅' | '常';
  line: string;
  match: number; // 与人格气息的契合度 %
}

/** 取某人格的本命守护香（固定映射，全 premium 互不重复；契合度现场计算，保证与气味数据一致） */
export function getGuardianPerfume(name: string): GuardianPerfume | null {
  const pname = GUARDIAN_PERFUME[name];
  if (!pname) return null;
  const p = (PERFUMES as Record<string, Perfume>)[pname];
  if (!p) return null;
  const radarCn = getRadarScores(name);
  const radarEn: ScentVector = { floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0 };
  for (const [k, val] of Object.entries(radarCn) as [string, number][]) {
    const en = GUARDIAN_RADAR_CN_TO_EN[k];
    if (en) radarEn[en] = val;
  }
  const match = Math.round(cosineSimilarity18D(radarEn, getPerfumeProfile18D(p)) * 100);
  return {
    name: p.name, brand: p.brand, brandCn: p.brandCn,
    notes: p.notes, tier: p.tier,
    seal: GUARDIAN_SEAL[name] ?? '常',
    line: GUARDIAN_LINES[name] ?? '',
    match,
  };
}

export function getContrastScent(name: string): ContrastScent {
  const pick = getContrastMap().get(name) ?? (Object.values(PERFUMES) as Perfume[])[0];
  return {
    name: pick.name,
    brand: brandLabel(pick),
    notes: [...pick.notes.top, ...pick.notes.heart, ...pick.notes.base].join(" / "),
    why: CONTRAST_WHYS[name] ?? `你的雷达在这支香上几乎不发光——它替你活出另一种可能。`,
  };
}

/** 用香指南（P2）：按人格调性给 4 场景建议 */
export type UsageTip = { scene: string; icon: string; text: string };

export function getUsageGuide(name: string): UsageTip[] {
  const sig = getScentBlueprint(name).signature;
  const [t0, t1] = getHiddenFace(name).traits;
  const advice = getScentAdvice(name);
  return [
    { scene: '独处', icon: '🌙', text: `${t0}的你想静静时，选「${sig}」那支，底调最贴。` },
    { scene: '约会', icon: '🌹', text: advice.dating },
    { scene: '办公', icon: '📖', text: advice.office },
    { scene: '旅行', icon: '✈️', text: advice.travel },
  ];
}

// ══════════════════════════════════════════════════════════════
// v1.0 分享图文案资产
// ══════════════════════════════════════════════════════════════

/** 16 人格扎心短句（分享图视觉锤，20-30 字） */
const SHARE_QUOTES: Record<string, string> = {
  暗流:  '别人记住的不是你的脸，是你离开后的余味。',
  荒岛:  '你把平凡的日子，活成了别人期待的样子。',
  残温:  '你的温柔，是这个世界欠你的利息。',
  裂岸:  '你的方向感，比任何导航都准。',
  寒岭:  '清醒不是冷漠，是你对自己最诚实的温柔。',
  极夜:  '你追求的极致，本身就是一种美。',
  砾迹:  '你说话算话——这件事，已经赢了大多数人。',
  冲浪:  '你的热情，是最好的社交货币。',
  温砾:  '你的快乐，愿意分一半给身边的人。',
  空号:  '少即是多，多即是乱。你懂。',
  冷砚:  '你的审美，比你意识到的更稀有。',
  渊海:  '你的深度，是这个浅薄时代最稀缺的远见。',
  沉湾:  '你能感受到别人感受不到的——这是天赋，不是负担。',
  霜冷:  '该扛的从不逃避，你不需要被看见。',
  荒原:  '你心里有一片旷野，没人到过，你也不急。',
  烬生:  '你的温柔，是最被低估的力量。',
};

/** 16 人格本命香匹配理由（15-20 字） */
const SHARE_PERFUME_REASONS: Record<string, string> = {
  暗流:  '无人区玫瑰的克制与层次，像你——深不见底，却让人沉溺。',
  荒岛:  '希腊无花果的阳光与舒缓，与你一样——所到之处，皆是目的地。',
  残温:  '橙花的温暖与干净，像你天然的安定感——不争不抢，却让人心安。',
  裂岸:  '珍华乌木的厚重与力量，与你的气场恰好共振。',
  寒岭:  '檀道的冷冽与深邃，像你：清醒，但不冷漠。',
  极夜:  '史诗女士的极致与神秘，与你追求完美的灵魂一拍即合。',
  砾迹:  '大地的稳重与可靠，像你的承诺——说过的，一定做到。',
  冲浪:  'Y 的活力与清新，与你「人生就是用来体验」的态度同频共振。',
  温砾:  '暖棉的干净与舒缓，像你——让人不自觉想靠近的暖阳。',
  空号:  '息间之美的极简与留白，像你：不解释，也不妥协。',
  冷砚:  '杜桑的优雅与清冷，与你的审美品味完美契合。',
  渊海:  '檀道33的小众与精英感，像你——在别人看不到的地方，看见未来。',
  沉湾:  '纸纹的文艺与细腻，与你感受极致的敏感力共振。',
  霜冷:  '蔚蓝的清爽与男子气概，与你的可靠恰好同频。',
  荒原:  '影中之水的诗意与浪漫，像你——内心有一片没人到过的旷野。',
  烬生:  '纯白棉麻的精致与温柔，像你——柔软，但骨子里有力量。',
};

/** 16 人格 top-3 同类（余弦相似度最高，不含自己） */
const SIMILAR_PERSONALITIES: Record<string, string[]> = {
  暗流:  ['寒岭', '渊海', '极夜'],
  荒岛:  ['冲浪', '温砾', '砾迹'],
  残温:  ['烬生', '温砾', '荒原'],
  裂岸:  ['渊海', '寒岭', '极夜'],
  寒岭:  ['暗流', '渊海', '空号'],
  极夜:  ['暗流', '冷砚', '渊海'],
  砾迹:  ['荒岛', '霜冷', '冲浪'],
  冲浪:  ['荒岛', '温砾', '砾迹'],
  温砾:  ['荒岛', '残温', '冲浪'],
  空号:  ['寒岭', '暗流', '冷砚'],
  冷砚:  ['沉湾', '极夜', '荒原'],
  渊海:  ['暗流', '裂岸', '寒岭'],
  沉湾:  ['冷砚', '荒原', '烬生'],
  霜冷:  ['砾迹', '寒岭', '渊海'],
  荒原:  ['沉湾', '冷砚', '残温'],
  烬生:  ['残温', '沉湾', '温砾'],
};

export function getShareQuote(name: string): string {
  return SHARE_QUOTES[name] ?? SHARE_QUOTES['暗流'];
}

export function getSharePerfumeReason(name: string): string {
  return SHARE_PERFUME_REASONS[name] ?? SHARE_PERFUME_REASONS['暗流'];
}

export function getSimilarPersonalities(name: string): string[] {
  return SIMILAR_PERSONALITIES[name] ?? [];
}

/** B1：解析金句（原写死通用句 → 改为按人格变体）
 * 用每人格独有的 tagline 作引，落到产品主张「闻起来像自己」。
 */
export function getParseQuote(name: string): string {
  const p = PERSONALITIES.find((x) => x.name === name) ?? PERSONALITIES[0];
  return `「${p.tagline}」——这，就是你闻起来像自己的样子。`;
}

/** B1：用香哲学标题句（原写死通用句 → 改为按人格变体）
 * 用 direction 的气质词（括号前部分）注入，落到产品主张「不在于多贵，而在于多像你」。
 */
export function getUsagePhilosophy(name: string): string {
  const p = PERSONALITIES.find((x) => x.name === name) ?? PERSONALITIES[0];
  const trait = p.direction.includes('（') ? p.direction.split('（')[0] : p.direction;
  return `你的香水从不是为了遮盖，它只是把你那份「${trait}」，再确认一遍——不在于多贵，而在于多像你。`;
}
