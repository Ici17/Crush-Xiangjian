// ============================================================
// Crush香鉴 — 16种人格 & 151款香水数据
// ============================================================

import { PERFUMES_EXTRA } from "./perfumes.extra";

export type Tier = "signature" | "advanced" | "budget";

export interface Perfume {
  id: string;
  name: string;        // 中文名
  brand: string;       // 品牌
  brandCn: string;    // 中文品牌名
  notes: {
    top: string[];    // 前调
    heart: string[];   // 中调
    base: string[];    // 后调
  };
  intensity: 1 | 2 | 3 | 4 | 5; // 扩散力 1-5
  longevity: 1 | 2 | 3 | 4 | 5; // 留香 1-5
  tier: Tier;
  priceRange: string;  // 价格区间描述
  description: string; // 50字以内描述
}

export interface PersonalityType {
  id: string;
  name: string;        // 人格名（2-3字）
  mbtiAlias: string;   // MBTI别名（不暴露版权）
  tagline: string;     // 一句话标签
  description: string;  // 100字以内性格描述
  scentDirection: string; // 香气方向描述
  radarScores: {       // 6维雷达图分数 0-100
    floral: number;    // 花香
    woody: number;      // 木质
    fresh: number;      // 清新
    oriental: number;  // 东方调
    citrus: number;     // 柑橘
    gourmand: number;   // 美食调
  };
  signaturePerfume: Perfume;
  advancedPerfume: Perfume;
  budgetPerfume: Perfume;
  matchingReport: {
    coreMessage: string;  // 核心解读（一句话）
    personalityAnalysis: string; // 性格深度分析（3-4句）
    scentPhilosophy: string;    // 用香哲学（2-3句）
    growthSuggestion: string;    // 成长建议（2-3句）
  };
}

// ============================================================
// 香水数据库
// ============================================================

export const PERFUMES_BASE: Record<string, Perfume> = {
  // ── 无人区玫瑰 ──────────────────────────────────
 无人区玫瑰: {
    id: "无人区玫瑰",
    name: "无人区玫瑰",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["粉红胡椒", "玫瑰"], heart: ["玫瑰", "紫罗兰"], base: ["广藿香", "纸莎草"] },
    intensity: 3, longevity: 4,
    tier: "signature",
    priceRange: "¥800-1200/50ml",
    description: "荒漠中的冷艳玫瑰，极度克制又极度浪漫。",
  },
  超级雪松: {
    id: "超级雪松",
    name: "超级雪松",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["玫瑰"], heart: ["雪松"], base: ["香根草", "麝香"] },
    intensity: 2, longevity: 3,
    tier: "advanced",
    priceRange: "¥700-1000/50ml",
    description: "雪后的针叶林，冷冽中透出微甜的木质暖意。",
  },
  冬日之草: {
    id: "冬日之草",
    name: "冬日之草",
    brand: "Diptyque",
    brandCn: "蒂普提克",
    notes: { top: ["紫罗兰叶", "黄葵"], heart: ["雪松", "鸢尾"], base: ["琥珀", "绒面革"] },
    intensity: 2, longevity: 3,
    tier: "budget",
    priceRange: "¥400-600/50ml",
    description: "冬日霜冻草坪上的清冷青绿气息。",
  },

  // ── 希腊无花果 ──────────────────────────────────
  希腊无花果: {
    id: "希腊无花果",
    name: "希腊无花果",
    brand: "Diptyque",
    brandCn: "蒂普提克",
    notes: { top: ["无花果叶", "香柠檬"], heart: ["无花果", "椰子"], base: ["雪松", "檀香"] },
    intensity: 3, longevity: 4,
    tier: "signature",
    priceRange: "¥600-900/50ml",
    description: "地中海岛屿上的阳光无花果，奶香与绿意交织。",
  },
  阳光下无忧无虑: {
    id: "阳光下无忧无虑",
    name: "阳光下无忧无虑",
    brand: "Kilian",
    brandCn: "凯利安",
    notes: { top: ["香柠檬", "苦橙叶"], heart: ["橙花", "茉莉"], base: ["麝香", "檀香"] },
    intensity: 3, longevity: 3,
    tier: "advanced",
    priceRange: "¥1800-2400/50ml",
    description: "盛夏柑橘园里无忧无虑的少年感。",
  },
  无花果: {
    id: "无花果-气味图书馆",
    name: "无花果",
    brand: "气味图书馆",
    brandCn: "气味图书馆",
    notes: { top: ["无花果叶", "香柠檬"], heart: ["无花果奶"], base: ["雪松"] },
    intensity: 2, longevity: 2,
    tier: "budget",
    priceRange: "¥120-180/50ml",
    description: "清新无花果，轻盈无负担的日常香。",
  },

  // ── 橙花 ──────────────────────────────────
  橙花: {
    id: "橙花",
    name: "橙花",
    brand: "Jo Malone London",
    brandCn: "祖马龙",
    notes: { top: ["橙花", "柑橘"], heart: ["白花", "莲花"], base: ["檀香", "香根草"] },
    intensity: 2, longevity: 2,
    tier: "signature",
    priceRange: "¥600-800/30ml",
    description: "英式花园里刚采下的新鲜橙花，干净温暖。",
  },
  无尽之水: {
    id: "无尽之水",
    name: "无尽之水",
    brand: "L'Artisan Parfumeur",
    brandCn: "阿蒂仙",
    notes: { top: ["柠檬", "青柠"], heart: ["橙花", "薰衣草"], base: ["麝香", "雪松"] },
    intensity: 2, longevity: 3,
    tier: "advanced",
    priceRange: "¥500-700/50ml",
    description: "清凉透彻的水生调，像站在瀑布边的清爽。",
  },
  小甜心: {
    id: "小甜心",
    name: "小甜心",
    brand: "Annick Goutal",
    brandCn: "安霓可",
    notes: { top: ["橙子", "葡萄柚"], heart: ["栀子花", "山谷百合"], base: ["白木"] },
    intensity: 2, longevity: 2,
    tier: "budget",
    priceRange: "¥300-500/50ml",
    description: "俏皮甜蜜的果香花园，适合少女心。",
  },

  // ── 珍华乌木 ──────────────────────────────────
  珍华乌木: {
    id: "珍华乌木",
    name: "珍华乌木",
    brand: "Tom Ford",
    brandCn: "汤姆·福特",
    notes: { top: ["香柠檬", "粉红胡椒"], heart: ["小豆蔻", "姜"], base: ["沉香木", "檀香", "零陵香豆"] },
    intensity: 5, longevity: 5,
    tier: "signature",
    priceRange: "¥2500-3500/50ml",
    description: "珍稀乌木的深邃奢华，气场全开的霸道总裁香。",
  },
  魅力丝绸: {
    id: "魅力丝绸",
    name: "魅力丝绸",
    brand: "Tom Ford",
    brandCn: "汤姆·福特",
    notes: { top: ["香柠檬", "藏红花"], heart: ["玫瑰", "茉莉"], base: ["沉香木", "檀香"] },
    intensity: 4, longevity: 5,
    tier: "advanced",
    priceRange: "¥2200-3000/50ml",
    description: "丝绸般的温润东方调，华贵而不张扬。",
  },
  旷野之心: {
    id: "旷野之心",
    name: "旷野之心",
    brand: "Kilian",
    brandCn: "凯利安",
    notes: { top: ["香柠檬", "鼠尾草"], heart: ["薰衣草", "百里香"], base: ["檀香木", "雪松"] },
    intensity: 4, longevity: 4,
    tier: "advanced",
    priceRange: "¥1800-2400/50ml",
    description: "广袤大地上的自由灵魂，率性而为。",
  },

  // ── 檀道 ──────────────────────────────────
  檀道: {
    id: "檀道",
    name: "檀道",
    brand: "Diptyque",
    brandCn: "蒂普提克",
    notes: { top: ["香柠檬", "绿叶"], heart: ["檀香木", "雪松"], base: ["檀香木", "麝香"] },
    intensity: 3, longevity: 4,
    tier: "signature",
    priceRange: "¥700-950/50ml",
    description: "冥想空间的宁静檀木，安静而有力量。",
  },
  焚香教堂: {
    id: "焚香教堂",
    name: "焚香教堂",
    brand: "L'Artisan Parfumeur",
    brandCn: "阿蒂仙",
    notes: { top: ["安息香", "劳丹脂"], heart: ["乳香", "檀香"], base: ["广藿香", "肉桂"] },
    intensity: 4, longevity: 5,
    tier: "advanced",
    priceRange: "¥600-850/50ml",
    description: "教堂中的焚香缭绕，神圣而肃穆的东方木质。",
  },
  非凡雪松: {
    id: "非凡雪松",
    name: "非凡雪松",
    brand: "Jo Loves",
    brandCn: "祖氏挚爱",
    notes: { top: ["香柠檬", "红雪松叶"], heart: ["红雪松"], base: ["麝香", "檀香"] },
    intensity: 2, longevity: 3,
    tier: "budget",
    priceRange: "¥350-550/50ml",
    description: "挺拔清新的红雪松，适合喜欢极简的人。",
  },

  // ── 史诗女士 ──────────────────────────────────
  史诗女士: {
    id: "史诗女士",
    name: "史诗女士",
    brand: "Giorgio Armani",
    brandCn: "阿玛尼",
    notes: { top: ["小豆蔻", "藏红花"], heart: ["玫瑰", "茉莉", "茶"], base: ["琥珀", "沉香木", "麝香"] },
    intensity: 4, longevity: 5,
    tier: "signature",
    priceRange: "¥1200-1800/100ml",
    description: "东方木质玫瑰，强大女性气质的巅峰诠释。",
  },
  禁忌之夜: {
    id: "禁忌之夜",
    name: "禁忌之夜",
    brand: "Tom Ford",
    brandCn: "汤姆·福特",
    notes: { top: ["香柠檬", "藏红花"], heart: ["大马士革玫瑰", "沉香"], base: ["广藿香", "檀香"] },
    intensity: 5, longevity: 5,
    tier: "advanced",
    priceRange: "¥2000-2800/50ml",
    description: "暗夜中的危险玫瑰，诱惑与神秘并存。",
  },
  玫瑰之花: {
    id: "玫瑰之花",
    name: "玫瑰之花",
    brand: "Kilian",
    brandCn: "凯利安",
    notes: { top: ["香柠檬", "黑醋栗"], heart: ["大马士革玫瑰", "五月玫瑰"], base: ["白麝香"] },
    intensity: 3, longevity: 3,
    tier: "advanced",
    priceRange: "¥1500-2000/50ml",
    description: "精纯的大马士革玫瑰，优雅而不甜腻。",
  },

  // ── 大地 ──────────────────────────────────
  大地: {
    id: "大地",
    name: "大地",
    brand: "Hermès",
    brandCn: "爱马仕",
    notes: { top: ["橙子", "葡萄柚", "胡椒"], heart: ["雪松", "天竺葵", "广藿香"], base: ["琥珀", "香根草", "安息香"] },
    intensity: 4, longevity: 5,
    tier: "signature",
    priceRange: "¥600-900/100ml",
    description: "与大地的契约，柑橘木质的永恒经典。",
  },
  灰色岩兰草: {
    id: "灰色岩兰草",
    name: "灰色岩兰草",
    brand: "Tom Ford",
    brandCn: "汤姆·福特",
    notes: { top: ["香柠檬", "橙花"], heart: ["岩兰草", "鼠尾草"], base: ["雪松", "麝香"] },
    intensity: 3, longevity: 4,
    tier: "advanced",
    priceRange: "¥1200-1600/50ml",
    description: "清冷理性的岩兰草，精致而克制。",
  },
  绅士: {
    id: "绅士",
    name: "绅士",
    brand: "Givenchy",
    brandCn: "纪梵希",
    notes: { top: ["香柠檬", "粉红胡椒"], heart: ["雪松", "天竺葵"], base: ["香根草", "麝香"] },
    intensity: 3, longevity: 4,
    tier: "budget",
    priceRange: "¥300-500/50ml",
    description: "都市绅士的日常木质香，低调得体。",
  },

  // ── Y ──────────────────────────────────
  "Y": {
    id: "Y",
    name: "Y",
    brand: "Yves Saint Laurent",
    brandCn: "圣罗兰",
    notes: { top: ["生姜", "柠檬", "香柠檬"], heart: ["鼠尾草", "天竺葵", "杜松子"], base: ["雪松", "焚香", "琥珀木"] },
    intensity: 4, longevity: 4,
    tier: "signature",
    priceRange: "¥800-1100/60ml",
    description: "打破规则的叛逆气息，年轻而锋利。",
  },
  动感活力: {
    id: "动感活力",
    name: "动感活力",
    brand: "Dolce&Gabbana",
    brandCn: "杜嘉班纳",
    notes: { top: ["橙子", "冰片"], heart: ["迷迭香", "海藻"], base: ["麝香", "雪松"] },
    intensity: 3, longevity: 3,
    tier: "advanced",
    priceRange: "¥500-750/75ml",
    description: "地中海阳光海岸的动感清新，适合运动型人格。",
  },
  同名版: {
    id: "同名版-范思哲",
    name: "同名版",
    brand: "Versace",
    brandCn: "范思哲",
    notes: { top: ["柠檬", "橙花", "冰片"], heart: ["天竺葵", "风信子"], base: ["麝香", "琥珀"] },
    intensity: 4, longevity: 3,
    tier: "budget",
    priceRange: "¥250-400/50ml",
    description: "明亮张扬的意大利阳光，性价比极高。",
  },

  // ── 暖棉 ──────────────────────────────────
  暖棉: {
    id: "暖棉",
    name: "暖棉",
    brand: "Clean",
    brandCn: "Clean",
    notes: { top: ["香柠檬", "橙子"], heart: ["亚麻", "薰衣草"], base: ["白麝香", "檀香"] },
    intensity: 2, longevity: 2,
    tier: "signature",
    priceRange: "¥300-500/50ml",
    description: "刚洗过的干净棉布，温暖舒适的安全感。",
  },
  鼠尾草与海盐: {
    id: "鼠尾草与海盐",
    name: "鼠尾草与海盐",
    brand: "Jo Malone London",
    brandCn: "祖马龙",
    notes: { top: ["秋葵子", "海盐"], heart: ["鼠尾草", "海岸植物"], base: ["麝香", "木本"] },
    intensity: 2, longevity: 2,
    tier: "advanced",
    priceRange: "¥500-700/30ml",
    description: "英吉利海峡的海岸风，清新而治愈。",
  },
  呵欠: {
    id: "呵欠",
    name: "呵欠",
    brand: "Atelier Cologne",
    brandCn: "欧珑",
    notes: { top: ["苦橙叶", "柠檬"], heart: ["橙花", "马黛茶"], base: ["白麝香", "零陵香豆"] },
    intensity: 2, longevity: 3,
    tier: "budget",
    priceRange: "¥400-600/30ml",
    description: "慵懒午后的呵欠，温柔又提神的柑橘茶香。",
  },

  // ── 息间之美 ──────────────────────────────────
  息间之美: {
    id: "息间之美",
    name: "息间之美",
    brand: "Aesop",
    brandCn: "伊索",
    notes: { top: ["芫荽籽", "乳香"], heart: ["薰衣草", "迷迭香"], base: ["檀香", "雪松"] },
    intensity: 3, longevity: 4,
    tier: "signature",
    priceRange: "¥800-1100/50ml",
    description: "极简主义者的用香哲学，冷静克制却禁得起细品。",
  },
  冷山: {
    id: "冷山",
    name: "冷山",
    brand: "Frederic Malle",
    brandCn: "弗蕾德马尔",
    notes: { top: ["香柠檬", "葛缕子"], heart: ["雪松", "冷杉"], base: ["檀香", "开司米木"] },
    intensity: 3, longevity: 4,
    tier: "advanced",
    priceRange: "¥900-1300/50ml",
    description: "冬日高山上的冷杉林，纯净到几乎透明。",
  },
  墨水: {
    id: "墨水",
    name: "墨水",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["紫罗兰叶", "黄葵"], heart: ["鸢尾", "焚香"], base: ["皮革", "麝香"] },
    intensity: 2, longevity: 4,
    tier: "advanced",
    priceRange: "¥600-850/50ml",
    description: "作家书房的墨水香，文人气质的独特印记。",
  },

  // ── 杜桑 ──────────────────────────────────
  杜桑: {
    id: "杜桑",
    name: "杜桑",
    brand: "Diptyque",
    brandCn: "蒂普提克",
    notes: { top: ["橙花", "绿叶"], heart: ["晚香玉", "玫瑰"], base: ["麝香", "安息香"] },
    intensity: 4, longevity: 4,
    tier: "signature",
    priceRange: "¥700-950/50ml",
    description: "越南海边的晚香玉，温柔浪漫又不失清冷。",
  },
  月亮女人: {
    id: "月亮女人",
    name: "月亮女人",
    brand: "Penhaligon's",
    brandCn: "潘海利根",
    notes: { top: ["荔枝", "粉红胡椒"], heart: ["玫瑰", "牡丹"], base: ["麝香", "雪松"] },
    intensity: 3, longevity: 3,
    tier: "advanced",
    priceRange: "¥600-900/50ml",
    description: "月光下的神秘女人，柔美中带着不可言说的距离感。",
  },
  精纯鸢尾: {
    id: "精纯鸢尾",
    name: "精纯鸢尾",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["紫罗兰叶"], heart: ["鸢尾根", "玫瑰"], base: ["麝香", "檀香"] },
    intensity: 2, longevity: 4,
    tier: "advanced",
    priceRange: "¥700-950/50ml",
    description: "纯粹到极致的鸢尾，粉末感的精致优雅。",
  },

  // ── 檀道33 ──────────────────────────────────
  檀道33: {
    id: "檀道33",
    name: "檀道33",
    brand: "Le Labo",
    brandCn: "勒拉博",
    notes: { top: ["紫罗兰叶", "小豆蔻"], heart: ["皮革", "鸢尾"], base: ["檀香木", "雪松", "麝香"] },
    intensity: 3, longevity: 5,
    tier: "signature",
    priceRange: "¥1400-2000/50ml",
    description: "小众香的王冠，极简文艺青年的精神鸦片。",
  },
  深邃之红: {
    id: "深邃之红",
    name: "深邃之红",
    brand: "Tom Ford",
    brandCn: "汤姆·福特",
    notes: { top: ["藏红花", "朗姆酒"], heart: ["大马士革玫瑰", "五月玫瑰"], base: ["沉香木", "广藿香"] },
    intensity: 5, longevity: 5,
    tier: "advanced",
    priceRange: "¥2800-3800/50ml",
    description: "深邃而浓烈的红酒玫瑰，高阶玩家的终极选择。",
  },
  冷杉之林: {
    id: "冷杉之林",
    name: "冷杉之林",
    brand: "Annick Goutal",
    brandCn: "安霓可",
    notes: { top: ["冷杉针叶", "迷迭香"], heart: ["杜松子", "雪松"], base: ["苔藓", "檀香"] },
    intensity: 3, longevity: 4,
    tier: "budget",
    priceRange: "¥400-650/50ml",
    description: "冷杉森林的深邃木质，干净利落的森林气息。",
  },

  // ── 纸纹 ──────────────────────────────────
  纸纹: {
    id: "纸纹",
    name: "纸纹",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["黄葵", "紫罗兰叶"], heart: ["鸢尾", "玫瑰"], base: ["麝香", "开司米木"] },
    intensity: 2, longevity: 3,
    tier: "signature",
    priceRange: "¥700-950/50ml",
    description: "翻开新书的那一刻，纸香与墨香交织的文艺气息。",
  },
  复古传奇: {
    id: "复古传奇",
    name: "复古传奇",
    brand: "Frederic Malle",
    brandCn: "弗蕾德马尔",
    notes: { top: ["香柠檬", "醛类"], heart: ["五月玫瑰", "紫罗兰"], base: ["麝香", "檀香"] },
    intensity: 3, longevity: 4,
    tier: "advanced",
    priceRange: "¥900-1300/50ml",
    description: "老派玫瑰醛香的高定质感，复古优雅的极致。",
  },
  花花小姐: {
    id: "花花小姐",
    name: "花花小姐",
    brand: "Marc Jacobs",
    brandCn: "马克·雅可布",
    notes: { top: ["梨", "葡萄柚"], heart: ["牡丹", "玫瑰"], base: ["麝香", "雪松"] },
    intensity: 3, longevity: 3,
    tier: "budget",
    priceRange: "¥250-400/50ml",
    description: "甜美俏皮的花果香，轻松愉悦的少女感。",
  },

  // ── 蔚蓝 ──────────────────────────────────
  蔚蓝: {
    id: "蔚蓝",
    name: "蔚蓝",
    brand: "Chanel",
    brandCn: "香奈儿",
    notes: { top: ["柑橘", "薄荷", "生姜"], heart: ["檀香", "雪松", "老鹳草"], base: ["劳丹脂", "琥珀木"] },
    intensity: 4, longevity: 4,
    tier: "signature",
    priceRange: "¥850-1150/100ml",
    description: "自由不羁的男性荷尔蒙香，成功男士的标配。",
  },
  成功: {
    id: "成功",
    name: "成功",
    brand: "Montblanc",
    brandCn: "万宝龙",
    notes: { top: ["香柠檬", "薰衣草"], heart: ["天竺葵", "鼠尾草"], base: ["檀香", "麝香"] },
    intensity: 3, longevity: 4,
    tier: "advanced",
    priceRange: "¥350-550/50ml",
    description: "商业精英的得体之选，性价比极高的大众男香。",
  },
  旷野: {
    id: "旷野-迪奥",
    name: "旷野",
    brand: "Dior",
    brandCn: "迪奥",
    notes: { top: ["香柠檬", "卡拉布里亚佛手柑"], heart: ["薰衣草", "天竺葵"], base: ["降龙涎香醚", "雪松"] },
    intensity: 4, longevity: 4,
    tier: "advanced",
    priceRange: "¥700-950/60ml",
    description: "率性阳刚的现代男性气质，清爽而不张扬。",
  },

  // ── 影中之水 ──────────────────────────────────
  影中之水: {
    id: "影中之水",
    name: "影中之水",
    brand: "Diptyque",
    brandCn: "蒂普提克",
    notes: { top: ["黑醋栗叶", "香柠檬"], heart: ["玫瑰", "麝香"], base: ["龙涎香", "木质"] },
    intensity: 3, longevity: 4,
    tier: "signature",
    priceRange: "¥600-850/50ml",
    description: "森林深处的水潭，绿意与水生交织的空灵气息。",
  },
  马拉喀什: {
    id: "马拉喀什",
    name: "马拉喀什",
    brand: "L'Artisan Parfumeur",
    brandCn: "阿蒂仙",
    notes: { top: ["粉红胡椒", "肉桂"], heart: ["雪松", "鸢尾"], base: ["檀香", "安息香"] },
    intensity: 4, longevity: 5,
    tier: "advanced",
    priceRange: "¥600-850/50ml",
    description: "北非马拉喀什的东方集市，香料与木质的热情碰撞。",
  },
  紫繁花: {
    id: "紫繁花",
    name: "紫繁花",
    brand: "Jo Loves",
    brandCn: "祖氏挚爱",
    notes: { top: ["紫罗兰叶", "葡萄柚"], heart: ["紫罗兰", "玫瑰"], base: ["雪松", "麝香"] },
    intensity: 2, longevity: 3,
    tier: "budget",
    priceRange: "¥350-550/50ml",
    description: "紫色花田的清新甜美，适合日常的温柔香。",
  },

  // ── 纯白棉麻 ──────────────────────────────────
  纯白棉麻: {
    id: "纯白棉麻",
    name: "纯白棉麻",
    brand: "Byredo",
    brandCn: "百瑞德",
    notes: { top: ["醛类", "白松香"], heart: ["亚麻", "山梅花"], base: ["麝香", "檀香"] },
    intensity: 2, longevity: 3,
    tier: "signature",
    priceRange: "¥700-950/50ml",
    description: "纯粹干净的棉麻气息，极简生活的嗅觉隐喻。",
  },
  肌肤之弦: {
    id: "肌肤之弦",
    name: "肌肤之弦",
    brand: "Chanel",
    brandCn: "香奈儿",
    notes: { top: ["醛类", "香柠檬"], heart: ["五月玫瑰", "格拉斯玫瑰"], base: ["麝香", "白麝香"] },
    intensity: 2, longevity: 3,
    tier: "advanced",
    priceRange: "¥1200-1800/100ml",
    description: "贴近肌肤的亲密体香，如隐若无的极致优雅。",
  },
  白茶: {
    id: "白茶",
    name: "白茶",
    brand: "Kilian",
    brandCn: "凯利安",
    notes: { top: ["香柠檬", "白茶"], heart: ["紫罗兰叶", "桂花"], base: ["麝香", "檀香"] },
    intensity: 2, longevity: 3,
    tier: "advanced",
    priceRange: "¥1500-2000/50ml",
    description: "清雅的白茶香气，淡然却有极深的余韵。",
  },
};

// ============================================================
// 人格类型定义
// ============================================================

export const PERFUMES: Record<string, Perfume> = {
  ...PERFUMES_BASE,
  ...PERFUMES_EXTRA,
};

export const PERSONALITY_TYPES: PersonalityType[] = [
  {
    id: "anliu",
    name: "暗流",
    mbtiAlias: "内向深度型",
    tagline: "表面平静，内心深不见底",
    description: "你像深海，表面波澜不惊，底下藏着完整的宇宙。习惯独自消化情绪，却对真正重要的人毫无保留。",
    scentDirection: "克制的优雅：木质+玫瑰，不甜腻不过于张扬",
    radarScores: { floral: 75, woody: 90, fresh: 40, oriental: 80, citrus: 20, gourmand: 10 },
    signaturePerfume: PERFUMES["无人区玫瑰"],
    advancedPerfume: PERFUMES["超级雪松"],
    budgetPerfume: PERFUMES["冬日之草"],
    matchingReport: {
      coreMessage: "你不需要香气来证明自己，你的克制本身已是最高级的表达。",
      personalityAnalysis: "暗流人格的你，在人群中往往是最安静的那个，却是所有事情最靠得住的人。你习惯深度思考后再行动，每一个决定背后都有完整的逻辑支撑。",
      scentPhilosophy: "你选香从不随大流。你喜欢有层次、有故事感的香气，能在不同的时刻呈现不同的面貌——正如你，永远不会被人一眼看透。",
      growthSuggestion: "试着偶尔打开自己，让别人看见你的脆弱。不完美，恰恰是最真实的完整。",
    },
  },
  {
    id: "huangdao",
    name: "荒岛",
    mbtiAlias: "自由探索型",
    tagline: "只要有光，哪里都是目的地",
    description: "你是那种被丢到荒岛上，也能跟椰子树聊一下午的人。永远对世界保持好奇，随时准备出发。",
    scentDirection: "阳光活力：柑橘+无花果+海洋，清新又治愈",
    radarScores: { floral: 50, woody: 30, fresh: 90, oriental: 30, citrus: 95, gourmand: 60 },
    signaturePerfume: PERFUMES["希腊无花果"],
    advancedPerfume: PERFUMES["阳光下无忧无虑"],
    budgetPerfume: PERFUMES["无花果"],
    matchingReport: {
      coreMessage: "你的存在本身就像一瓶好香——让人忍不住想靠近。",
      personalityAnalysis: "荒岛人格的你拥有最珍贵的禀赋：真正的乐观。你的热情是发自内心的，不带表演性质，能轻松感染周围所有人。",
      scentPhilosophy: "你天生就知道如何让生活保持有趣。你的用香哲学是：香气应该让今天比昨天更好玩一点。",
      growthSuggestion: "学会享受独处，让内心的岛屿也有机会被看见。最好的故事，往往发生在一个人静静发呆的时候。",
    },
  },
  {
    id: "canwen",
    name: "残温",
    mbtiAlias: "温暖守护型",
    tagline: "我的温度，刚好暖你一个人",
    description: "你有一种天然的治愈力，坐在你旁边就让人觉得安心。不争不抢，却让身边的人变得更好。",
    scentDirection: "温暖治愈：白花+橙花+麝香，干净温暖有安全感",
    radarScores: { floral: 85, woody: 40, fresh: 50, oriental: 45, citrus: 65, gourmand: 55 },
    signaturePerfume: PERFUMES["橙花"],
    advancedPerfume: PERFUMES["无尽之水"],
    budgetPerfume: PERFUMES["小甜心"],
    matchingReport: {
      coreMessage: "你的温柔不是软弱，是你最强大的武器。",
      personalityAnalysis: "残温人格的你擅长给予，但有时候给得太多，忘了留一些给自己。你的共情能力是天生的，这让身边的人都想向你靠近。",
      scentPhilosophy: "你选择的香气温暖而不灼人，像一盏持续亮着的小夜灯——不刺眼，但永远在那里。",
      growthSuggestion: "学会设定边界。温暖的人最需要的，不是更多的给予，而是学会接受。",
    },
  },
  {
    id: "liean",
    name: "裂岸",
    mbtiAlias: "精准领袖型",
    tagline: "方向对了，努力才有意义",
    description: "你天生有领袖气质，能在混乱中找到秩序，在迷雾中指明方向。目标感极强，从不废话。",
    scentDirection: "力量气场：乌木+檀香+琥珀，厚重有深度",
    radarScores: { floral: 30, woody: 95, fresh: 35, oriental: 95, citrus: 15, gourmand: 15 },
    signaturePerfume: PERFUMES["珍华乌木"],
    advancedPerfume: PERFUMES["魅力丝绸"],
    budgetPerfume: PERFUMES["沉香迷雾"],
    matchingReport: {
      coreMessage: "你的气场是天赋，但真正让你无可替代的，是那颗从不服输的心。",
      personalityAnalysis: "裂岸人格的你做事讲究效率，讨厌绕路。你的决断力源于对自己判断的绝对信任，这也是为什么人们愿意跟随你。",
      scentPhilosophy: "你选香和选人一样——要么最顶配，要么不要。你相信香气是有能量的，好香本身就能改变一天的走向。",
      growthSuggestion: "偶尔放慢脚步欣赏一下沿途风景。目标固然重要，但到达目的地的方式，决定了你成为什么样的人。",
    },
  },
  {
    id: "hanling",
    name: "寒岭",
    mbtiAlias: "理性洞察型",
    tagline: "我只是想搞清楚世界的底层逻辑",
    description: "你是那种会在凌晨三点研究一个哲学问题的人。逻辑极强，不喜欢废话，但对真正懂你的人极好。",
    scentDirection: "冷冽深邃：檀木+焚香+雪松，禁欲系的冥想感",
    radarScores: { floral: 15, woody: 100, fresh: 50, oriental: 70, citrus: 20, gourmand: 5 },
    signaturePerfume: PERFUMES["檀道"],
    advancedPerfume: PERFUMES["焚香教堂"],
    budgetPerfume: PERFUMES["非凡雪松"],
    matchingReport: {
      coreMessage: "你的清醒不是冷漠，是你对自己和世界最诚实的态度。",
      personalityAnalysis: "寒岭人格的你习惯用理性保护自己，但内心深处，你比任何人都渴望真正被理解。你的独处不是孤独，是高质量的自我对话。",
      scentPhilosophy: "你讨厌街香，偏爱有故事、有深度的香气。好的香气对你而言，就像一本值得反复重读的书。",
      growthSuggestion: "表达比思考更难，但更有力量。试着用语言分享你的内心世界，真正的连接往往从这里开始。",
    },
  },
  {
    id: "jiaye",
    name: "极夜",
    mbtiAlias: "极致追求型",
    tagline: "要么做到极致，要么不做",
    description: "你对品质有极高的要求，不允许自己平庸。外表可能高冷，但内心燃烧着对完美的执念。",
    scentDirection: "极致优雅：玫瑰+沉香+藏红花，神秘高级有层次",
    radarScores: { floral: 80, woody: 60, fresh: 25, oriental: 100, citrus: 10, gourmand: 10 },
    signaturePerfume: PERFUMES["史诗女士"],
    advancedPerfume: PERFUMES["禁忌之夜"],
    budgetPerfume: PERFUMES["玫瑰初语"],
    matchingReport: {
      coreMessage: "你追求的极致，是对自己最深的尊重。",
      personalityAnalysis: "极夜人格的你做事一丝不苟，对自己对他人都有高标准。你不轻易妥协，因为你知道平庸的代价。",
      scentPhilosophy: "你选香有自己的审美体系，绝不随波逐流。香气是你个人品味的终极表达，每一款用香背后都有完整的思考。",
      growthSuggestion: "学会欣赏不完美。极致是方向，但不必是枷锁。偶尔的放空，是为了走更远的路。",
    },
  },
  {
    id: "licheng",
    name: "砾迹",
    mbtiAlias: "可靠实务型",
    tagline: "说到的，一定做到",
    description: "你是团队最可靠的基石。守时、守信、务实，不说大话，永远在需要时出现。",
    scentDirection: "稳重踏实：木质+香根草，经典不衰的可靠感",
    radarScores: { floral: 20, woody: 95, fresh: 40, oriental: 60, citrus: 50, gourmand: 20 },
    signaturePerfume: PERFUMES["大地"],
    advancedPerfume: PERFUMES["灰色岩兰草"],
    budgetPerfume: PERFUMES["绅士"],
    matchingReport: {
      coreMessage: "你的可靠，是这个时代最稀缺的品质。",
      personalityAnalysis: "砾迹人格的你做事有条不紊，从不让人失望。你的可靠来自于对承诺的极度重视，一旦答应，就一定会做到。",
      scentPhilosophy: "你选香讲究经典与品质，不追求花哨。经典之所以成为经典，是因为它们经过时间验证。",
      growthSuggestion: "适当的灵活性不会削弱你的可靠，反而会让你走得更远。有时候，绕一点路能看到更美的风景。",
    },
  },
  {
    id: "chonglang",
    name: "冲浪",
    mbtiAlias: "活力冒险型",
    tagline: "人生就是用来体验的",
    description: "你是朋友圈里的活力源泉，永远在计划下一场冒险。乐观、积极，生活永远不缺新鲜事。",
    scentDirection: "动感清新：柑橘+芳香+海盐，充满能量感",
    radarScores: { floral: 30, woody: 45, fresh: 95, oriental: 20, citrus: 90, gourmand: 50 },
    signaturePerfume: PERFUMES["Y"],
    advancedPerfume: PERFUMES["动感活力"],
    budgetPerfume: PERFUMES["同名版"],
    matchingReport: {
      coreMessage: "你的热情是最好的社交货币，永远不要丢掉它。",
      personalityAnalysis: "冲浪人格的你有一种天然的感染力，能把平淡的日子变得有趣。你的精力和乐观是天赐的礼物。",
      scentPhilosophy: "你用香喜欢有活力的味道，早上喷一泵，就能点燃一整天。香气是你行动力的延伸。",
      growthSuggestion: "偶尔的深度比持续的广度更有价值。试着在一件事上停留更久，你会发现自己意想不到的深度。",
    },
  },
  {
    id: "wenli",
    name: "温砾",
    mbtiAlias: "热情社交型",
    tagline: "我的快乐，愿意分你一半",
    description: "你是朋友圈里的暖阳，热情好客，善于照顾每个人的情绪。容易满足，也容易感染他人。",
    scentDirection: "温暖甜美：棉花+鼠尾草+柑橘，干净温暖的治愈感",
    radarScores: { floral: 60, woody: 30, fresh: 70, oriental: 25, citrus: 80, gourmand: 65 },
    signaturePerfume: PERFUMES["暖棉"],
    advancedPerfume: PERFUMES["颐和金桂"],
    budgetPerfume: PERFUMES["呵欠"],
    matchingReport: {
      coreMessage: "你的温暖不需要理由，它就是你最真实的模样。",
      personalityAnalysis: "温砾人格的你是天然的照顾者，总能注意到别人忽略的细节。你的善意不是刻意的，是本能。",
      scentPhilosophy: "你选香偏好舒适自然的味道，不喜欢攻击性太强的香气。你相信香气应该让人感到安心，而不是被审视。",
      growthSuggestion: "学会照顾自己。给别人的暖，也要记得留一份给自己。",
    },
  },
  {
    id: "konghao",
    name: "空号",
    mbtiAlias: "极简思考型",
    tagline: "少即是多，多即是乱",
    description: "你追求极简和本质，对无意义的社交和物质有天然的抗拒。低调、深沉，喜欢有深度的对话。",
    scentDirection: "极简冷感：Aesop+雪松+焚香，禁欲克制有文化感",
    radarScores: { floral: 20, woody: 80, fresh: 55, oriental: 65, citrus: 25, gourmand: 5 },
    signaturePerfume: PERFUMES["息间之美"],
    advancedPerfume: PERFUMES["冷山"],
    budgetPerfume: PERFUMES["白苔"],
    matchingReport: {
      coreMessage: "你的极简不是无趣，是你最深刻的审美宣言。",
      personalityAnalysis: "空号人格的你在信息爆炸的时代保持清醒，对噪音有天然的免疫力。你的思考深度远超同龄人。",
      scentPhilosophy: "你用香不为吸引他人，而是表达自我。你相信香气是最私密的语言，不需要解释。",
      growthSuggestion: "适度的社交连接不会打扰你的极简生活。真正的深度，有时候来自与不同人的对话。",
    },
  },
  {
    id: "lengyan",
    name: "冷砚",
    mbtiAlias: "审美艺术型",
    tagline: "我对美，有自己的标准",
    description: "你有极高的审美品味，安静但有力量。不随大流，对品质和美感有近乎苛刻的要求。",
    scentDirection: "艺术优雅：晚香玉+鸢尾+玫瑰，柔美中有清冷",
    radarScores: { floral: 95, woody: 50, fresh: 45, oriental: 50, citrus: 30, gourmand: 25 },
    signaturePerfume: PERFUMES["杜桑"],
    advancedPerfume: PERFUMES["月亮女人"],
    budgetPerfume: PERFUMES["紫罗兰心事"],
    matchingReport: {
      coreMessage: "你的审美直觉，是最珍贵的资产，不要让任何人说服你放弃它。",
      personalityAnalysis: "冷砚人格的你对美有本能的敏感，能在别人忽略的地方发现独特的价值。你的审美是你看世界的方式。",
      scentPhilosophy: "你选香会先问自己：这款香能不能代表我？你不允许香气是随机的，它必须是有意义的。",
      growthSuggestion: "美不只是用来欣赏的，也可以用来疗愈和连接。试着把你的审美世界，分享给值得的人。",
    },
  },
  {
    id: "yuanhai",
    name: "渊海",
    mbtiAlias: "战略深邃型",
    tagline: "我有我的节奏，不解释",
    description: "你是长期主义者，不在乎短期波动。思维深邃，视野宏观，能在别人看不到的地方看到未来。",
    scentDirection: "深邃高阶：檀木33+玫瑰+皮革，小众精英感",
    radarScores: { floral: 60, woody: 100, fresh: 30, oriental: 85, citrus: 10, gourmand: 10 },
    signaturePerfume: PERFUMES["檀道33"],
    advancedPerfume: PERFUMES["深邃之红"],
    budgetPerfume: PERFUMES["冷杉之林"],
    matchingReport: {
      coreMessage: "你的深度，是这个浅薄时代最珍贵的远见。",
      personalityAnalysis: "渊海人格的你有极强的洞察力，能在复杂的信息中找到本质规律。你习惯从宏观视角思考，不被短期噪音干扰。",
      scentPhilosophy: "你选香像选战略合作伙伴——要经得起时间考验，要足够深刻，能陪伴你的成长。",
      growthSuggestion: "微观世界的温度，有时比宏观更有意义。学会从具体的人和事中，感受生命的质感。",
    },
  },
  {
    id: "chenwan",
    name: "沉湾",
    mbtiAlias: "细腻感受型",
    tagline: "我感受得到你感受不到的",
    description: "你对细节有超乎常人的感知力。敏感但不脆弱，能在别人忽略的地方，发现极致的美。",
    scentDirection: "文艺细腻：纸纹+玫瑰+紫罗兰，文艺气质独特小众",
    radarScores: { floral: 80, woody: 60, fresh: 50, oriental: 40, citrus: 25, gourmand: 30 },
    signaturePerfume: PERFUMES["纸纹"],
    advancedPerfume: PERFUMES["复古传奇"],
    budgetPerfume: PERFUMES["花花小姐"],
    matchingReport: {
      coreMessage: "你的敏感是你最大的天赋，请像保护眼睛一样保护它。",
      personalityAnalysis: "沉湾人格的你拥有极强的感受力，能捕捉到生活中最细微的美好。这种敏感是你创作力和共情力的源泉。",
      scentPhilosophy: "你选香重视触感和氛围，喜欢那些能唤起特定记忆的香气。对你而言，好的香气是一个故事的开始。",
      growthSuggestion: "敏感不等于脆弱。你的感受力是超能力，只要学会在需要时打开，不需要时适度关闭。",
    },
  },
  {
    id: "shuangleng",
    name: "霜冷",
    mbtiAlias: "沉稳可靠型",
    tagline: "该扛的，从不逃避",
    description: "你是那种让人放心把后背交给他的人。务实、可靠，默默承担，不邀功，不解释。",
    scentDirection: "清爽沉稳：雪松+薰衣草+木质，干净清爽有男子气概",
    radarScores: { floral: 20, woody: 85, fresh: 70, oriental: 50, citrus: 60, gourmand: 15 },
    signaturePerfume: PERFUMES["蔚蓝"],
    advancedPerfume: PERFUMES["成功"],
    budgetPerfume: PERFUMES["雪松荒野"],
    matchingReport: {
      coreMessage: "你的可靠不需要被看见，它的力量在于持续的陪伴。",
      personalityAnalysis: "霜冷人格的你是团队中最稳定的那个存在。你的可靠来自于对责任的担当，不说漂亮话，只做实在事。",
      scentPhilosophy: "你用香追求清爽不油腻，适合每一天，不需要理由的舒适感就是最好的日常香。",
      growthSuggestion: "表达情绪不是软弱，它是人与人之间最真实的连接。试着说出你的感受，而不是总用行动代替语言。",
    },
  },
  {
    id: "huangyuan",
    name: "荒原",
    mbtiAlias: "理想追寻型",
    tagline: "我内心有一片，没人到过的旷野",
    description: "你有理想主义的火焰，不愿意妥协于现实。敏感、浪漫，永远在追寻某种更纯粹的东西。",
    scentDirection: "诗意自然：玫瑰+黑醋栗+木质，空灵浪漫有诗意",
    radarScores: { floral: 85, woody: 55, fresh: 65, oriental: 55, citrus: 35, gourmand: 45 },
    signaturePerfume: PERFUMES["影中之水"],
    advancedPerfume: PERFUMES["马拉喀什"],
    budgetPerfume: PERFUMES["紫繁花"],
    matchingReport: {
      coreMessage: "你的理想主义不是天真，是你对这个世界的最深的期待。",
      personalityAnalysis: "荒原人格的你有颗赤子之心，不愿意妥协于不完美。你的敏感让你看见别人看不见的东西，也让你比任何人都更努力去改变。",
      scentPhilosophy: "你选香追求诗意，喜欢那些能带你逃离现实、进入另一个世界的香气。香水是你的任意门。",
      growthSuggestion: "理想主义和现实并不矛盾。用你的浪漫感染世界，同时学会在现实中找到立足点。",
    },
  },
  {
    id: "jinsheng",
    name: "烬生",
    mbtiAlias: "温柔力量型",
    tagline: "外表柔软，内心有火",
    description: "你是那种让人越相处越喜欢的人才。外表温柔得体，内心有自己的坚持，不张扬但有力量。",
    scentDirection: "精致治愈：棉麻+玫瑰+白茶，精致干净有治愈感",
    radarScores: { floral: 70, woody: 55, fresh: 60, oriental: 40, citrus: 45, gourmand: 50 },
    signaturePerfume: PERFUMES["纯白棉麻"],
    advancedPerfume: PERFUMES["肌肤之弦"],
    budgetPerfume: PERFUMES["桂花引"],
    matchingReport: {
      coreMessage: "你的温柔是最被低估的力量，它能融化这个世界最坚硬的东西。",
      personalityAnalysis: "烬生人格的你拥有最难得的品质：温柔但不软弱。你的柔软是有根基的，来自内心深处的稳定和力量。",
      scentPhilosophy: "你选香偏好精致但不张扬的香气，像一杯刚好温度的白茶——不烫不凉，一切刚刚好。",
      growthSuggestion: "你的温柔是天赋，但不要让它成为别人得寸进尺的理由。学会优雅地说不，是成熟的开始。",
    },
  },
];

// ============================================================
// 问卷题目（10道情境向量题）
// ============================================================

export interface Question {
  id: number;
  scenario: string;       // 情境描述
  situation: string;      // 当前处境
  options: {
    label: string;        // 选项标签
    // 6维向量: [floral, woody, fresh, oriental, citrus, gourmand]
    vector: [number, number, number, number, number, number];
    followUp?: string;    // 追问（可选）
  }[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    scenario: "你独自旅行，来到一个陌生小镇。天色渐暗，你：",
    situation: "探索中",
    options: [
      { label: "钻进一家local小酒馆，听现场爵士乐", vector: [40, 30, 60, 50, 20, 70] },
      { label: "找一家安静的独立书店，翻翻当地的诗集", vector: [20, 70, 30, 60, 10, 20] },
      { label: "随意走进一家有香气的咖啡馆，融入当地生活", vector: [50, 20, 70, 20, 60, 80] },
      { label: "找个有故事的老人聊天，听他讲这个镇的传奇", vector: [30, 90, 20, 70, 10, 10] },
    ],
  },
  {
    id: 2,
    scenario: "朋友约你周末聚会，但你这周已经精疲力尽。你：",
    situation: "疲惫状态",
    options: [
      { label: "去，但提前声明待一会儿就走", vector: [60, 30, 50, 30, 50, 40] },
      { label: "直接拒绝，在家安静地度过周末", vector: [20, 80, 40, 60, 15, 15] },
      { label: "提议改成一个人少的活动，只约一个最想见的朋友", vector: [40, 50, 60, 40, 40, 30] },
      { label: "去吧！社交能充电，去了反而精神更好", vector: [30, 20, 80, 20, 80, 50] },
    ],
  },
  {
    id: 3,
    scenario: "你要买一瓶香水送给自己。预算不限，你最可能：",
    situation: "选香时刻",
    options: [
      { label: "先去专柜试闻10款，再慢慢缩小范围", vector: [50, 60, 50, 50, 50, 30] },
      { label: "直接买那款你惦记了很久的，不犹豫", vector: [40, 50, 40, 80, 20, 20] },
      { label: "买大家都说好、最不容易出错的那款", vector: [60, 40, 60, 30, 60, 50] },
      { label: "什么都不买，把钱花在一顿难忘的饭上", vector: [30, 30, 50, 40, 40, 90] },
    ],
  },
  {
    id: 4,
    scenario: "你走进一家书店，只考虑买一本书。你会选：",
    situation: "阅读偏好",
    options: [
      { label: "一本关于宇宙和人类未来的科普书", vector: [10, 40, 60, 50, 30, 10] },
      { label: "一本细腻的散文集，关于季节和生活的感受", vector: [70, 50, 40, 40, 20, 30] },
      { label: "一本心理学的深度研究，关于人格与动机", vector: [30, 70, 30, 70, 10, 10] },
      { label: "一本旅行文学，写那些你此生想去的地方", vector: [50, 50, 70, 40, 50, 50] },
    ],
  },
  {
    id: 5,
    scenario: "一个你很在意的人送了你一瓶香水作为礼物，但你觉得味道不适合你。你会：",
    situation: "礼物困境",
    options: [
      { label: "开心地收下，并真诚感谢这份心意", vector: [70, 40, 50, 40, 50, 50] },
      { label: "收下，但会跟对方坦诚聊一下你平时喜欢的香气", vector: [50, 60, 50, 50, 50, 30] },
      { label: "礼貌地收下，然后把它放在柜子深处", vector: [30, 50, 40, 60, 30, 30] },
      { label: "直接说：谢谢，但我平时不太用这款香气", vector: [30, 70, 50, 50, 40, 20] },
    ],
  },
  {
    id: 6,
    scenario: "描述一下你理想的清晨：",
    situation: "生活节奏",
    options: [
      { label: "被阳光唤醒，拉开窗帘，然后手冲一杯咖啡", vector: [30, 40, 70, 40, 60, 50] },
      { label: "自然醒，喝一杯温水，在笔记本上写几句话", vector: [40, 60, 50, 50, 30, 20] },
      { label: "早起跑步，汗流浃背后的清爽淋浴", vector: [20, 40, 95, 10, 70, 20] },
      { label: "睡到自然醒，不设闹钟，享受无计划的早晨", vector: [60, 30, 60, 30, 50, 60] },
    ],
  },
  {
    id: 7,
    scenario: "你在职场中，最常扮演的角色是：",
    situation: "职场身份",
    options: [
      { label: "那个总是把团队凝聚在一起的人", vector: [60, 40, 60, 30, 70, 40] },
      { label: "那个总能在关键时刻拿出最优解的人", vector: [20, 80, 50, 70, 30, 20] },
      { label: "那个安静但每句话都很有分量的人", vector: [30, 90, 30, 70, 15, 15] },
      { label: "那个给团队带来活力和创意的人", vector: [50, 30, 80, 20, 80, 60] },
    ],
  },
  {
    id: 8,
    scenario: "你搬家到一个新城市，只能带三样东西。你会带：",
    situation: "取舍观",
    options: [
      { label: "一本书、一杯咖啡、一张朋友的全家福", vector: [60, 50, 50, 50, 40, 60] },
      { label: "笔记本、一支好笔、一个安静的角落", vector: [20, 80, 40, 60, 20, 20] },
      { label: "跑鞋、户外装备、一颗想出发的心", vector: [20, 40, 90, 10, 60, 30] },
      { label: "香氛蜡烛、艺术品、一套精致的餐具", vector: [70, 50, 40, 50, 30, 70] },
    ],
  },
  {
    id: 9,
    scenario: "你的朋友这样形容你：",
    situation: "社交镜像",
    options: [
      { label: "「和他在一起很舒服，什么都可以聊」", vector: [60, 50, 60, 40, 60, 50] },
      { label: "「很有自己的想法，从不随波逐流」", vector: [20, 80, 40, 70, 20, 20] },
      { label: "「像一本读不完的书，越读越有趣」", vector: [50, 70, 50, 60, 30, 30] },
      { label: "「有他在的地方，永远不会冷场」", vector: [50, 30, 80, 20, 80, 60] },
    ],
  },
  {
    id: 10,
    scenario: "你决定给自己买一件贵一点的物品。你会买：",
    situation: "消费观",
    options: [
      { label: "一件能穿十年的经典款大衣", vector: [30, 70, 40, 60, 30, 20] },
      { label: "一瓶你真正喜欢的好香水", vector: [50, 60, 50, 70, 40, 40] },
      { label: "一次难忘的旅行体验", vector: [50, 40, 70, 40, 60, 60] },
      { label: "一台可以用很久的好设备", vector: [20, 60, 60, 40, 40, 20] },
    ],
  },
  {
    id: 11,
    scenario: "你独处时，最常做的事：",
    situation: "独处方式",
    options: [
      { label: "听音乐，调一杯酒，享受安静", vector: [50, 60, 50, 70, 30, 60] },
      { label: "看书、看电影，沉浸在另一个世界里", vector: [40, 50, 60, 50, 30, 40] },
      { label: "出去走走，城市漫步或者近郊徒步", vector: [30, 50, 90, 30, 60, 30] },
      { label: "在家做一顿好吃的，认真对待每一餐", vector: [40, 40, 60, 40, 50, 90] },
    ],
  },
  {
    id: 12,
    scenario: "你想象自己最理想的居住空间，它是：",
    situation: "理想空间",
    options: [
      { label: "城市中心的高层公寓，有大落地窗能看到整座城市", vector: [30, 60, 60, 50, 50, 30] },
      { label: "郊外的独立小房子，带花园，种满香草和花", vector: [80, 60, 70, 30, 60, 50] },
      { label: "山里的小木屋，简洁、安静，四周是森林", vector: [20, 90, 60, 50, 30, 20] },
      { label: "一个开放工作室，随时可以创作和招待朋友", vector: [50, 50, 70, 40, 60, 60] },
    ],
  },
];

// ============================================================
// 匹配算法
// ============================================================

export interface MatchResult {
  personalityType: PersonalityType;
  scores: { [dimension: string]: number };
  topPerfumes: Perfume[];
  unlockedPerfumes: number; // 0, 1, 2, or 3
}

export function calculateMatch(answers: number[][], unlockLevel: number): MatchResult {
  // 汇总6维向量
  const totalVector = answers.reduce(
    (acc, ans) => {
      acc[0] += ans[0]; // floral
      acc[1] += ans[1]; // woody
      acc[2] += ans[2]; // fresh
      acc[3] += ans[3]; // oriental
      acc[4] += ans[4]; // citrus
      acc[5] += ans[5]; // gourmand
      return acc;
    },
    [0, 0, 0, 0, 0, 0]
  );

  // 归一化到 0-100
  const max = Math.max(...totalVector);
  const scores = {
    floral: Math.round((totalVector[0] / max) * 100),
    woody: Math.round((totalVector[1] / max) * 100),
    fresh: Math.round((totalVector[2] / max) * 100),
    oriental: Math.round((totalVector[3] / max) * 100),
    citrus: Math.round((totalVector[4] / max) * 100),
    gourmand: Math.round((totalVector[5] / max) * 100),
  };

  // 找最匹配的人格（基于雷达图相似度）
  let bestMatch = PERSONALITY_TYPES[0];
  let bestSimilarity = -1;

  for (const p of PERSONALITY_TYPES) {
    const s = [
      p.radarScores.floral,
      p.radarScores.woody,
      p.radarScores.fresh,
      p.radarScores.oriental,
      p.radarScores.citrus,
      p.radarScores.gourmand,
    ];
    // 余弦相似度
    const dot = totalVector.reduce((d, v, i) => d + v * s[i], 0);
    const mag1 = Math.sqrt(totalVector.reduce((m, v) => m + v * v, 0));
    const mag2 = Math.sqrt(s.reduce((m, v) => m + v * v, 0));
    const similarity = mag1 > 0 && mag2 > 0 ? dot / (mag1 * mag2) : 0;
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = p;
    }
  }

  return {
    personalityType: bestMatch,
    scores,
    topPerfumes: [
      bestMatch.signaturePerfume,
      bestMatch.advancedPerfume,
      bestMatch.budgetPerfume,
    ],
    unlockedPerfumes: unlockLevel,
  };
}
