/**
 * 分享图渲染自检（A 组 · 2026-09-16）
 *
 * 对全部 7 个场景**真实渲染**（satori → SVG → sharp → PNG），把成品落盘到
 * `.data/share-cards/` 供目视检查（中文字体豆腐块、内容溢出、footer 被裁这类
 * 问题只有看图才能发现，单元断言测不出来）。
 *
 * 断言：
 *   1. 渲染不抛错
 *   2. 输出为合法 PNG（魔数 89 50 4E 47）
 *   3. 宽度恒为 1080（3:4 长图规格）
 *   4. 高度 ≤ 1620（自适应裁切 + 补底，超过说明布局溢出了 3:4 画布）
 *   5. 高度 ≥ 1000（过低说明内容塌陷）
 *
 * 运行：npx tsx scripts/audit-share-cards.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderShareCard, type ShareCardData } from "../lib/shareCardRender";
import { PERSONALITIES, getGuardianPerfume, getContrastScent, getRadarScores } from "../lib/personalities";
import { findPerfume } from "../lib/discover";
import { getPerfumeProfileNorm } from "../lib/matchPerfumes";
import { drawDaily, getTodayStr, RARITY_LABEL, type DrawnPerfume } from "../lib/daily/draw";
import { drawAlmanac } from "../lib/daily/almanac";
import { CP_TOTAL } from "../lib/cpCodex";

let pass = 0;
let fail = 0;
function ck(cond: boolean, label: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const OUT_DIR = join(process.cwd(), ".data", "share-cards");

function pngSize(buf: Buffer): { w: number; h: number } {
  // PNG: 8 字节魔数 + 4 字节长度 + "IHDR" + 4 字节宽 + 4 字节高
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h };
}

function isPng(buf: Buffer): boolean {
  return (
    buf.length > 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  );
}

async function checkScene(label: string, data: ShareCardData, outName?: string) {
  console.log(`\n【${label}】scene=${data.scene}`);
  let buf: Buffer;
  try {
    buf = await renderShareCard(data);
  } catch (e) {
    ck(false, `${label} 渲染不抛错`, (e as Error).message.slice(0, 200));
    return;
  }
  ck(true, `${label} 渲染不抛错`);
  ck(isPng(buf), `${label} 输出为合法 PNG`);
  const { w, h } = pngSize(buf);
  ck(w === 1080, `${label} 宽度 1080`, `实际 ${w}`);
  ck(h <= 1620, `${label} 高度未溢出 1620`, `实际 ${h}`);
  ck(h >= 1000, `${label} 高度未塌陷（≥1000）`, `实际 ${h}`);
  const f = join(OUT_DIR, `${outName ?? data.scene}.png`);
  writeFileSync(f, buf);
  console.log(`     ↳ ${(buf.length / 1024).toFixed(0)} KB, ${w}×${h} → ${f}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("═══ 分享图渲染自检（7 场景）═══");

  const P = "残温";
  const guardian = getGuardianPerfume(P);

  await checkScene("self · 结果页本人", {
    scene: "self",
    name: P,
    tagline: "你的温柔，是这个世界欠你的利息。",
    perfumeA: { name: "白茶（祖玛珑）", tier: "本命香", match: 93 },
    perfumeB: { name: "墨水（川久保玲）", tier: "进阶香", match: 88 },
    perfumeC: { name: "木质琥珀", tier: "尝试香", match: 81 },
    radar: { 木质: 0.7, 清新: 0.4, 东方: 0.6, 美食: 0.3, 柑橘: 0.5, 花香: 0.8 },
    memoryScene: "冬夜里有人替你留了一盏灯，什么都没说，但你知道它在。",
    notesA: "白茶·佛手柑·麝香",
    notesB: "墨水·鸢尾·雪松",
    notesC: "琥珀·香草·檀香",
    brandA: "祖玛珑",
    brandB: "川久保玲",
    brandC: "祖·玛珑",
    scentPhilosophy: "香气是你不必开口的那部分自我介绍。",
  });

  await checkScene("friend · 好友匹配", {
    scene: "friend",
    nameA: P,
    nameB: "暗流",
    perfumeNameA: "白茶（祖玛珑）",
    perfumeNameB: "无人区玫瑰",
    score: 87,
    tier: "灵魂共振",
    story: "你们是同一支香的两种写法，一个前调明亮，一个尾调深沉。",
    sharedNotes: ["白茶", "玫瑰", "麝香"],
    notesA: "白茶·佛手柑·麝香",
    notesB: "玫瑰·广藿香·琥珀",
    brandA: "祖玛珑",
    brandB: "BYREDO",
    radarA: { 木质: 0.7, 清新: 0.4, 东方: 0.6, 美食: 0.3, 柑橘: 0.5, 花香: 0.8 },
    radarB: { 木质: 0.5, 清新: 0.3, 东方: 0.8, 美食: 0.4, 柑橘: 0.2, 花香: 0.9 },
    inviteCode: "TESTCODE",
  });

  await checkScene("shared · 拉新分享卡", {
    scene: "shared",
    sharerName: P,
    name: P,
    description: "把话咽回去的人，气味却比谁都暖。",
    perfumeName: "白茶（祖玛珑）",
    scentPhilosophy: "香气是你不必开口的那部分自我介绍。",
    inviteCode: "TESTCODE",
  });

  await checkScene("daily · 今日香签", (() => {
    const date = getTodayStr();
    const d = drawDaily(date);
    const fmt = (p: DrawnPerfume) => ({
      name: p.name,
      brandCn: p.brandCn,
      description: p.description,
      notes: `前 ${p.notes.top.join("·")} ｜ 中 ${p.notes.heart.join("·")} ｜ 后 ${p.notes.base.join("·")}`,
      rarity: RARITY_LABEL[p.rarity],
    });
    const alm = drawAlmanac(date);
    return {
      scene: "daily" as const,
      date,
      main: fmt(d.main),
      inspirationA: fmt(d.inspirations[0]),
      inspirationB: fmt(d.inspirations[1]),
      almanac: { yi: alm.yi, ji: alm.ji, note: alm.note },
    };
  })());

  // ── A 组新增三场景 ──
  if (!guardian) {
    ck(false, "guardian 数据可派生", `${P} 无守护香映射`);
  } else {
    await checkScene("guardian · 本命守护香卡（A 组）", {
      scene: "guardian",
      personality: P,
      perfumeName: guardian.name,
      brandCn: guardian.brandCn,
      notes: [...guardian.notes.top, ...guardian.notes.heart, ...guardian.notes.base].slice(0, 6).join("·"),
      seal: guardian.seal,
      line: guardian.line,
      match: guardian.match,
    });
  }

  // contrast：对全部 16 人格验证「反差香可派生 + 双侧雷达可算」，再渲染一张成品
  {
    const bad: string[] = [];
    let ok = 0;
    let sample: ShareCardData | null = null;
    for (const p of PERSONALITIES) {
      const c = getContrastScent(p.name);
      const cP = findPerfume(c.name);
      if (!cP) {
        bad.push(`${p.name}→${c.name} 香水库查不到`);
        continue;
      }
      const prof = getPerfumeProfileNorm(cP);
      const dims = [prof.woody, prof.fresh, prof.oriental, prof.gourmand, prof.citrus, prof.floral];
      // 归一化后必须落在 0~1（超范围会让雷达多边形飞出画布）
      if (dims.some((v) => typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1)) {
        bad.push(`${p.name} 光谱越界`);
        continue;
      }
      ok++;
      if (p.name === P) {
        sample = {
          scene: "contrast",
          personality: p.name,
          perfumeName: c.name,
          brand: c.brand,
          notes: c.notes,
          why: c.why,
          radarA: getRadarScores(p.name) as Record<string, number>,
          radarB: {
            木质: prof.woody, 清新: prof.fresh, 东方: prof.oriental,
            美食: prof.gourmand, 柑橘: prof.citrus, 花香: prof.floral,
          },
        };
      }
    }
    ck(bad.length === 0, `16 人格的反差香与双侧雷达均可派生（${ok}/16）`, bad.join("；"));
    if (sample) await checkScene("contrast · 反差香卡（A 组）", sample);
  }

  const names = PERSONALITIES.map((p) => p.name);
  await checkScene("codex · 气味 CP 图鉴卡（A 组，12 格）", {
    scene: "codex",
    personality: P,
    lit: [
      "残温|暗流", "暗流|残温",
      "残温|荒岛", "荒岛|残温",
      "残温|残温",
      "暗流|暗流",
      "渊海|沉湾", "沉湾|渊海",
      "寒岭|极夜", "极夜|寒岭",
      "冲浪|温砾", "温砾|冲浪",
    ],
    total: CP_TOTAL,
    names,
  });

  // 边界：0 格（新用户）也要能出图，且不出现负数/NaN
  await checkScene("codex · 图鉴卡边界（0 格）", {
    scene: "codex",
    personality: P,
    lit: [],
    total: CP_TOTAL,
    names,
  }, "codex-empty");

  console.log(`\n═══ 结果：${pass} 通过 / ${fail} 失败 ═══`);
  console.log(`产物目录：${OUT_DIR}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("自检异常：", e);
  process.exit(1);
});
