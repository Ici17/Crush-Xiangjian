import { renderShareCard, renderShareCardSVG } from '../lib/shareCardRender';
import { writeFileSync } from 'fs';
import { getRadarScores, getScentPhilosophy } from '../lib/personalities';

const NAMES = ['烬生', '暗流', '荒岛', '温砾'];

(async () => {
  for (const name of NAMES) {
    const radar = getRadarScores(name);
    const top3 = Object.entries(radar)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    const png = await renderShareCard({
      scene: 'self',
      name,
      tagline: `${name}的温柔，是最被低估的力量。`,
      perfumeA: { name: '珍华乌木', tier: '本命香', match: 93 },
      perfumeB: { name: '纳克索斯', tier: '进阶香', match: 72 },
      perfumeC: { name: '岩兰物语', tier: '尝试香', match: 46 },
      radar,
      radarTop3: top3,
      scentPhilosophy: getScentPhilosophy(name),
    }, '3to4');
    writeFileSync(`outputs/self_${name}.png`, png);
    console.log(`outputs/self_${name}.png ${png.length} bytes`);
  }
})().catch(e => { console.error(e); process.exit(1); });
