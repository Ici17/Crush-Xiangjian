/**
 * 专属记忆点 · 动态生成引擎 v4
 *
 * 设计定位（与性格解读区分）：
 *   - 性格解读 = 你是谁（字面人格说明书：description / mbti / direction）
 *   - 专属记忆 = 气味签名（"这支香成为你的标记；当它在空气里出现，熟悉你的人会想起你身上的某种特质"）
 *     它从品牌声线出发（声音来自品牌），但点名的「特质」取自用户自己（气质词 trait），
 *     所以既保留品牌氛围，又明确是"关于你的香气记忆"，不与性格解读撞车。
 *
 * 动态输入：人格特质（trait 气质词 / tagline）+ 匹配香水（品牌 + 香调族 + 香水名）
 * 输出：气味签名叙事，多变体；同一人格不同品牌各不相同，且每条都点名用户自己的特质。
 */

import { PERSONALITIES } from './personalities';

export type MemoryScene = { description: string };
export type PerfumeSnapshot = {
  name: string;
  brand: string;
  notesStructured: { top: string[]; heart: string[]; base: string[] };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 香调 → 氛围
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 品牌 × 人格 叙事生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type StoryFn = (ctx: {
  personality: string;         // 人格名（暗流/荒岛…）
  description: string;        // 人格描述
  direction: string;          // 人格方向（如"克制的优雅（木质+玫瑰）"）
  moodKey: string;            // 主导香调族
  perfume: string;            // 香水名（用于意象，不提品牌名）
  trait: string;              // 用户气质词（取自 direction 括号前，如"克制的优雅"）—— 注入点
  tagline: string;            // 用户扎心短句（如"表面平静，内心自有深渊"）
}) => string;

// ━━ 品牌叙事池（每个品牌 3-4 支变体，覆盖不同场景）
// 每条都遵循"气味签名"框架：这支香如何成为你的标记 / 当气味出现别人想起你身上的某种特质。
// ${p.trait} 注入用户自己的气质词，保证每条点名的是"你"，而非品牌套路里的某类人。

const BYREDO: StoryFn[] = [
  (p) => `有人是先闻到你身上那股「${p.trait}」，才记住你的。这味道不抢话，却让人忍不住回头。`,
  (p) => `你把「${p.trait}」收得很里面，这支香替你留了道缝——懂的人凑近了才发现，不懂的路过了。`,
  (p) => `你不必急着被记住。像北欧冬夜亮着的那扇窗，你那份「${p.trait}」就静静待着，有人停下，有人路过。`,
  (p) => `真正靠近你的人才闻得到：你那股「${p.trait}」底下，是一种不肯妥协的安静。`,
];

const TOM_FORD: StoryFn[] = [
  (p) => `你在场，空气就安静——因为你那份「${p.trait}」自带压场的东西，不用解释。`,
  (p) => `有人说你难靠近。其实你只是把「${p.trait}」留给够分量的人。这支香，是给那些人的暗号。`,
  (p) => `混乱里你是那点不晃的光，因为你那份「${p.trait}」比别人清楚自己要什么。`,
  (p) => `退后半步，比往前十步都有分量。你那股「${p.trait}」，是种高级的、接得住才懂的性感。`,
];

const YSL: StoryFn[] = [
  (p) => `规矩是写给听话的人。你那份「${p.trait}」，懒得被归类——这味道就是你还漂在浪上的证据。`,
  (p) => `你不是不懂体面，是懒得配合剧本。那股「${p.trait}」往外一散，比任何宣言都先开口。`,
  (p) => `教你怎么活的声音，你早关了。因为你那份「${p.trait}」，自己就是方向。`,
];

const LE_LABO: StoryFn[] = [
  (p) => `当这支香气散开，熟悉你的人会立刻想起你身上那种「${p.trait}」——它不急着证明什么，像凌晨还亮着的那盏灯。`,
  (p) => `你把「${p.trait}」藏得很深，这支香替你留了道缝。懂的人闻得到，不懂的人路过了。`,
  (p) => `有人靠近你，是先闻到那股「${p.trait}」才记住你的。这味道不声张，却比名字更先开口。`,
  (p) => `你不必解释自己是怎样的「${p.trait}」。这支香替你站那儿，像工作室里只为你亮的灯。`,
];

const HERMES: StoryFn[] = [
  (p) => `你那份「${p.trait}」不炫，但谁都知道东西放你这儿不会丢。这味道也是——不声张，只对的人认得。`,
  (p) => `你像一块被人坐了很多年的老木桌，越旧越暖。那股「${p.trait}」，谁都认得，却不耀眼。`,
  (p) => `稳的人，往往替别人扛得最多。你那份「${p.trait}」，是所有人倚靠时不用问的底气。`,
];

const DIPTYQUE: StoryFn[] = [
  (p) => `你对美有种近乎任性的讲究，像左岸那间不肯投降的画廊。你那份「${p.trait}」，冷，且骄傲，走近了才发现底下是烫的。`,
  (p) => `你身上有种纸墨的文气，比别人多一层敏感。那股「${p.trait}」，风一吹你先听见，话没说你先懂。`,
  (p) => `不取悦世界，是你对自己最大的尊重。你那份「${p.trait}」，是月光落在水面，看得见、捞不起。`,
  (p) => `你知道什么是好的，便回不去了。那份「${p.trait}」，不是挑剔，是见过美之后不忍心辜负自己。`,
];

const CHANEL: StoryFn[] = [
  (p) => `你的好，是老派的体面。那份「${p.trait}」不吼不叫，却是你走了之后全场都在找的东西。`,
  (p) => `什么都不多，什么都不缺。你那份「${p.trait}」，是清爽的底气，不是装出来的。`,
  (p) => `聚光灯亮的时候，人人都知道你该站在那里。因为你那份「${p.trait}」，懂的人一看就懂。`,
];

const AESOP: StoryFn[] = [
  (p) => `你删掉那行字，把手机放到一边。那份「${p.trait}」，是给真正重要的东西留的位置。`,
  (p) => `别人在加，你在减。减到只剩本质——你那份「${p.trait}」，少，但每样都对。`,
  (p) => `多余的、吵的、假的，你比谁都先察觉，然后删掉。那份「${p.trait}」，是你对生活的态度：只留真的。`,
];

const MFK: StoryFn[] = [
  (p) => `最好的味道，是让人忘了你喷过什么，只记得你。你那份「${p.trait}」，闻起来像自己，但更好。`,
  (p) => `不争不抢，却让人一直想靠近。你那份「${p.trait}」，是那种"闻起来像你，但更舒服"的分寸。`,
  (p) => `温柔不是弱点，是你选的方式。那份「${p.trait}」，像晒过太阳的棉麻——软，却有骨子里的干净。`,
];

const JO_MALONE: StoryFn[] = [
  (p) => `你总在收拾行李，哪怕只是去楼下。那份「${p.trait}」，是把负担留给那个还不想停下的自己。`,
  (p) => `像夏天傍晚踩着还温着的石板。风把你往哪吹，你就去哪——那份「${p.trait}」，不是没方向，是方向不重要。`,
];

const AMOUAGE: StoryFn[] = [
  (p) => `你活得太满，满到不肯留一点将就的缝。那份「${p.trait}」，华丽、危险、移不开眼。`,
  (p) => `别人看你像一场不肯谢幕的戏。你对那份「${p.trait}」的执念，是对平庸最倔强的反抗。`,
];

const CREED: StoryFn[] = [
  (p) => `你的好，是不需要名片的好。那份「${p.trait}」，有来处，不炫耀；有底气，不压迫。`,
  (p) => `你有一种让人想靠近的暖。那份「${p.trait}」，像刚好的水，不多不少，喝了就知道。`,
];

const MAISON_MARGIELA: StoryFn[] = [
  (p) => `你像一段被存档的记忆，不是现在发生的，是早就存在，今天被闻见了。那份「${p.trait}」，记在身体里。`,
  (p) => `安静得像某个午后的光线，落在你身上就不走了。那份「${p.trait}」，从来不急着证明自己。`,
];

// Fallback（无匹配品牌时）：仍走气味签名框架，且点名用户自己的特质
const FALLBACK_STORIES: StoryFn[] = [
  (p) => `你身上有种说不清的特别，像一阵路过却让人记住的风。而当那阵风里浮起你那份「${p.trait}」，熟悉你的人就知道是你。`,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 辅助
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 主入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getMemoryScene(
  personalityName: string,
  perfume: PerfumeSnapshot,
): MemoryScene {
  const personality = PERSONALITIES.find((p) => p.name === personalityName);
  const description = personality?.description || '';
  const direction = personality?.direction || '';
  const tagline = personality?.tagline || '';
  // 气质词：direction 括号前的部分（如"克制的优雅（木质+玫瑰）" → "克制的优雅"）
  const trait = direction.includes('（') ? direction.split('（')[0] : direction;

  const moodKey = getDominantMoodKey(perfume.notesStructured);

  const pool = BRAND_STORIES[perfume.brand] || FALLBACK_STORIES;
  const seed = hash(`${personalityName}|${perfume.brand}|${perfume.name}|${moodKey}`);
  const fn = pool[pickIndex(pool, seed, description, moodKey)];

  const text = fn({ personality: personalityName, description, direction, moodKey, perfume: perfume.name, trait, tagline });
  return { description: text };
}

export function getMemorySceneFallback(personalityName: string): MemoryScene {
  const personality = PERSONALITIES.find((p) => p.name === personalityName);
  const d = personality?.description || '';
  const direction = personality?.direction || '';
  const trait = direction.includes('（') ? direction.split('（')[0] : direction;
  return { description: `你身上有种说不清的特别，像一阵路过却让人记住的风。而当那阵风里浮起你那份「${trait}」，熟悉你的人就知道是你。${d}` };
}
