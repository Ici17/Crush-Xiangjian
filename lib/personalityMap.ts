// ============================================================
// 香水 → 人格映射表
// 基于余弦相似度自动分配（scripts/assign_personalities.ts）
// ============================================================

export const PERFUME_PERSONALITY_MAP: Record<string, string> = {
  "蓝风铃": "lengyan",
  "英国梨与小苍兰": "lengyan",
  "碧海蓝": "chonglang",
  "光晕": "canwen",
  "雨后花园": "shuangleng",
  "流浪者之歌": "liean",
  "水中影": "konghao",
  "冷水": "konghao",
  "光影": "huangyuan",
  "白苔": "shuangleng",
  "白茶-祖玛珑": "shuangleng",
  "暖暖椰奶": "huangdao",
  "真我": "lengyan",
  "可可小姐": "canwen",
  "花悦": "lengyan",
  "黑鸦片": "canwen",
  "好事成双": "jinsheng",
  "花之秘境": "canwen",
  "克洛伊": "anliu",
  "爱情故事": "licheng",
  "花宫娜": "lengyan",
  "紫丁香": "jiaye",
  "大地": "licheng",
  "乌木沉香": "liean",
  "蔚蓝": "konghao",
  "旷野": "hanling",
  "墨恋": "hanling",
  "冥府之路": "liean",
  "超级雪松": "yuanhai",
  "檀木33": "yuanhai",
  "灰烬": "liean",
  "墨水-川久保玲": "liean",
  "一千零一夜": "canwen",
  "琥珀君王": "liean",
  "华丽之夜": "jiaye",
  "沙漠孤烟": "liean",
  "极致琥珀": "jiaye",
  "烟草香草": "liean",
  "红香": "jiaye",
  "罂粟": "jiaye",
  "香道": "liean",
  "壁炉火光": "hanling",
  "天使": "wenli",
  "毒药": "jinsheng",
  "粉色甜品": "wenli",
  "初恋": "canwen",
  "黑幽灵": "jinsheng",
  "蜂蜜乌木": "jiaye",
  "巧克力梦": "canwen",
  "牛奶": "jinsheng",
  "白晶": "konghao",
  "安娜苏": "chenwan",
  "赤霞橘光": "canwen",
  "沁蓝": "chonglang",
  "海盐柠檬": "shuangleng",
  "格调": "shuangleng",
  "西柚天堂": "huangdao",
  "红结晶": "liean",
  "不朽之花": "anliu",
  "香柠檬": "canwen",
  "自由之水": "chenwan",
};

/**
 * 获取某人格下的推荐 extra 香水列表
 */
export function getExtraPerfumesForPersonality(personalityId: string): string[] {
  return Object.entries(PERFUME_PERSONALITY_MAP)
    .filter(([, pid]) => pid === personalityId)
    .map(([perfumeId]) => perfumeId);
}

/**
 * 获取某香水的归属人格
 */
export function getPersonalityForPerfume(perfumeId: string): string | undefined {
  return PERFUME_PERSONALITY_MAP[perfumeId];
}
