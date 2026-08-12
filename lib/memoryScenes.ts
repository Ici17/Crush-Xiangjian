/**
 * 专属记忆点 · 动态生成引擎 v3
 *
 * 动态输入：人格特质 + 匹配香水（品牌 + 香调族 + 香水名）
 * 输出：自由叙事，多变体，不同人格同一品牌也各不相同。
 *
 * v3 改进：
 *   1. 同一个品牌不同人格 → 多支变体池，personality 特性决定选哪个变体和具体措辞
 *   2. 场景 → 基于香调族的精确氛围，不是随机抽
 *   3. 去除拼接感 → 每个变体是一段完整叙事，不是 opener+scene+anchor+closer
 */

import { PERSONALITIES } from './personalities';

export type MemoryScene = { description: string };
export type PerfumeSnapshot = {
  name: string;
  brand: string;
  notesStructured: { top: string[]; heart: string[]; base: string[] };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 香调 → 氛围
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function classifyNote(note: string): string {
  const n = note.toLowerCase();
  if (n.includes('玫瑰') || n.includes('rose') || n.includes('鸢尾') || n.includes('iris') || n.includes('紫罗兰') || n.includes('violet')) return 'rose';
  if (n.includes('沉香') || n.includes('乌木') || n.includes('oud') || n.includes('agar')) return 'oud';
  if (n.includes('檀') || n.includes('sandal')) return 'sandalwood';
  if (n.includes('柑橘') || n.includes('柠檬') || n.includes('佛手柑') || n.includes('bergamot') || n.includes('citrus') || n.includes('橙') || n.includes('葡萄柚') || n.includes('lime')) return 'citrus';
  if (n.includes('茉莉') || n.includes('晚香玉') || n.includes('橙花') || n.includes('栀子') || n.includes('tuberose') || n.includes('jasmine') || n.includes('neroli')) return 'white_flower';
  if (n.includes('海') || n.includes('海洋') || n.includes('盐') || n.includes('marine') || n.includes('sea')) return 'marine';
  if (n.includes('焚香') || n.includes('乳香') || n.includes('没药') || n.includes('incense') || n.includes('frankincense') || n.includes('myrrh') || n.includes('纸') || n.includes('paper')) return 'incense';
  if (n.includes('琥珀') || n.includes('amber') || n.includes('香草') || n.includes('vanilla') || n.includes('椰子') || n.includes('coconut') || n.includes('零陵香豆') || n.includes('tonka')) return 'amber';
  if (n.includes('皮革') || n.includes('leather') || n.includes('胡椒') || n.includes('pepper') || n.includes('花椒') || n.includes('小豆蔻') || n.includes('cardamom') || n.includes('肉桂') || n.includes('cinnamon') || n.includes('丁香') || n.includes('clove')) return 'leather';
  if (n.includes('麝香') || n.includes('musk')) return 'musk';
  if (n.includes('叶') || n.includes('草') || n.includes('绿') || n.includes('苔') || n.includes('grass') || n.includes('leaf') || n.includes('moss') || n.includes('无花果')) return 'green';
  if (n.includes('木') || n.includes('雪松') || n.includes('香根草') || n.includes('cedar') || n.includes('vetiver') || n.includes('pine') || n.includes('birch') || n.includes('广藿香') || n.includes('patchouli')) return 'woody';
  return 'woody';
}

function getDominantMoodKey(notes: { top: string[]; heart: string[]; base: string[] }): string {
  const allNotes = [...(notes.top || []), ...(notes.heart || []), ...(notes.base || [])];
  const scores: Record<string, number> = {};
  for (const n of allNotes) {
    const k = classifyNote(n);
    scores[k] = (scores[k] || 0) + 1;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'woody';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 品牌 × 人格 叙事生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type StoryFn = (ctx: {
  personality: string;         // 人格名（暗流/荒岛…）
  description: string;        // 人格描述
  direction: string;          // 人格方向（如"克制的优雅（木质+玫瑰）"）
  moodKey: string;            // 主导香调族
  perfume: string;            // 香水名（用于意象，不提品牌名）
}) => string;

// ━━ 品牌叙事池（每个品牌 5-6 支变体，覆盖不同气质）━━

const BYREDO: StoryFn[] = [
  // 1. 安静重感
  (p) => `你身上的气息是克制的——像深夜里亮着的那盏灯，不招惹谁，却让人忍不住回头。不是疏离，是你选择性地被看见。懂的人停下来，不懂的人路过了。都很好。`,
  // 2. 等待被发现的
  (p) => `那些一闻就想靠近的人，多半吵。你不是。你把好东西藏在很里面——不是不给，是等那个愿意走近的人自己发现。`,
  // 3. 不急着被记住
  (p) => `你不急着被记住。像一个人站在人群之外，不伸手，不喊话。但一旦靠近——那种安静的重量，就再也忘不掉。`,
  // 4. 沉静力量
  (p) => `不是所有人都需要被马上看见。你的存在感不是靠音量——是靠安静。在那种安静里，有一种不肯妥协的倔。`,
  // 5. 北欧阳诗意
  (p) => `像北欧冬夜里亮着的那扇窗。你不等谁来，也不为谁改变。有人路过，有人停下，你始终是你——一个让人想一直望着的人。`,
];

const TOM_FORD: StoryFn[] = [
  // 1. 掌控格局
  (p) => `你在场，空气就会安静。不是声音大——是你身上有一种压得住场的东西。沉，不是重。是那种不用解释的底气。`,
  // 2. 沉默定价
  (p) => `你不说太多——但你说过的，都不浪费。那种不怒自威的力量，不是学来的，是骨子里的。要靠近的人很多，敢靠近的没几个。`,
  // 3. 不乱于众
  (p) => `混乱里你是唯一不晃的那一点。不是因为你比别人聪明——是因为你比别人清楚自己要什么。这世上大多数犹豫，你早就跨过去了。`,
  // 4. 性感权力
  (p) => `退后半步，比多数人往前十步都有分量。这种分寸感是一种高级的性感——不是谁都接得住你，你也懒得等。`,
];

const YSL: StoryFn[] = [
  // 1. 反叛不羁
  (p) => `规矩是写给听话的人的。你没打算被归类——那种懒得的自由，是一种安静的叛逆。有人总想让你靠岸，你还在浪上。`,
  // 2. 自我主权
  (p) => `你身上的自由不是喊出来的，是做的。不是不懂体面，是懒得配合剧本。活着不难——按自己的方式活着，很难。你做到了。`,
  // 3. 不设限
  (p) => `那些教你怎么做的声音，你早就关了。不是赌气，是知道自己的方向。风到你身边，都会变亮一点。`,
];

const LE_LABO: StoryFn[] = [
  // 1. 三层叙事
  (p) => `你不像一眼看完的书。第一层是好闻，第二层是沉稳，翻到第三层——才发现那些不轻易交出的东西。多数人停在第一层，你没留他们。`,
  // 2. 冷静温度
  (p) => `你把清醒调成了一种味道。不是冷，是不随便给温度。但坐下来的人会慢慢发现——那种清冷底下，是一种很深的、不声张的温柔。`,
  // 3. 藏得好
  (p) => `你的深度，是种不需要证明的东西。有些人在你面前很吵——你安静地听着，什么也不说。不是没话，是知道真正重要的东西，不用解释。`,
  // 4. 都市手工
  (p) => `像凌晨的工作室里，只有灯和自己。那种专注不是孤独，是你跟自己相处的方式。懂的人坐下就不走了——他们闻到了同类的气息。`,
];

const HERMES: StoryFn[] = [
  // 1. 低调奢侈
  (p) => `你不炫——但谁都知道东西放你这儿不会丢。那种不声张的好，是手艺人才有的耐心。好品味不是让所有人知道，是让对的人知道。`,
  // 2. 越久越暖
  (p) => `你像一块被人坐了很多年的老木桌，越旧越暖。不抢眼，但谁都认得那种质感。不是不耀眼——是不需要靠耀眼来证明什么。`,
  // 3. 人本匠心
  (p) => `可靠——是你最不费力的事。所有人都倚靠的基石，很少被问一句「你还好吗」。但其实我们都知道：稳的人，往往替别人扛得最多。`,
];

const DIPTYQUE: StoryFn[] = [
  // 1. 左岸审美
  (p) => `你对美有种近乎任性的讲究，像左岸那间不肯投降的画廊——冷，且骄傲。可走近了才发现底下是烫的。将就这两个字，你从不认识。`,
  // 2. 文艺叙事
  (p) => `你身上有种纸墨的文气。不是刻意文艺——是天然地比别人多一层敏感。风一吹你先听见，话没说你先懂。`,
  // 3. 不取悦世界
  (p) => `不取悦世界，是你对自己最大的尊重。你的浪漫不是张灯结彩的那种——是月光落在水面上，看得见、捞不起，却让人一直望着。`,
  // 4. 安静浪漫
  (p) => `你知道什么是好的，便再也回不去了。不是挑剔，是见过美之后，不忍心辜负自己。那种安静的力量，是另一种形式的勇敢。`,
  // 5. 自然诗意
  (p) => `像雨后植物园的风，和着一种说不清的清新——不是刻意为之，是本来就该这样。你的特别，不来自你做了什么，来自你是什么。`,
];

const CHANEL: StoryFn[] = [
  // 1. 经典体面
  (p) => `你的好，是老派的体面——不吼不叫，分寸刚好。不是那种一进门就震住全场的人。你是那种走了之后，全场都在找的人。`,
  // 2. 不费力
  (p) => `什么都不多，什么都不缺。清爽是种底气，不是装出来的。体面不是穿给别人看的——是你给自己的交代。`,
  // 3. 安静地贵
  (p) => `懂的人一看就懂。不懂的人教也教不会。你从不在聚光灯下抢位置——但聚光灯亮的时候，人人都知道你该站在那里。`,
];

const AESOP: StoryFn[] = [
  // 1. 留白
  (p) => `你删掉那行字，把手机放到一边。不是空——是给真正重要的东西留出位置。干净不是目的，是你为自己重建的秩序。`,
  // 2. 少但都对
  (p) => `别人在加，你在减。减到只剩本质——少，但每样都对。极简不是不在乎，是在乎到了极致。`,
  // 3. 智性克制
  (p) => `多余的、吵的、假的东西——你比谁都先察觉到。然后删掉。这不是冷淡，是你对生活的态度：只留真的，只留对的。`,
];

const MFK: StoryFn[] = [
  // 1. 肌肤感
  (p) => `你不是那种出门前要想很久的人——穿什么，什么就像长在你身上。精致但不刻意。最好的味道，是让人忘了你喷过什么，只记得你。`,
  // 2. 不争不抢
  (p) => `不争不抢，却让人一直想靠近。不是没有存在感，是那种「闻起来像自己，但更好」的舒服。有些人穿香，你——把香气穿成了自己。`,
  // 3. 柔软坚定
  (p) => `温柔不是弱点，是你选的方式。像晒过太阳的棉麻——软，却有骨子里的干净。那种舒服，不是退让，是你给这个世界的温度。`,
];

const JO_MALONE: StoryFn[] = [
  // 1. 随时出发
  (p) => `你总在收拾行李，哪怕只是去楼下。那种轻松不是没负担——是把负担留给了那个还不想停下的自己。自由的人，也渴望被一个人找到。`,
  // 2. 夏天感
  (p) => `像夏天傍晚踩着还温着的石板。风把你往哪儿吹，你就去哪儿——不是没方向，是方向不重要。你不是在逃，是还在找那个能让你停下来的地方。`,
];

const AMOUAGE: StoryFn[] = [
  // 1. 极致
  (p) => `你活得太满——满到不肯留一点将就的缝。华丽，危险，移不开眼。你不是来配合这个世界的，你是来让自己被看见的。`,
  // 2. 不肯平庸
  (p) => `别人看你像一场不肯谢幕的戏——你享受被注视，也享受没人真懂。对完美的执念，是你对平庸最倔强的反抗。`,
];

const CREED: StoryFn[] = [
  // 1. 贵族感
  (p) => `你的好，是那种不需要名片的好。有来处，但不炫耀。有底气，但不压迫。真正贵的东西，都安静。`,
  // 2. 温暖教养
  (p) => `你有一种让人想靠近的暖——不是热，是温。像刚好的水，不多不少，喝了就知道。那种温润不是没有锋芒，是把锋芒收得刚好。`,
];

const MAISON_MARGIELA: StoryFn[] = [
  // 1. 存档记忆
  (p) => `你像一段被存档的记忆。不是现在发生的——像早就存在，只是今天被闻见了。有些味道记在脑子里，你的味道记在身体里。`,
  // 2. 午后光线
  (p) => `安静得像某个午后的光线，落在你身上就不走了。不是刻意营造的，是本来就该这样——那些最动人的东西，从来不急着证明自己。`,
];

// Fallback
const FALLBACK_STORIES: StoryFn[] = [
  (p) => `你身上有种说不清的特别。像一阵路过却让人记住的风。不是所有人都能说清那是什么——但闻过一次，就忘不掉。`,
];

const BRAND_STORIES: Record<string, StoryFn[]> = {
  Byredo: BYREDO,
  'Tom Ford': TOM_FORD,
  YSL,
  'Le Labo': LE_LABO,
  Hermès: HERMES,
  Diptyque: DIPTYQUE,
  Chanel: CHANEL,
  Aesop: AESOP,
  MFK,
  'Jo Malone': JO_MALONE,
  Amouage: AMOUAGE,
  Creed: CREED,
  'Maison Margiela': MAISON_MARGIELA,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 辅助
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** 防撞：用 description + moodKey 双重 hash 做二次偏移 */
function pickIndex(pool: StoryFn[], seed: number, desc: string, moodKey: string): number {
  let h = 0;
  for (let i = 0; i < desc.length; i++) {
    h = ((h << 5) - h) + desc.charCodeAt(i);
    h |= 0;
  }
  for (let i = 0; i < moodKey.length; i++) {
    h = ((h << 5) - h) + moodKey.charCodeAt(i);
    h |= 0;
  }
  return (seed + Math.abs(h)) % pool.length;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 主入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getMemoryScene(
  personalityName: string,
  perfume: PerfumeSnapshot,
): MemoryScene {
  const personality = PERSONALITIES.find((p) => p.name === personalityName);
  const description = personality?.description || '';
  const direction = personality?.direction || '';

  const moodKey = getDominantMoodKey(perfume.notesStructured);

  const pool = BRAND_STORIES[perfume.brand] || FALLBACK_STORIES;
  const seed = hash(`${personalityName}|${perfume.brand}|${perfume.name}|${moodKey}`);
  const fn = pool[pickIndex(pool, seed, description, moodKey)];

  const text = fn({ personality: personalityName, description, direction, moodKey, perfume: perfume.name });
  return { description: text };
}

export function getMemorySceneFallback(personalityName: string): MemoryScene {
  const personality = PERSONALITIES.find((p) => p.name === personalityName);
  const d = personality?.description || '';
  return { description: `你身上有种说不清的特别。像一阵路过却让人记住的风。${d}` };
}
