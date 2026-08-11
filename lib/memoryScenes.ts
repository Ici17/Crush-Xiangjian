/**
 * 令人心动的记忆点 · 16 人格数据
 *
 * 结构：
 *   memory  — 香气唤起的记忆画面（第二人称，克制，情绪流）
 *   top     — 前调（来自 SCENT_BLUEPRINTS）
 *   heart   — 中调
 *   base    — 后调
 *   insight — 人格洞察（第二人称，锐利，不讨好）
 */

export type MemoryScene = {
  memory: string;   // 记忆画面，20-35 字
  top: string;      // 前调
  heart: string;    // 中调
  base: string;     // 后调
  insight: string;  // 人格洞察，15-28 字
};

const MEMORY_SCENES: Record<string, MemoryScene> = {
  暗流: {
    memory: '你习惯最后一个离开，关灯前站了一会儿',
    top: '佛手柑 · 绿茶',
    heart: '玫瑰 · 鸢尾',
    base: '雪松 · 檀木 · 白麝香',
    insight: '你从不解释自己的安静，因为解释也是一种暴露。',
  },
  荒岛: {
    memory: '出发的清晨，行李箱拉链卡住，你笑了',
    top: '柑橘 · 海盐',
    heart: '无花果 · 橙花',
    base: '雪松 · 龙涎香',
    insight: '你永远在出发，其实最怕被困在重复里。',
  },
  残温: {
    memory: '你递完那杯水才意识到，自己其实也渴',
    top: '橙花 · 梨',
    heart: '白茉莉 · 鸢尾',
    base: '白麝香 · 香草',
    insight: '你的温暖有时是在填补自己没被接住的时刻。',
  },
  裂岸: {
    memory: '凌晨两点的会议室，你一个人站了很久',
    top: '黑胡椒 · 佛手柑',
    heart: '檀香 · 皮革',
    base: '乌木 · 琥珀',
    insight: '你指挥若定，是因为怕一旦松手就没人接。',
  },
  寒岭: {
    memory: '雪山上，风吹过来，你没躲',
    top: '薄荷 · 杜松',
    heart: '焚香 · 丝柏',
    base: '雪松 · 岩兰草',
    insight: '你用逻辑筑墙，是因为情绪一旦决堤就收不回。',
  },
  极夜: {
    memory: '你在人群里突然安静，像一盏灯被关掉',
    top: '粉红胡椒 · 覆盆子',
    heart: '大马士革玫瑰 · 藏红花',
    base: '沉香 · 广藿香',
    insight: '你对完美的执念，是对平庸被看见的恐惧。',
  },
  砾迹: {
    memory: '你做完所有的事，才允许自己停下来',
    top: '葡萄柚 · 薄荷',
    heart: '香根草 · 鼠尾草',
    base: '木质 · 苔藓',
    insight: '你是所有人的基石，却很少被人问"你还好吗"。',
  },
  冲浪: {
    memory: '你又换了一个场景，因为安静下来要面对一个问题',
    top: '柠檬 · 海盐',
    heart: '芳香草本 · 橙花',
    base: '雪松 · 龙涎香',
    insight: '活力是你的避难所，不是你本来的样子。',
  },
  温砾: {
    memory: '你替所有人接住了情绪，唯独漏掉了自己',
    top: '柑橘 · 荔枝',
    heart: '棉花 · 鼠尾草',
    base: '麝香 · 檀木',
    insight: '热情是让你不被抛下的方式，不是你的负担。',
  },
  空号: {
    memory: '你删掉了那行字，然后把手机放到一边',
    top: '佛手柑 · 青草',
    heart: '雪松 · 纸莎草',
    base: '焚香 · 檀木',
    insight: '极简是你重建的秩序，不是你不在乎。',
  },
  冷砚: {
    memory: '你盯着那只杯子看了很久，它的弧度让你舒服',
    top: '梨 · 紫罗兰叶',
    heart: '晚香玉 · 鸢尾',
    base: '玫瑰 · 檀木',
    insight: '你对美的苛刻，是对"将就"的生理性排斥。',
  },
  渊海: {
    memory: '你说完那句话，没等回应就转身走了',
    top: '佛手柑 · 粉红胡椒',
    heart: '玫瑰 · 皮革',
    base: '檀木 · 烟草',
    insight: '你不解释，是因为多数人听不懂，听懂的人不用你解释。',
  },
  沉湾: {
    memory: '你感受到空气里有什么变了，但说不出来',
    top: '紫罗兰 · 梨',
    heart: '玫瑰 · 纸莎草',
    base: '檀木 · 麝香',
    insight: '你的感知力太强，常常替别人承受了还没说出口的情绪。',
  },
  霜冷: {
    memory: '你把事情默默做好，等人来发现',
    top: '薰衣草 · 薄荷',
    heart: '雪松 · 鼠尾草',
    base: '木质 · 琥珀',
    insight: '可靠是你不敢卸下的壳，不是你不需要依靠。',
  },
  荒原: {
    memory: '你在书里读到一句，像是在说自己的童年',
    top: '黑醋栗 · 佛手柑',
    heart: '玫瑰 · 天竺葵',
    base: '木质 · 香草',
    insight: '浪漫是你对现实的温柔叛逃，不是逃避。',
  },
  烬生: {
    memory: '那团火你留给真正懂的人，他们知道在哪里',
    top: '白茶 · 荔枝',
    heart: '玫瑰 · 棉麻',
    base: '檀木 · 麝香',
    insight: '你温柔得体，是怕冲突撕破关系，不是不在意。',
  },
};

const FALLBACK = MEMORY_SCENES['暗流'];

export function getMemoryScene(name: string): MemoryScene {
  return MEMORY_SCENES[name] ?? FALLBACK;
}
