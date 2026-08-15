/**
 * 专属记忆点 · 动态生成引擎 v4（文案提质：克制 / 意象化 / 自然嵌入气质词）
 *
 * 设计定位（与性格解读区分）：
 *   - 性格解读 = 你是谁（字面人格说明书：description / mbti / direction）
 *   - 专属记忆 = 气味签名（"这支香成为你的标记；当它在空气里出现，熟悉你的人会想起你身上的某种特质"）
 *     它从品牌声线出发（声音来自品牌），但点名的「特质」取自用户自己（气质词 trait），
 *     所以既保留品牌氛围，又明确是"关于你的香气记忆"，不与性格解读撞车。
 *
 * 文案基调：少解释，多留白；用具体的物象代替形容词；句子短而有重量；让"你"退到气息后面，由气息替你说话。
 * 气质词以自然短语嵌入（如"你身上那点克制的优雅"），不另起括号，读来更像高级香氛文案而非填空。
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 香调 → 氛围
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 品牌 × 人格 叙事生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
// ${p.trait} 自然嵌入为用户自己的气质词，保证每条点名的是"你"，而非品牌套路里的某类人。

const BYREDO: StoryFn[] = [
  (p) => `有人是先记住了你的气息，才记住你。你身上那点${p.trait}，不争，却让人忍不住回头。`,
  (p) => `你藏得很深的${p.trait}，这缕香替你留了道缝。懂的人闻得到，不懂的，路过了。`,
  (p) => `你不必急着被谁记住。像北欧冬夜那扇还亮着的窗，你身上那份${p.trait}就在那儿，有人停，有人过。`,
  (p) => `真正靠近你的人才闻得到：你安静的底下，是你那份${p.trait}撑着的笃定。`,
];

const TOM_FORD: StoryFn[] = [
  (p) => `你在场，空气就静了。那是一种不用出声的${p.trait}。`,
  (p) => `你不是难靠近，只是把门只留给够分量的人。这缕香，是给你那份${p.trait}的暗号。`,
  (p) => `乱局里你是那点不晃的光——因为你比谁都清楚自己要什么，那份${p.trait}，从不需要解释。`,
  (p) => `退后半步，比往前十步更有分量。你身上那点${p.trait}，是种高级的、接得住才懂的性感。`,
];

const YSL: StoryFn[] = [
  (p) => `规矩是写给听话的人的。你那份${p.trait}，懒得被归类——这缕香，就是你还在浪上的证据。`,
  (p) => `你不是不懂体面，是懒得照剧本演。那股劲儿一散，比任何宣言都先开口，你身上那点${p.trait}自己就是方向。`,
  (p) => `教你怎么活的那些声音，你早关了。因为你那份${p.trait}，自己就是方向。`,
];

const LE_LABO: StoryFn[] = [
  (p) => `香气漫开时，熟悉你的人会忽然安静——他们认出了你身上那份${p.trait}，不必你解释。`,
  (p) => `你藏得很深的${p.trait}，这缕香替你留了道缝。懂的人闻得到，不懂的，路过了。`,
  (p) => `有些人记住你，是先记住了你身上的气息。你那份${p.trait}，不响，却比名字更早抵达。`,
  (p) => `你无需为自己辩白。这支香替你立在人群中，像深夜还亮着的那盏灯，只等同你那份${p.trait}的同类。`,
];

const HERMES: StoryFn[] = [
  (p) => `你身上那点${p.trait}不张扬，但谁都知道——东西交给你，不会丢。这香也是，只对的人闻得出。`,
  (p) => `你像一张坐了许多年的木桌，越旧越暖。你那份${p.trait}，谁都认得，却从不刺眼。`,
  (p) => `稳的人，往往替别人扛得最多。你身上那份${p.trait}，是所有人倚靠时，不必问的底气。`,
];

const DIPTYQUE: StoryFn[] = [
  (p) => `你对美有种近乎任性的讲究，像左岸那间不肯弯腰的画廊。冷，且骄傲，走近了才看见底下那点${p.trait}。`,
  (p) => `你身上有层纸墨的文气，比别人多一重心。风一动你先觉，话未出口你先懂，你那份${p.trait}便是这层心的底。`,
  (p) => `不取悦世界，是你给自己最大的体面。你身上那点${p.trait}，是月光落水——看得见，捞不起。`,
  (p) => `你知道什么是好的，便回不去了。那份${p.trait}，不是挑剔，是见过好之后，不忍辜负自己。`,
];

const CHANEL: StoryFn[] = [
  (p) => `你的好，是老派的体面。你身上那份${p.trait}，不喊不叫，却是你走后，满室都在找的东西。`,
  (p) => `不多，也不缺。你身上那点${p.trait}，是清爽的底气，不是扮出来的。`,
  (p) => `灯亮起来时，人人都知道你该立在那儿。因为你那份${p.trait}，懂的人，一眼便知。`,
];

const AESOP: StoryFn[] = [
  (p) => `你删掉那行字，把手机搁到一边。那份${p.trait}，是给真正要紧的东西，留的位置。`,
  (p) => `别人在做加法，你在做减法。减到只剩本质——你身上那点${p.trait}，少，却样样都对。`,
  (p) => `多余、喧嚣、假的，你比谁都先察觉，然后，删掉。那份${p.trait}，是你对生活的态度：只留真的。`,
];

const MFK: StoryFn[] = [
  (p) => `最好的味道，是让人忘了你涂过什么，只记得你。你身上那点${p.trait}，闻起来像自己，却更好。`,
  (p) => `不争不抢，却让人一直想靠近。你那份${p.trait}，是那种"像你，但更舒服"的分寸。`,
  (p) => `温柔不是软弱，是你选的方式。你身上那点${p.trait}，像晒过太阳的棉麻——软，却有骨子里的干净。`,
];

const JO_MALONE: StoryFn[] = [
  (p) => `你总在收拾行李，哪怕只是下楼。那份${p.trait}，是把重量，留给那个还不肯停下的自己。`,
  (p) => `像夏日傍晚踩着还温的石板。风往哪吹，你就去哪——你身上那点${p.trait}，不是没方向，是方向不重要。`,
];

const AMOUAGE: StoryFn[] = [
  (p) => `你活得太满，满到不肯留一丝将就的缝。那份${p.trait}，华丽，危险，教人移不开眼。`,
  (p) => `别人看你像一场不肯落幕的戏。你对那份${p.trait}较的真，是对平庸，最倔的反抗。`,
];

const CREED: StoryFn[] = [
  (p) => `你的好，是不必递名片的好。那份${p.trait}，有来处，不炫耀；有底气，不压迫。`,
  (p) => `你身上有股让人想靠近的暖。那份${p.trait}，像刚好的水温，不多不少，喝过便知。`,
];

const MAISON_MARGIELA: StoryFn[] = [
  (p) => `你像一段被存档的气味记忆，不是此刻发生的，是早就在了，今天才被闻见。你身上那份${p.trait}，落在身体里。`,
  (p) => `安静得像某个午后的光，落在你身上就不肯走。你那份${p.trait}，从来不必急着证明自己。`,
];

// Fallback（无匹配品牌时）：仍走气味签名框架，且点名用户自己的特质
const FALLBACK_STORIES: StoryFn[] = [
  (p) => `你身上有种说不清的特别，像一阵路过却让人记住的风。而当那阵风里浮起你独有的${p.trait}，熟悉你的人，就知道是你。`,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 辅助
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 主入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  return { description: `你身上有种说不清的特别，像一阵路过却让人记住的风。而当那阵风里浮起你独有的${trait}，熟悉你的人，就知道是你。${d}` };
}
