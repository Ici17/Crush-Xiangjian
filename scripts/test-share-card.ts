import { renderShareCardSVG } from '../lib/shareCardRender';
import { writeFileSync } from 'fs';

(async () => {
  // 1. self 结果页 3:4
  const svgSelf = await renderShareCardSVG({
    scene: 'self',
    name: '烬生',
    tagline: '你的温柔，是最被低估的力量。',
    perfumeA: { name: '珍华乌木', tier: '本命香', match: 93 },
    perfumeB: { name: '纳克索斯', tier: '进阶香', match: 72 },
    perfumeC: { name: '岩兰物语', tier: '尝试香', match: 46 },
    radar: { '木质': 0.85, '清新': 0.35, '东方': 0.70, '美食': 0.20, '柑橘': 0.25, '花香': 0.60 },
    radarTop3: ['花香', '木质', '东方'],
    scentPhilosophy: '你选香偏好精致但不张扬的香气，像一杯刚好温度的白茶——不烫不凉，一切刚刚好。',
  }, '3to4');
  writeFileSync('outputs/test_self_radar.svg', svgSelf);

  // 2. friend 匹配页 3:4（同调场景）
  const svgFriend = await renderShareCardSVG({
    scene: 'friend',
    nameA: '荒岛',
    nameB: '温砾',
    perfumeNameA: '花草水语柑橘',
    perfumeNameB: '光晕',
    score: 81,
    tier: '气息同频',
    story: '你们走进一家香氛买手店，荒岛的人径直走向木质柜台，而温砾的人停在了花香的角落。',
    radarA: { '木质': 0.90, '清新': 0.40, '东方': 0.80, '美食': 0.10, '柑橘': 0.20, '花香': 0.75 },
    radarB: { '木质': 0.30, '清新': 0.95, '东方': 0.30, '柑橘': 0.95, '美食': 0.60, '花香': 0.50 },
    sharedNotes: ['花香调', '清新调', '柑橘调', '美食调'],
    cpBlendName: '橙花与茉莉',
    cpDiffTones: 0,
    cpToneA: '花香',
    cpToneB: '花香',
    cpSeal: '雅',
    cpLine: '同一种气息底色，让彼此靠近时，仿佛回到熟悉的地方。',
  }, '3to4');
  writeFileSync('outputs/test_friend_radar.svg', svgFriend);

  // 检查中文标签是否以 <text> 形式存在（而非空或 tofu）
  const dims = ['木质', '清新', '东方', '美食', '柑橘', '花香'];
  const selfOk = dims.every(d => svgSelf.includes(`>${d}<`));
  const friendOk = dims.every(d => svgFriend.includes(`>${d}<`));
  console.log('self labels in SVG text:', selfOk);
  console.log('friend labels in SVG text:', friendOk);
  console.log('friend cpDiff text 同调:', svgFriend.includes('同调'));
})().catch(e => { console.error(e); process.exit(1); });
