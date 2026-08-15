// ============================================================
// Crush香鉴 — 7题分支路径系统（全分支·128路径）
// 2^7 = 128条路径 → 映射到16种人格
// ============================================================

import { PERSONALITY_TYPES } from "./data";
import { cosineSimilarity, type ScentVector } from "./matchPerfumes";

export interface QuestionChoice {
  id: string;
  text: string;
  nextQuestionId?: string;
  personalityBias: {
    floral?: number;
    woody?: number;
    fresh?: number;
    oriental?: number;
    citrus?: number;
    gourmand?: number;
  };
  pathLabel: string;
  pathEmoji: string;
}

export interface Question {
  id: string;
  scenario: string;
  question: string;
  choices: QuestionChoice[];
}

export const QUESTIONS: Record<string, Question> = {
  // ══════════════════════════════════════════════════════════
  // 第1题：深夜的邀请
  // ══════════════════════════════════════════════════════════
  q1: {
    id: "q1",
    scenario: "深夜的邀请",
    question: "你收到一封信，邀请你去一个地方。直觉告诉你，那里会是……",
    choices: [
      {
        id: "q1a",
        text: "一座海边悬崖上的灯塔，午夜的风带着咸湿的岩石气息，远处有海浪拍打的声音",
        nextQuestionId: "q2a",
        personalityBias: { fresh: 30, citrus: 15, woody: -10 },
        pathLabel: "海边灯塔",
        pathEmoji: "\u{1F30A}",
      },
      {
        id: "q1b",
        text: "一栋老城区的书店咖啡馆，烛光昏暗，空气中漂浮着旧书页和研磨咖啡的微苦香气",
        nextQuestionId: "q2b",
        personalityBias: { woody: 25, oriental: 20, gourmand: 10 },
        pathLabel: "旧书店",
        pathEmoji: "\u{1F4DA}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第2题：抵达之后（灯塔分支）
  // ══════════════════════════════════════════════════════════
  q2a: {
    id: "q2a",
    scenario: "灯塔之内",
    question: "推开灯塔的门，你发现——",
    choices: [
      {
        id: "q2aa",
        text: "一位老人在壁炉旁煮茶，杯中漂浮着橙皮和肉桂，空气中混合着海风与香料的温暖",
        nextQuestionId: "q3a",
        personalityBias: { citrus: 20, gourmand: 25, fresh: -10 },
        pathLabel: "香料茶室",
        pathEmoji: "\u{1F34A}",
      },
      {
        id: "q2ab",
        text: "一个空房间，只有一扇面向大海的窗户，月光洒在海面上，清冷而寂静",
        nextQuestionId: "q3b",
        personalityBias: { fresh: 25, woody: 10, floral: 5 },
        pathLabel: "月光海",
        pathEmoji: "\u{1F319}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第2题：抵达之后（书店分支）
  // ══════════════════════════════════════════════════════════
  q2b: {
    id: "q2b",
    scenario: "书店深处",
    question: "穿过书架，你发现一个隐藏的房间——",
    choices: [
      {
        id: "q2ba",
        text: "一间陈旧的琴房，一架老钢琴上放着一束枯萎的玫瑰，空气中残留着木蜡和花瓣的微甜",
        nextQuestionId: "q3c",
        personalityBias: { floral: 30, woody: 15, oriental: -5 },
        pathLabel: "枯玫瑰",
        pathEmoji: "\u{1F339}",
      },
      {
        id: "q2bb",
        text: "一个地下酒窖，橡木桶上落满灰尘，空气中弥漫着陈年威士忌和发酵的醇厚气息",
        nextQuestionId: "q3d",
        personalityBias: { woody: 35, oriental: 20, gourmand: 5 },
        pathLabel: "威士忌酒窖",
        pathEmoji: "\u{1F943}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第3题：情境深化A（香料茶室 → 茶的选择）
  // ══════════════════════════════════════════════════════════
  q3a: {
    id: "q3a",
    scenario: "茶香的秘密",
    question: "老人示意你坐下，问：你想喝什么茶？",
    choices: [
      {
        id: "q3aa",
        text: "伯爵茶——佛手柑的清亮穿透茶香，像是意大利南部阳光下的柠檬园",
        nextQuestionId: "q4a",
        personalityBias: { citrus: 35, fresh: 20, floral: 5 },
        pathLabel: "伯爵茶",
        pathEmoji: "\u{1F34B}",
      },
      {
        id: "q3ab",
        text: "路易波斯茶——草本的深沉混合着烟熏木质，像是托斯卡纳山区的傍晚",
        nextQuestionId: "q4b",
        personalityBias: { woody: 30, oriental: 15, gourmand: -5 },
        pathLabel: "路易波斯",
        pathEmoji: "\u{1F33F}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第3题：情境深化B（月光海 → 窗外的选择）
  // ══════════════════════════════════════════════════════════
  q3b: {
    id: "q3b",
    scenario: "海的回答",
    question: "你站在窗前，海风吹来——",
    choices: [
      {
        id: "q3ba",
        text: "风中混合着海藻的咸味和远处松林的清冷，像是北欧海岸线的冬天",
        nextQuestionId: "q4c",
        personalityBias: { fresh: 35, woody: 20, citrus: -5 },
        pathLabel: "北欧海岸",
        pathEmoji: "\u{2744}\u{FE0F}",
      },
      {
        id: "q3bb",
        text: "风中飘来一阵茉莉的花香，像是热带岛屿夜晚的花园，海风与花香交织",
        nextQuestionId: "q4d",
        personalityBias: { floral: 35, fresh: 20, citrus: 10 },
        pathLabel: "热带花园",
        pathEmoji: "\u{1F33A}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第3题：情境深化C（枯玫瑰 → 钢琴的选择）
  // ══════════════════════════════════════════════════════════
  q3c: {
    id: "q3c",
    scenario: "钢琴的秘密",
    question: "你按下琴键，琴弦震动的瞬间——",
    choices: [
      {
        id: "q3ca",
        text: "灰尘飞扬，枯玫瑰的香气在空气中炸开，像是维多利亚时代的一封未寄出的情书",
        nextQuestionId: "q4e",
        personalityBias: { floral: 45, woody: 10, oriental: 5 },
        pathLabel: "维多利亚情书",
        pathEmoji: "\u{1F48C}",
      },
      {
        id: "q3cb",
        text: "木蜡的甜味升起，像是祖父书房里的红木书桌，沉稳而温柔",
        nextQuestionId: "q4f",
        personalityBias: { woody: 40, oriental: 10, gourmand: -10 },
        pathLabel: "祖父书桌",
        pathEmoji: "\u{1FA91}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第3题：情境深化D（威士忌酒窖 → 酒的选择）
  // ══════════════════════════════════════════════════════════
  q3d: {
    id: "q3d",
    scenario: "酒窖的沉香",
    question: "你打开一瓶陈年威士忌——",
    choices: [
      {
        id: "q3da",
        text: "酒精挥发后，剩下的烟熏木质香像是苏格兰高地的泥炭和苔藓，原始而狂野",
        nextQuestionId: "q4g",
        personalityBias: { woody: 45, oriental: 15, fresh: -20 },
        pathLabel: "苏格兰高地",
        pathEmoji: "\u{1F3D4}\u{FE0F}",
      },
      {
        id: "q3db",
        text: "橡木桶释放出香草和焦糖的甜味，像是新奥尔良爵士酒吧的深夜",
        nextQuestionId: "q4h",
        personalityBias: { gourmand: 40, woody: 15, oriental: 10 },
        pathLabel: "爵士酒吧",
        pathEmoji: "\u{1F3B7}",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第4题：物品选择（8个不同分支）
  // ══════════════════════════════════════════════════════════
  q4a: {
    id: "q4a",
    scenario: "茶杯旁边",
    question: "茶杯旁边放着几样东西，你最想拿起哪一个？",
    choices: [
      { id: "q4aa", text: "一块柠檬蛋糕——甜蜜中带着柑橘的清新", nextQuestionId: "q5a", personalityBias: { gourmand: 30, citrus: 20, floral: 10 }, pathLabel: "柠檬蛋糕", pathEmoji: "\u{1F370}" },
      { id: "q4ab", text: "一块黑巧克力——苦涩中带着深邃的余韵", nextQuestionId: "q5b", personalityBias: { oriental: 25, woody: 20, gourmand: -10 }, pathLabel: "黑巧克力", pathEmoji: "\u{1F36B}" },
    ],
  },
  q4b: {
    id: "q4b",
    scenario: "茶杯旁边",
    question: "茶杯旁边放着几样东西，你最想拿起哪一个？",
    choices: [
      { id: "q4ba", text: "一本旧诗集——泛黄的书页带着檀木香气", nextQuestionId: "q5c", personalityBias: { woody: 30, oriental: 15, floral: 5 }, pathLabel: "旧诗集", pathEmoji: "\u{1F4D6}" },
      { id: "q4bb", text: "一根雪松木书签——干燥的木质香", nextQuestionId: "q5d", personalityBias: { woody: 35, fresh: 10, citrus: -5 }, pathLabel: "雪松书签", pathEmoji: "\u{1F4C6}" },
    ],
  },
  q4c: {
    id: "q4c",
    scenario: "窗台边",
    question: "窗台上有几样东西，你最想触碰哪一个？",
    choices: [
      { id: "q4ca", text: "一株苔藓——湿润的绿意带着泥土的深沉", nextQuestionId: "q5e", personalityBias: { fresh: 30, woody: 25, oriental: -5 }, pathLabel: "苔藓", pathEmoji: "\u{1F33F}" },
      { id: "q4cb", text: "一块海玻璃——被海水打磨的光滑，带着盐的气息", nextQuestionId: "q5f", personalityBias: { fresh: 35, citrus: 20, floral: -10 }, pathLabel: "海玻璃", pathEmoji: "\u{1F30A}" },
    ],
  },
  q4d: {
    id: "q4d",
    scenario: "窗台边",
    question: "窗台上有几样东西，你最想触碰哪一个？",
    choices: [
      { id: "q4da", text: "一朵干燥的鸡蛋花——微甜的白色花瓣", nextQuestionId: "q5g", personalityBias: { floral: 40, citrus: 15, gourmand: 10 }, pathLabel: "鸡蛋花", pathEmoji: "\u{1F33A}" },
      { id: "q4db", text: "一串风铃——海风穿过时发出清脆的声音", nextQuestionId: "q5h", personalityBias: { fresh: 30, citrus: 25, floral: -5 }, pathLabel: "海风铃", pathEmoji: "\u{1F508}" },
    ],
  },
  q4e: {
    id: "q4e",
    scenario: "琴谱架上",
    question: "琴谱架上放着一张乐谱，旁边还有——",
    choices: [
      { id: "q4ea", text: "一瓶墨水——深蓝色的，带着一丝金属光泽", nextQuestionId: "q5i", personalityBias: { oriental: 30, woody: 20, floral: -10 }, pathLabel: "深蓝墨水", pathEmoji: "\u{1F58A}\u{FE0F}" },
      { id: "q4eb", text: "一枚干枯的薰衣草——紫色的，带着草本的温柔", nextQuestionId: "q5j", personalityBias: { floral: 35, oriental: 20, woody: 10 }, pathLabel: "干薰衣草", pathEmoji: "\u{1F33F}" },
    ],
  },
  q4f: {
    id: "q4f",
    scenario: "书桌上",
    question: "书桌上有一盏老式台灯，旁边放着——",
    choices: [
      { id: "q4fa", text: "一盏檀香——点燃后飘出温暖的木质香", nextQuestionId: "q5k", personalityBias: { woody: 35, oriental: 20, gourmand: 5 }, pathLabel: "檀香", pathEmoji: "\u{1F525}" },
      { id: "q4fb", text: "一块琥珀——温润的，带着甜树脂的余韵", nextQuestionId: "q5l", personalityBias: { oriental: 30, gourmand: 25, woody: 10 }, pathLabel: "琥珀", pathEmoji: "\u{1F48E}" },
    ],
  },
  q4g: {
    id: "q4g",
    scenario: "酒桶旁",
    question: "酒桶旁有几样东西，你最想拿起哪一个？",
    choices: [
      { id: "q4ga", text: "一块泥炭——潮湿的，带着原始的烟熏气息", nextQuestionId: "q5m", personalityBias: { woody: 40, oriental: 15, fresh: -15 }, pathLabel: "泥炭", pathEmoji: "\u{1F30F}" },
      { id: "q4gb", text: "一把老铜钥匙——氧化后带着岁月的金属味", nextQuestionId: "q5n", personalityBias: { woody: 25, oriental: 25, fresh: -5 }, pathLabel: "铜钥匙", pathEmoji: "\u{1F5DD}\u{FE0F}" },
    ],
  },
  q4h: {
    id: "q4h",
    scenario: "吧台边",
    question: "吧台上放着几样东西，你最想拿起哪一个？",
    choices: [
      { id: "q4ha", text: "一根香草荚——甜甜的，带着奶油的联想", nextQuestionId: "q5o", personalityBias: { gourmand: 40, oriental: 10, citrus: 5 }, pathLabel: "香草荚", pathEmoji: "\u{1F33C}" },
      { id: "q4hb", text: "一颗咖啡豆——烘焙后的苦香带着焦糖底调", nextQuestionId: "q5p", personalityBias: { gourmand: 30, woody: 20, oriental: 10 }, pathLabel: "咖啡豆", pathEmoji: "\u{1F335}" },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // 第5题：最终选择（16个分支 → 进入结果）
  // ══════════════════════════════════════════════════════════
  q5a: { id: "q5a", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5aa", text: "柠檬塔的酸甜，像是地中海的夏天", nextQuestionId: "q6aa", personalityBias: { citrus: 45, gourmand: 20, fresh: 10 }, pathLabel: "柠檬塔", pathEmoji: "\u{1F34C}" }, { id: "q5ab", text: "伯爵茶的深邃，像是英式庄园的壁炉边", nextQuestionId: "q6ab", personalityBias: { citrus: 20, woody: 25, oriental: 15 }, pathLabel: "伯爵茶", pathEmoji: "\u{1F375}" }] },
  q5b: { id: "q5b", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ba", text: "黑巧克力的苦，像是巴塞罗那的午夜", nextQuestionId: "q6ba", personalityBias: { oriental: 40, woody: 20, floral: -5 }, pathLabel: "黑巧克力", pathEmoji: "\u{1F36B}" }, { id: "q5bb", text: "咖啡的香，像是维也纳的咖啡馆", nextQuestionId: "q6bb", personalityBias: { gourmand: 30, woody: 20, oriental: 10 }, pathLabel: "咖啡", pathEmoji: "\u{2615}" }] },
  q5c: { id: "q5c", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ca", text: "旧书页的尘香，像是牛津大学的图书馆", nextQuestionId: "q6ca", personalityBias: { woody: 35, oriental: 20, floral: 10 }, pathLabel: "旧书页", pathEmoji: "\u{1F4DA}" }, { id: "q5cb", text: "檀香的温暖，像是曼德勒的寺庙", nextQuestionId: "q6cb", personalityBias: { woody: 40, oriental: 25, gourmand: -5 }, pathLabel: "檀香", pathEmoji: "\u{1F3F3}\u{FE0F}" }] },
  q5d: { id: "q5d", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5da", text: "雪松的清冷，像是挪威的森林", nextQuestionId: "q6da", personalityBias: { woody: 45, fresh: 20, citrus: -10 }, pathLabel: "雪松", pathEmoji: "\u{1F332}" }, { id: "q5db", text: "冷杉的锐利，像是阿尔卑斯山的高处", nextQuestionId: "q6db", personalityBias: { fresh: 35, woody: 25, citrus: 5 }, pathLabel: "冷杉", pathEmoji: "\u{1F32F}" }] },
  q5e: { id: "q5e", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ea", text: "雨后泥土的清冽，像是苏格兰高地的荒野", nextQuestionId: "q6ea", personalityBias: { fresh: 40, woody: 25, floral: -10 }, pathLabel: "雨后泥土", pathEmoji: "\u{1F327}\u{FE0F}" }, { id: "q5eb", text: "苔藓的深沉，像是挪威峡湾的森林", nextQuestionId: "q6eb", personalityBias: { woody: 35, fresh: 30, oriental: 5 }, pathLabel: "苔藓", pathEmoji: "\u{1F33F}" }] },
  q5f: { id: "q5f", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5fa", text: "海盐的清冽，像是冰岛的黑沙滩", nextQuestionId: "q6fa", personalityBias: { fresh: 45, citrus: 15, woody: 5 }, pathLabel: "海盐", pathEmoji: "\u{1F30A}" }, { id: "q5fb", text: "冷空气的干净，像是北海道的冬天", nextQuestionId: "q6fb", personalityBias: { fresh: 40, citrus: 20, woody: 5 }, pathLabel: "冷空气", pathEmoji: "\u{2744}\u{FE0F}" }] },
  q5g: { id: "q5g", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ga", text: "晚香玉的热烈，像是巴厘岛的热带夜晚", nextQuestionId: "q6ga", personalityBias: { floral: 50, oriental: 15, gourmand: 10 }, pathLabel: "晚香玉", pathEmoji: "\u{1F33A}" }, { id: "q5gb", text: "茉莉的清幽，像是斯里兰卡的茶园夜晚", nextQuestionId: "q6gb", personalityBias: { floral: 45, citrus: 15, woody: 5 }, pathLabel: "茉莉", pathEmoji: "\u{1F33C}" }] },
  q5h: { id: "q5h", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ha", text: "薄荷的清凉，像是摩洛哥的薄荷茶", nextQuestionId: "q6ha", personalityBias: { fresh: 45, citrus: 20, gourmand: 5 }, pathLabel: "薄荷", pathEmoji: "\u{1F33F}" }, { id: "q5hb", text: "青柠的明亮，像是泰国的海边小摊", nextQuestionId: "q6hb", personalityBias: { citrus: 50, fresh: 20, gourmand: -5 }, pathLabel: "青柠", pathEmoji: "\u{1F34B}" }] },
  q5i: { id: "q5i", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ia", text: "墨水的深沉，像是深夜写作的孤独", nextQuestionId: "q6ia", personalityBias: { oriental: 40, woody: 25, floral: -5 }, pathLabel: "墨水", pathEmoji: "\u{1F58A}\u{FE0F}" }, { id: "q5ib", text: "旧木的沉稳，像是老房子的记忆", nextQuestionId: "q6ib", personalityBias: { woody: 45, oriental: 15, fresh: -10 }, pathLabel: "旧木", pathEmoji: "\u{1FA91}" }] },
  q5j: { id: "q5j", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ja", text: "薰衣草的宁静，像是普罗旺斯的黄昏", nextQuestionId: "q6ja", personalityBias: { floral: 40, woody: 15, oriental: 10 }, pathLabel: "薰衣草", pathEmoji: "\u{1F33F}" }, { id: "q5jb", text: "紫罗兰的优雅，像是巴黎的春天", nextQuestionId: "q6jb", personalityBias: { floral: 45, oriental: 15, woody: 5 }, pathLabel: "紫罗兰", pathEmoji: "\u{1F339}" }] },
  q5k: { id: "q5k", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ka", text: "沉香的神秘，像是东京的寺庙深夜", nextQuestionId: "q6ka", personalityBias: { oriental: 50, woody: 20, floral: -10 }, pathLabel: "沉香", pathEmoji: "\u{1F332}" }, { id: "q5kb", text: "没药的古老，像是中东市场的角落", nextQuestionId: "q6kb", personalityBias: { oriental: 45, woody: 25, gourmand: -5 }, pathLabel: "没药", pathEmoji: "\u{1F3F3}\u{FE0F}" }] },
  q5l: { id: "q5l", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5la", text: "琥珀的温润，像是伊朗沙漠的日落", nextQuestionId: "q6la", personalityBias: { oriental: 45, gourmand: 25, woody: 5 }, pathLabel: "琥珀", pathEmoji: "\u{1F48E}" }, { id: "q5lb", text: "安息香的甜美，像是曼谷的寺庙外", nextQuestionId: "q6lb", personalityBias: { gourmand: 35, oriental: 25, floral: 10 }, pathLabel: "安息香", pathEmoji: "\u{1F3F3}\u{FE0F}" }] },
  q5m: { id: "q5m", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5ma", text: "泥炭的原始，像是艾雷岛的海风", nextQuestionId: "q6ma", personalityBias: { woody: 50, oriental: 15, fresh: -15 }, pathLabel: "泥炭", pathEmoji: "\u{1F30F}" }, { id: "q5mb", text: "海水的咸涩，像是设得兰群岛的悬崖", nextQuestionId: "q6mb", personalityBias: { fresh: 45, woody: 15, citrus: 5 }, pathLabel: "海水", pathEmoji: "\u{1F30A}" }] },
  q5n: { id: "q5n", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5na", text: "老铜的沉稳，像是古老城堡的钥匙", nextQuestionId: "q6na", personalityBias: { woody: 35, oriental: 30, fresh: -5 }, pathLabel: "老铜", pathEmoji: "\u{1F5DD}\u{FE0F}" }, { id: "q5nb", text: "旧皮的温润，像是祖父的书房", nextQuestionId: "q6nb", personalityBias: { woody: 40, oriental: 20, gourmand: 10 }, pathLabel: "旧皮", pathEmoji: "\u{1F45A}\u{FE0F}" }] },
  q5o: { id: "q5o", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5oa", text: "香草的温柔，像是马达加斯加的黄昏", nextQuestionId: "q6oa", personalityBias: { gourmand: 50, oriental: 15, citrus: 10 }, pathLabel: "香草", pathEmoji: "\u{1F33C}" }, { id: "q5ob", text: "椰子的热带，像是斐济的海边小屋", nextQuestionId: "q6ob", personalityBias: { gourmand: 45, citrus: 20, floral: 5 }, pathLabel: "椰子", pathEmoji: "\u{1F334}" }] },
  q5p: { id: "q5p", scenario: "味道的记忆", question: "这个夜晚，你想留下什么味道？", choices: [{ id: "q5pa", text: "焦糖的温暖，像是布鲁塞尔的老糖果店", nextQuestionId: "q6pa", personalityBias: { gourmand: 50, oriental: 10, woody: 10 }, pathLabel: "焦糖", pathEmoji: "\u{1F366}" }, { id: "q5pb", text: "咖啡的深邃，像是西雅图的雨天", nextQuestionId: "q6pb", personalityBias: { gourmand: 35, woody: 25, oriental: 10 }, pathLabel: "咖啡", pathEmoji: "\u{2615}" }] },
  q6aa: {
    id: "q6aa",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6aaa", text: "「柠檬」——把光的明亮酿成甜", nextQuestionId: "q7aaa", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "柠檬", pathEmoji: "🍋" },
      { id: "q6aab", text: "「可可」——给甜腻切一刀清爽", nextQuestionId: "q7aab", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "可可", pathEmoji: "🍯" },
    ],
  },
  q6ab: {
    id: "q6ab",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6aba", text: "「檀香」——把木的沉稳刻进骨子里", nextQuestionId: "q7aba", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "檀香", pathEmoji: "🌲" },
      { id: "q6abb", text: "「雨苔」——给清冷多一缕锐利", nextQuestionId: "q7abb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "雨苔", pathEmoji: "🌊" },
    ],
  },
  q6ba: {
    id: "q6ba",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6baa", text: "「琥珀」——把香的神秘缝进梦境", nextQuestionId: "q7baa", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "琥珀", pathEmoji: "🔮" },
      { id: "q6bab", text: "「臭氧」——给清冷多一缕锐利", nextQuestionId: "q7bab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "臭氧", pathEmoji: "🌊" },
    ],
  },
  q6bb: {
    id: "q6bb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6bba", text: "「蜂蜜」——把甜的暖意揉进黄昏", nextQuestionId: "q7bba", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "蜂蜜", pathEmoji: "🍯" },
      { id: "q6bbb", text: "「柑橘」——给明亮压一层薄霜", nextQuestionId: "q7bbb", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "柑橘", pathEmoji: "🍋" },
    ],
  },
  q6ca: {
    id: "q6ca",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6caa", text: "「橡木」——把木的沉稳刻进骨子里", nextQuestionId: "q7caa", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "橡木", pathEmoji: "🌲" },
      { id: "q6cab", text: "「鼠尾草」——给清冷多一缕锐利", nextQuestionId: "q7cab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "鼠尾草", pathEmoji: "🌊" },
    ],
  },
  q6cb: {
    id: "q6cb",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6cba", text: "「柏木」——把木的沉稳刻进骨子里", nextQuestionId: "q7cba", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "柏木", pathEmoji: "🌲" },
      { id: "q6cbb", text: "「海盐」——给清冷多一缕锐利", nextQuestionId: "q7cbb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "海盐", pathEmoji: "🌊" },
    ],
  },
  q6da: {
    id: "q6da",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6daa", text: "「杉木」——把木的沉稳刻进骨子里", nextQuestionId: "q7daa", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "杉木", pathEmoji: "🌲" },
      { id: "q6dab", text: "「薄荷」——给清冷多一缕锐利", nextQuestionId: "q7dab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "薄荷", pathEmoji: "🌊" },
    ],
  },
  q6db: {
    id: "q6db",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6dba", text: "「海盐」——把海的清冽收进瓶底", nextQuestionId: "q7dba", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "海盐", pathEmoji: "🌊" },
      { id: "q6dbb", text: "「乳香」——给浓烈留一道缝隙", nextQuestionId: "q7dbb", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "乳香", pathEmoji: "🔮" },
    ],
  },
  q6ea: {
    id: "q6ea",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6eaa", text: "「薄荷」——把海的清冽收进瓶底", nextQuestionId: "q7eaa", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "薄荷", pathEmoji: "🌊" },
      { id: "q6eab", text: "「焚香」——给浓烈留一道缝隙", nextQuestionId: "q7eab", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "焚香", pathEmoji: "🔮" },
    ],
  },
  q6eb: {
    id: "q6eb",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6eba", text: "「广藿香」——把木的沉稳刻进骨子里", nextQuestionId: "q7eba", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "广藿香", pathEmoji: "🌲" },
      { id: "q6ebb", text: "「臭氧」——给清冷多一缕锐利", nextQuestionId: "q7ebb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "臭氧", pathEmoji: "🌊" },
    ],
  },
  q6fa: {
    id: "q6fa",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6faa", text: "「雨苔」——把海的清冽收进瓶底", nextQuestionId: "q7faa", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "雨苔", pathEmoji: "🌊" },
      { id: "q6fab", text: "「沉香」——给浓烈留一道缝隙", nextQuestionId: "q7fab", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "沉香", pathEmoji: "🔮" },
    ],
  },
  q6fb: {
    id: "q6fb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6fba", text: "「臭氧」——把海的清冽收进瓶底", nextQuestionId: "q7fba", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "臭氧", pathEmoji: "🌊" },
      { id: "q6fbb", text: "「没药」——给浓烈留一道缝隙", nextQuestionId: "q7fbb", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "没药", pathEmoji: "🔮" },
    ],
  },
  q6ga: {
    id: "q6ga",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6gaa", text: "「桂花」——把花的缱绻藏进衣角", nextQuestionId: "q7gaa", personalityBias: { floral: 35, oriental: 10 }, pathLabel: "桂花", pathEmoji: "🌸" },
      { id: "q6gab", text: "「雪松」——给沉稳吹进一阵风", nextQuestionId: "q7gab", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "雪松", pathEmoji: "🌲" },
    ],
  },
  q6gb: {
    id: "q6gb",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6gba", text: "「铃兰」——把花的缱绻藏进衣角", nextQuestionId: "q7gba", personalityBias: { floral: 35, oriental: 10 }, pathLabel: "铃兰", pathEmoji: "🌸" },
      { id: "q6gbb", text: "「檀香」——给沉稳吹进一阵风", nextQuestionId: "q7gbb", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "檀香", pathEmoji: "🌲" },
    ],
  },
  q6ha: {
    id: "q6ha",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6haa", text: "「海盐」——把海的清冽收进瓶底", nextQuestionId: "q7haa", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "海盐", pathEmoji: "🌊" },
      { id: "q6hab", text: "「焚香」——给浓烈留一道缝隙", nextQuestionId: "q7hab", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "焚香", pathEmoji: "🔮" },
    ],
  },
  q6hb: {
    id: "q6hb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6hba", text: "「香橙」——把光的明亮酿成甜", nextQuestionId: "q7hba", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "香橙", pathEmoji: "🍋" },
      { id: "q6hbb", text: "「蜂蜜」——给甜腻切一刀清爽", nextQuestionId: "q7hbb", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "蜂蜜", pathEmoji: "🍯" },
    ],
  },
  q6ia: {
    id: "q6ia",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6iaa", text: "「焚香」——把香的神秘缝进梦境", nextQuestionId: "q7iaa", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "焚香", pathEmoji: "🔮" },
      { id: "q6iab", text: "「臭氧」——给清冷多一缕锐利", nextQuestionId: "q7iab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "臭氧", pathEmoji: "🌊" },
    ],
  },
  q6ib: {
    id: "q6ib",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6iba", text: "「岩兰草」——把木的沉稳刻进骨子里", nextQuestionId: "q7iba", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "岩兰草", pathEmoji: "🌲" },
      { id: "q6ibb", text: "「青苹果」——给清冷多一缕锐利", nextQuestionId: "q7ibb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "青苹果", pathEmoji: "🌊" },
    ],
  },
  q6ja: {
    id: "q6ja",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6jaa", text: "「鸢尾」——把花的缱绻藏进衣角", nextQuestionId: "q7jaa", personalityBias: { floral: 35, oriental: 10 }, pathLabel: "鸢尾", pathEmoji: "🌸" },
      { id: "q6jab", text: "「杉木」——给沉稳吹进一阵风", nextQuestionId: "q7jab", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "杉木", pathEmoji: "🌲" },
    ],
  },
  q6jb: {
    id: "q6jb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6jba", text: "「桂花」——把花的缱绻藏进衣角", nextQuestionId: "q7jba", personalityBias: { floral: 35, oriental: 10 }, pathLabel: "桂花", pathEmoji: "🌸" },
      { id: "q6jbb", text: "「雪松」——给沉稳吹进一阵风", nextQuestionId: "q7jbb", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "雪松", pathEmoji: "🌲" },
    ],
  },
  q6ka: {
    id: "q6ka",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6kaa", text: "「琥珀」——把香的神秘缝进梦境", nextQuestionId: "q7kaa", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "琥珀", pathEmoji: "🔮" },
      { id: "q6kab", text: "「薄荷」——给清冷多一缕锐利", nextQuestionId: "q7kab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "薄荷", pathEmoji: "🌊" },
    ],
  },
  q6kb: {
    id: "q6kb",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6kba", text: "「乳香」——把香的神秘缝进梦境", nextQuestionId: "q7kba", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "乳香", pathEmoji: "🔮" },
      { id: "q6kbb", text: "「青草」——给清冷多一缕锐利", nextQuestionId: "q7kbb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "青草", pathEmoji: "🌊" },
    ],
  },
  q6la: {
    id: "q6la",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6laa", text: "「焚香」——把香的神秘缝进梦境", nextQuestionId: "q7laa", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "焚香", pathEmoji: "🔮" },
      { id: "q6lab", text: "「雨苔」——给清冷多一缕锐利", nextQuestionId: "q7lab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "雨苔", pathEmoji: "🌊" },
    ],
  },
  q6lb: {
    id: "q6lb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6lba", text: "「可可」——把甜的暖意揉进黄昏", nextQuestionId: "q7lba", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "可可", pathEmoji: "🍯" },
      { id: "q6lbb", text: "「青柠」——给明亮压一层薄霜", nextQuestionId: "q7lbb", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "青柠", pathEmoji: "🍋" },
    ],
  },
  q6ma: {
    id: "q6ma",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6maa", text: "「岩兰草」——把木的沉稳刻进骨子里", nextQuestionId: "q7maa", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "岩兰草", pathEmoji: "🌲" },
      { id: "q6mab", text: "「青苹果」——给清冷多一缕锐利", nextQuestionId: "q7mab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "青苹果", pathEmoji: "🌊" },
    ],
  },
  q6mb: {
    id: "q6mb",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6mba", text: "「臭氧」——把海的清冽收进瓶底", nextQuestionId: "q7mba", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "臭氧", pathEmoji: "🌊" },
      { id: "q6mbb", text: "「乳香」——给浓烈留一道缝隙", nextQuestionId: "q7mbb", personalityBias: { oriental: 35, woody: 10 }, pathLabel: "乳香", pathEmoji: "🔮" },
    ],
  },
  q6na: {
    id: "q6na",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6naa", text: "「柏木」——把木的沉稳刻进骨子里", nextQuestionId: "q7naa", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "柏木", pathEmoji: "🌲" },
      { id: "q6nab", text: "「海盐」——给清冷多一缕锐利", nextQuestionId: "q7nab", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "海盐", pathEmoji: "🌊" },
    ],
  },
  q6nb: {
    id: "q6nb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6nba", text: "「杉木」——把木的沉稳刻进骨子里", nextQuestionId: "q7nba", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "杉木", pathEmoji: "🌲" },
      { id: "q6nbb", text: "「薄荷」——给清冷多一缕锐利", nextQuestionId: "q7nbb", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "薄荷", pathEmoji: "🌊" },
    ],
  },
  q6oa: {
    id: "q6oa",
    scenario: "最后的注脚",
    question: "夜色将尽，你想为这趟旅程留下最后的注脚——",
    choices: [
      { id: "q6oaa", text: "「香草」——把甜的暖意揉进黄昏", nextQuestionId: "q7oaa", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "香草", pathEmoji: "🍯" },
      { id: "q6oab", text: "「柠檬」——给明亮压一层薄霜", nextQuestionId: "q7oab", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "柠檬", pathEmoji: "🍋" },
    ],
  },
  q6ob: {
    id: "q6ob",
    scenario: "临别的礼物",
    question: "临走前，角落里还有一样东西在等你——",
    choices: [
      { id: "q6oba", text: "「焦糖」——把甜的暖意揉进黄昏", nextQuestionId: "q7oba", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "焦糖", pathEmoji: "🍯" },
      { id: "q6obb", text: "「青柠」——给明亮压一层薄霜", nextQuestionId: "q7obb", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "青柠", pathEmoji: "🍋" },
    ],
  },
  q6pa: {
    id: "q6pa",
    scenario: "夜的尾声",
    question: "你回头看了一眼，最舍不得的是——",
    choices: [
      { id: "q6paa", text: "「可可」——把甜的暖意揉进黄昏", nextQuestionId: "q7paa", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "可可", pathEmoji: "🍯" },
      { id: "q6pab", text: "「佛手柑」——给明亮压一层薄霜", nextQuestionId: "q7pab", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "佛手柑", pathEmoji: "🍋" },
    ],
  },
  q6pb: {
    id: "q6pb",
    scenario: "封存的记忆",
    question: "天快亮了，你选择把这段记忆封存成——",
    choices: [
      { id: "q6pba", text: "「蜂蜜」——把甜的暖意揉进黄昏", nextQuestionId: "q7pba", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "蜂蜜", pathEmoji: "🍯" },
      { id: "q6pbb", text: "「香橙」——给明亮压一层薄霜", nextQuestionId: "q7pbb", personalityBias: { citrus: 35, fresh: 10 }, pathLabel: "香橙", pathEmoji: "🍋" },
    ],
  },
  q7aaa: {
    id: "q7aaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7aaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7aaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7aab: {
    id: "q7aab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7aaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7aabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7aba: {
    id: "q7aba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7abaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7abab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7abb: {
    id: "q7abb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7abba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7abbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7baa: {
    id: "q7baa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7baaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7baab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7bab: {
    id: "q7bab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7baba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7babb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7bba: {
    id: "q7bba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7bbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7bbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7bbb: {
    id: "q7bbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7bbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7bbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7caa: {
    id: "q7caa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7caaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7caab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7cab: {
    id: "q7cab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7caba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7cabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7cba: {
    id: "q7cba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7cbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7cbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7cbb: {
    id: "q7cbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7cbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7cbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7daa: {
    id: "q7daa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7daaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7daab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7dab: {
    id: "q7dab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7daba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7dabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7dba: {
    id: "q7dba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7dbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7dbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7dbb: {
    id: "q7dbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7dbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7dbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7eaa: {
    id: "q7eaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7eaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7eaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7eab: {
    id: "q7eab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7eaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7eabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7eba: {
    id: "q7eba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7ebaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7ebab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7ebb: {
    id: "q7ebb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7ebba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7ebbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7faa: {
    id: "q7faa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7faaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7faab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7fab: {
    id: "q7fab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7faba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7fabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7fba: {
    id: "q7fba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7fbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7fbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7fbb: {
    id: "q7fbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7fbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7fbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7gaa: {
    id: "q7gaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7gaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7gaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7gab: {
    id: "q7gab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7gaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7gabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7gba: {
    id: "q7gba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7gbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7gbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7gbb: {
    id: "q7gbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7gbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7gbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7haa: {
    id: "q7haa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7haaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7haab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7hab: {
    id: "q7hab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7haba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7habb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7hba: {
    id: "q7hba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7hbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7hbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7hbb: {
    id: "q7hbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7hbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7hbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7iaa: {
    id: "q7iaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7iaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7iaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7iab: {
    id: "q7iab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7iaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7iabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7iba: {
    id: "q7iba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7ibaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7ibab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7ibb: {
    id: "q7ibb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7ibba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7ibbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7jaa: {
    id: "q7jaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7jaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7jaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7jab: {
    id: "q7jab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7jaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7jabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7jba: {
    id: "q7jba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7jbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7jbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7jbb: {
    id: "q7jbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7jbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7jbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7kaa: {
    id: "q7kaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7kaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7kaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7kab: {
    id: "q7kab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7kaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7kabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7kba: {
    id: "q7kba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7kbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7kbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7kbb: {
    id: "q7kbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7kbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7kbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7laa: {
    id: "q7laa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7laaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7laab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7lab: {
    id: "q7lab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7laba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7labb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7lba: {
    id: "q7lba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7lbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7lbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7lbb: {
    id: "q7lbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7lbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7lbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7maa: {
    id: "q7maa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7maaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7maab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7mab: {
    id: "q7mab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7maba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7mabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7mba: {
    id: "q7mba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7mbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7mbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7mbb: {
    id: "q7mbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7mbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7mbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7naa: {
    id: "q7naa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7naaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7naab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7nab: {
    id: "q7nab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7naba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7nabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7nba: {
    id: "q7nba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7nbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7nbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7nbb: {
    id: "q7nbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7nbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7nbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7oaa: {
    id: "q7oaa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7oaaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7oaab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7oab: {
    id: "q7oab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7oaba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7oabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7oba: {
    id: "q7oba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7obaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7obab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7obb: {
    id: "q7obb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7obba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7obbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  q7paa: {
    id: "q7paa",
    scenario: "余韵",
    question: "这瓶香气，你想让它替你说出——",
    choices: [
      { id: "q7paaa", text: "温柔的余温——不张扬，却让人反复想起", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "余温", pathEmoji: "🔥" },
      { id: "q7paab", text: "锋利的清醒——不讨好但难忘", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清醒", pathEmoji: "💎" },
    ],
  },
  q7pab: {
    id: "q7pab",
    scenario: "印记",
    question: "最后，你希望别人记住你的——",
    choices: [
      { id: "q7paba", text: "沉静的底色——像深夜的壁炉", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "沉静", pathEmoji: "🕯️" },
      { id: "q7pabb", text: "通透的留白——什么都没说却全说了", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "留白", pathEmoji: "🌫️" },
    ],
  },
  q7pba: {
    id: "q7pba",
    scenario: "独白",
    question: "你希望这味道留下的余韵是——",
    choices: [
      { id: "q7pbaa", text: "绵长的暖意——事后才浮现的甜", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "暖意", pathEmoji: "🍯" },
      { id: "q7pbab", text: "冷调的体面——疏离但有距离美", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "体面", pathEmoji: "🧊" },
    ],
  },
  q7pbb: {
    id: "q7pbb",
    scenario: "回声",
    question: "合上这夜，你最想被记住的是——",
    choices: [
      { id: "q7pbba", text: "私密的温柔——只给懂的人", nextQuestionId: undefined, personalityBias: { gourmand: 25, oriental: 10, fresh: -10 }, pathLabel: "私密", pathEmoji: "🌙" },
      { id: "q7pbbb", text: "清冽的底色——像雪后空气，干净得没有杂质", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 10, gourmand: -10 }, pathLabel: "清冽", pathEmoji: "❄️" },
    ],
  },
  cal1: {
    id: "cal1",
    scenario: "校准",
    question: "最后校准一下——你最想被记住的气息偏向？",
    choices: [
      { id: "cal1a", text: "甜润温柔（焦糖、香草、蜂蜜的包裹感）", nextQuestionId: "cal2", personalityBias: { gourmand: 35, oriental: 10 }, pathLabel: "甜润", pathEmoji: "🍯" },
      { id: "cal1b", text: "清冽干净（海风、薄荷、青草的通透感）", nextQuestionId: "cal2", personalityBias: { fresh: 35, citrus: 10 }, pathLabel: "清冽", pathEmoji: "🌊" },
      { id: "cal1c", text: "深沉有故事（木质、香料、烟熏的厚度）", nextQuestionId: "cal2", personalityBias: { woody: 35, oriental: 10 }, pathLabel: "深沉", pathEmoji: "🌲" },
    ],
  },
  cal2: {
    id: "cal2",
    scenario: "校准",
    question: "你希望这瓶香的留香——",
    choices: [
      { id: "cal2a", text: "持久（一整天都在，存在感强）", nextQuestionId: "cal3", personalityBias: { woody: 20, oriental: 15 }, pathLabel: "持久", pathEmoji: "🔥" },
      { id: "cal2b", text: "适中（几个小时，若即若离）", nextQuestionId: "cal3", personalityBias: { floral: 10, fresh: 10 }, pathLabel: "适中", pathEmoji: "🌗" },
      { id: "cal2c", text: "清淡（贴近皮肤，只有你能闻到的私密感）", nextQuestionId: "cal3", personalityBias: { fresh: 20, citrus: 15 }, pathLabel: "清淡", pathEmoji: "🌫️" },
    ],
  },
  cal3: {
    id: "cal3",
    scenario: "校准",
    question: "这瓶香你最想用在——",
    choices: [
      { id: "cal3a", text: "独处或深夜里（给自己闻的）", nextQuestionId: undefined, personalityBias: { oriental: 25, woody: 15 }, pathLabel: "独处夜", pathEmoji: "🌙" },
      { id: "cal3b", text: "白天出门或工作（清爽提神）", nextQuestionId: undefined, personalityBias: { fresh: 25, citrus: 15 }, pathLabel: "白天", pathEmoji: "☀️" },
      { id: "cal3c", text: "约会或重要场合（迷人记忆点）", nextQuestionId: undefined, personalityBias: { floral: 25, gourmand: 15 }, pathLabel: "约会", pathEmoji: "💞" },
    ],
  },
};

export const CALIBRATION_ORDER = ["cal1", "cal2", "cal3"];




// ============================================================
// 核心计算函数
// 基于 Q1 入口 + 累积分数推断人格
// ============================================================

type RadarScore = {
  floral: number;
  woody: number;
  fresh: number;
  oriental: number;
  citrus: number;
  gourmand: number;
};

/**
 * 从用户选择累加人格倾向并相对归一化（与结果页雷达同维度）。
 * 纯函数：相同 choices 永远返回相同 scores。
 */
function computeRadarScores(choices: string[]): RadarScore {
  let scores: RadarScore = {
    floral: 50, woody: 50, fresh: 50, oriental: 50, citrus: 50, gourmand: 50,
  };

  // 累加所有选择的人格倾向
  for (const choiceId of choices) {
    for (const qId of Object.keys(QUESTIONS)) {
      const q = QUESTIONS[qId];
      const choice = q.choices.find(c => c.id === choiceId);
      if (choice) {
        for (const [key, value] of Object.entries(choice.personalityBias)) {
          scores[key as keyof RadarScore] += value as number;
        }
        break;
      }
    }
  }

  // 相对归一化：用 dived-by-max 替代硬钳 0-100，让维度间的强弱差异显现
  const raw: Record<string, number> = {};
  for (const key of Object.keys(scores) as (keyof RadarScore)[]) {
    raw[key] = Math.max(0, scores[key]);
  }
  const max = Math.max(...Object.values(raw), 1);
  for (const key of Object.keys(scores) as (keyof RadarScore)[]) {
    scores[key] = Math.round((raw[key] / max) * 100);
  }

  return scores;
}

/**
 * 纯函数：基于分数用余弦相似度匹配最近的人格质心（全 16 原型竞争）。
 * 不使用任何模块级可变状态，确保「相同答案 → 相同结果」。
 * 质心来自 PERSONALITY_TYPES，与 test scores 同维度。
 */
function findClosestPersonality(scores: RadarScore): string {
  const centroids = PERSONALITY_TYPES as Array<{ id: string; name: string; radarScores: ScentVector }>;
  const vec: ScentVector = {
    floral: scores.floral ?? 50, woody: scores.woody ?? 50,
    fresh: scores.fresh ?? 50, oriental: scores.oriental ?? 50,
    citrus: scores.citrus ?? 50, gourmand: scores.gourmand ?? 50,
  };

  let best = centroids[0].id;
  let bestCos = -Infinity;
  for (const c of centroids) {
    const cos = cosineSimilarity(vec, c.radarScores);
    if (cos > bestCos) {
      bestCos = cos;
      best = c.id;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────
// 确定性路径→人格分配表（模块加载时预计算一次）
// 目的：
//  1. 消除原 _freqMap 突变导致的非确定性（相同答案必须→相同结果）
//  2. 保证 16 个人格均可被问卷路径命中（覆盖全量，无孤儿原型）
// 算法：
//  - 枚举全部叶子路径，用纯余弦求每条路径的「最近原型」(base)
//  - 若某些原型未被任何路径命中，贪心从「多路径原型」借最便宜的路径补齐
//    借路径条件：当前所属原型路径数 ≥ 2（避免借空产生新缺口），
//    且借给目标原型后余弦损失最小（cos(current) - cos(target) 最小）
// ─────────────────────────────────────────────────────────
function enumeratePaths(): string[][] {
  const nextIds = new Set<string>();
  Object.values(QUESTIONS).forEach((q) => q.choices.forEach((c) => c.nextQuestionId && nextIds.add(c.nextQuestionId)));
  const roots = Object.keys(QUESTIONS).filter((qid) => !nextIds.has(qid));
  const paths: string[][] = [];
  const dfs = (qid: string, acc: string[]) => {
    const q = QUESTIONS[qid];
    if (!q) return;
    if (!q.choices || q.choices.length === 0) { paths.push(acc); return; }
    let anyNext = false;
    for (const c of q.choices) {
      if (c.nextQuestionId && QUESTIONS[c.nextQuestionId]) {
        anyNext = true;
        dfs(c.nextQuestionId, [...acc, c.id]);
      } else {
        paths.push([...acc, c.id]);
      }
    }
    if (!anyNext) paths.push(acc);
  };
  roots.forEach((r) => dfs(r, []));
  return paths;
}

function buildPathAssignment(): Map<string, string> {
  const allIds = PERSONALITY_TYPES.map((t) => t.id);
  const centroids = PERSONALITY_TYPES.map((t) => ({ id: t.id, vec: t.radarScores }));
  const paths = enumeratePaths();

  const cosCache = new Map<string, number>();
  const cosOf = (str: string, vec: ScentVector, pid: string): number => {
    const key = `${str}::${pid}`;
    const hit = cosCache.get(key);
    if (hit !== undefined) return hit;
    const c = centroids.find((x) => x.id === pid)!;
    const v = cosineSimilarity(vec, c.vec);
    cosCache.set(key, v);
    return v;
  };
  const vecOf = (path: string[]): ScentVector => {
    const s = computeRadarScores(path);
    return { floral: s.floral, woody: s.woody, fresh: s.fresh, oriental: s.oriental, citrus: s.citrus, gourmand: s.gourmand };
  };

  // base：每条路径纯余弦最近原型
  const assign = new Map<string, string>();
  const ownerCount: Record<string, number> = {};
  for (const path of paths) {
    const str = path.join("-");
    const vec = vecOf(path);
    let best = centroids[0].id;
    let bestCos = -Infinity;
    for (const c of centroids) {
      const cos = cosineSimilarity(vec, c.vec);
      if (cos > bestCos) { bestCos = cos; best = c.id; }
    }
    assign.set(str, best);
    ownerCount[best] = (ownerCount[best] ?? 0) + 1;
  }

  // 覆盖补齐：贪心借路径
  const uncovered = allIds.filter((id) => !pathHasOwner(assign, id));
  for (const target of uncovered) {
    let bestPathStr = "";
    let bestFrom = "";
    let bestLoss = Infinity;
    // 优先借「多路径原型」(路径数 ≥ 2)，保证不产生新缺口
    for (const [str, owner] of assign) {
      if ((ownerCount[owner] ?? 0) < 2) continue;
      const vec = vecOf(str.split("-"));
      const loss = cosOf(str, vec, owner) - cosOf(str, vec, target); // ≥ 0
      if (loss < bestLoss) { bestLoss = loss; bestPathStr = str; bestFrom = owner; }
    }
    // 兜底：若无多路径来源（极端情况），借路径数最多的原型
    if (!bestPathStr) {
      let topOwner = "";
      let topCount = 0;
      for (const [ , owner] of assign) {
        if ((ownerCount[owner] ?? 0) > topCount) { topCount = ownerCount[owner]!; topOwner = owner; }
      }
      for (const [str, owner] of assign) {
        if (owner !== topOwner) continue;
        const vec = vecOf(str.split("-"));
        const loss = cosOf(str, vec, owner) - cosOf(str, vec, target);
        if (loss < bestLoss) { bestLoss = loss; bestPathStr = str; bestFrom = owner; }
      }
    }
    if (bestPathStr) {
      assign.set(bestPathStr, target);
      ownerCount[bestFrom] = (ownerCount[bestFrom] ?? 0) - 1;
      ownerCount[target] = (ownerCount[target] ?? 0) + 1;
    }
  }
  return assign;
}

function pathHasOwner(assign: Map<string, string>, id: string): boolean {
  for (const owner of assign.values()) if (owner === id) return true;
  return false;
}

const PATH_ASSIGNMENT = buildPathAssignment();

export function calculatePersonalityFromPath(choices: string[]): {
  personalityId: string;
  pathString: string;
  radarScores: RadarScore;
} {
  const scores = computeRadarScores(choices);
  const pathString = choices.join("-");

  // 生产调用：查确定性的路径→人格分配表（覆盖全 16 原型，重复调用不漂移）
  const personalityId = PATH_ASSIGNMENT.get(pathString) ?? findClosestPersonality(scores);

  return { personalityId, pathString, radarScores: scores };
}

export function getPathLabels(choices: string[]): Array<{ label: string; emoji: string }> {
  const labels: Array<{ label: string; emoji: string }> = [];

  for (const choiceId of choices) {
    for (const qId of Object.keys(QUESTIONS)) {
      const q = QUESTIONS[qId];
      const choice = q.choices.find(c => c.id === choiceId);
      if (choice) {
        labels.push({ label: choice.pathLabel, emoji: choice.pathEmoji });
        break;
      }
    }
  }

  return labels;
}
