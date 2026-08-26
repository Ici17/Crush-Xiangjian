/**
 * Crush香鉴 — 服务端分享图渲染 v2
 *
 * 三个场景：
 *   self    结果页本人（人格名 + 三香横排 + tagline）
 *   friend  朋友匹配页（A主B辅 + 圆环契合度）
 *   shared  /shared 分享卡（拉新为主 + 强CTA）
 *
 * 技术栈：satori（JSX→SVG）+ sharp（SVG→PNG）+ qrcode
 * 字体：Noto Serif SC（public/fonts，运行时读磁盘 / 失败则同源HTTP拉取）
 * 输出：3:4 (1080×1620) 长图 — 适配微信转发 / 小红书 / 朋友圈
 *
 * ⚠️ satori 布局规则（v0.29）：
 *   1. 所有 <div> 必须显式 display: flex / contents / none
 *   2. inset shorthand 不支持 → 用 top/left/right/bottom
 *   3. gap 不支持 → 用 margin
 *   4. <p>/<ul> 等默认不是 flex → 用 <div>/<span> 代替
 *   5. 分隔线：用 <span> + border-top
 *   6. 绝对定位：父 div 需 display:flex，overlay 子 div 也需 display:flex
 *   7. overflow:hidden 不生效 → 用显式高度约束各 section
 */

import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RADAR_DIM_LABELS } from "@/lib/personalities";

// ── 强制打包追踪 sharp 的 libvips 原生库 ─────────────────────────────────────
// sharp 在运行时通过 dlopen 动态加载 libvips 的 .so，打包器（Turbopack/NFT）无法
// 静态追踪，导致 Vercel serverless 部署的 lambda 缺失 libvips-cpp.so，运行期
// ERR_DLOPEN_FAILED。这里用字面量 require 强制追踪，把对应平台的 libvips 包打进
// 函数产物。本地非 linux-x64 环境没有这些包，用 try 容错，不影响开发构建。
try { require("@img/sharp-libvips-linux-x64"); } catch { /* 非 linux-x64 忽略 */ }
try { require("@img/sharp-libvips-linuxmusl-x64"); } catch { /* 非 linux-musl 忽略 */ }

// ── 类型定义 ───────────────────────────────────────────────────────────────

export type ShareScene = "self" | "friend" | "shared" | "daily";

export interface PerfumeCard {
  name: string;
  tier: string; // 本命香 | 进阶香 | 尝试香
  match: number; // 0-100
}

export interface SelfShareData {
  scene: "self";
  name: string;
  tagline: string; // 人格扎心短句（SHARE_QUOTES）
  perfumeA: PerfumeCard;
  perfumeB: PerfumeCard;
  perfumeC: PerfumeCard;
  // 锁定版内容（2026-08-13 改：分享图=锁定版，不含解锁内容）
  radar?: Record<string, number>; // 六维雷达 0~1（香气图谱）
  memoryScene?: string; // 记忆点区块文案
  desc?: string; // 人格一句话简介（副标题）
  notesA?: string; // 本命香三调关键词（点分隔）
  notesB?: string; // 进阶香三调关键词
  notesC?: string; // 尝试香三调关键词
  brandA?: string; // 本命香品牌
  brandB?: string; // 进阶香品牌
  brandC?: string; // 尝试香品牌
  // 3:4 专属深度内容（用香哲学 / 香调偏好）
  scentPhilosophy?: string; // 用香哲学（编辑式金句）
  radarTop3?: string[]; // 香调偏好 top 3
  format?: "3to4";
}

export interface FriendShareData {
  scene: "friend";
  nameA: string;
  nameB: string;
  perfumeNameA: string; // A 的本命香名
  perfumeNameB: string; // B 的本命香名
  score: number;
  tier: string;
  story: string;
  sharedNotes?: string[];
  // 新增 v2
  perfumeTierA?: string; // A 的本命香 tier
  perfumeTierB?: string; // B 的本命香 tier
  notesA?: string; // A 的签名香三调关键词（点分隔）
  notesB?: string; // B 的签名香三调关键词
  brandA?: string; // A 的本命香品牌
  brandB?: string; // B 的本命香品牌
  radarA?: Record<string, number>; // A 六维雷达 0~1
  radarB?: Record<string, number>; // B 六维雷达 0~1
  // 合香卡（CP 共振核心产物，服务端确定性计算）
  cpBlendName?: string; // 合香名（如「玫瑰与焚香」）
  cpDiffTones?: number; // 差几调（0~3）
  cpToneA?: string; // A 主导调族
  cpToneB?: string; // B 主导调族
  cpSeal?: string; // 合香印（隐/雅/常）
  cpLine?: string; // 合香解读（启示体）
  cpNotes?: string; // 合香三调（前/中/后 点分隔）
  inviteCode: string;
  format?: "3to4";
}

export interface SharedShareData {
  scene: "shared";
  sharerName: string; // 分享者名字（人格名）
  name: string; // 人格名
  description: string; // 人格 description
  perfumeName: string; // 本命香名
  // 新增 v2
  perfumeTier?: string; // 本命香 tier
  blueprint?: { top: string[]; heart: string[]; base: string[] }; // 气味底稿（已弃用，保留兼容）
  radarTop3?: string[]; // 香调偏好 top 3 (3:4)（已弃用，保留兼容）
  scentPhilosophy?: string; // 用香哲学（编辑式金句，与 self 卡统一）
  inviteCode: string;
  format?: "3to4";
}

export interface DailyShareData {
  scene: "daily";
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  main: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  inspirationA: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  inspirationB: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  almanac?: { yi: string[]; ji: string[]; note: string };
  format?: "3to4";
}

export type ShareCardData = SelfShareData | FriendShareData | SharedShareData | DailyShareData;

// ── 颜色常量 ───────────────────────────────────────────────────────────────

const C = {
  BG: "#FAF3EA",
  AMBER_DARK: "#2C1810",
  AMBER_MID: "#5C3826",
  AMBER_ACCENT: "#C8A36A",
  AMBER_LIGHT: "#D4A574",
  AMBER_PALE: "#F8EAD9",
  TEXT_MUTED: "#8B6F5C",
  WHITE: "#FFFFFF",
  // ── 新编辑式调色板（self / friend 重做用）──
  INK: "#2A211B", // 暖炭黑
  GOLD: "#A8884E", // 哑光金
  GOLD_SOFT: "#C2A877",
  MUTED: "#8B7C68", // 次级文字
  HAIR: "rgba(42,33,27,0.14)", // 发丝分隔线
  PAPER: "#F8F2E8",
};

// tier 颜色
const TIER_COLOR: Record<string, string> = {
  本命香: "#C4956A",
  进阶香: "#8B7A6B",
  尝试香: "#9BA8AB",
};
const TIER_BG: Record<string, string> = {
  本命香: "#FDF3E7",
  进阶香: "#F5F0EB",
  尝试香: "#F0F4F4",
};

// 压缩过长的三调文案，避免在分享图里换行撑高行高
function compactNotes(notes: string | undefined, maxItems = 5): string | undefined {
  if (!notes) return notes;
  const sep = notes.includes("·") ? "·" : notes.includes(" / ") ? " / " : notes.includes("/") ? "/" : "·";
  const items = notes.split(sep).map((s) => s.trim()).filter(Boolean);
  if (items.length <= maxItems) return notes;
  return items.slice(0, maxItems).join(sep) + "…";
}

// ── 字体管理 ───────────────────────────────────────────────────────────────

let _fontData: Buffer | null = null;

async function getFont(): Promise<Buffer> {
  if (_fontData) return _fontData;
  const __dir = (() => { try { return dirname(fileURLToPath(import.meta.url)); } catch { return ""; } })();
  const candidates = [
    join(process.cwd(), "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "..", "..", "..", "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "..", "public", "fonts", "NotoSerifSC.woff"),
    join(__dir, "public", "fonts", "NotoSerifSC.woff"),
    "/var/task/public/fonts/NotoSerifSC.woff",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const buf = readFileSync(p);
      if (buf.byteLength > 0) { _fontData = buf; return _fontData; }
    } catch { /* try next */ }
  }
  // HTTP 兜底
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com";
    const res = await fetch(`${base}/fonts/NotoSerifSC.woff`);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 0) { _fontData = buf; return _fontData; }
    }
  } catch (e) {
    console.error("[shareCard] Font HTTP failed:", (e as Error).message);
  }
  _fontData = Buffer.alloc(0);
  return _fontData;
}

// ── 二维码生成 ─────────────────────────────────────────────────────────────

async function generateQR(url: string, size: number): Promise<string> {
  const buf = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    type: "png",
    width: size,
    margin: 2,
    color: { dark: C.AMBER_DARK, light: C.WHITE },
  });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ── 渐变圆环 SVG ───────────────────────────────────────────────────────────

function buildRingSVG(score: number, size: number): string {
  const cx = size / 2, cy = size / 2;
  // 大圆环：让数字舒适地居于环内，不再"出圈"
  const r = Math.round(size * 0.36);
  const rInner = Math.round(size * 0.26);
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const strokeW = Math.round(size * 0.012);
  const innerW = Math.max(1, Math.round(size * 0.005));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#C2A877"/>
        <stop offset="100%" stop-color="#8B7349"/>
      </linearGradient>
    </defs>
    <!-- 外圈：极淡背景环 -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(44,24,16,0.07)" stroke-width="${strokeW}"/>
    <!-- 内圈：虚线装饰环，增加调香感 -->
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="rgba(44,24,16,0.10)" stroke-width="${innerW}" stroke-dasharray="5 9"/>
    <!-- 分数进度弧：金色渐变，从顶部顺时针 -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${strokeW}"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

// ── 香水瓶 SVG（代码画瓶型，无外部图片）────────────────────────────────────

function buildBottleSVG(tier: string, size: number): string {
  const color = BOTTLE_COLOR[tier] ?? C.AMBER_ACCENT;
  const dark = C.AMBER_DARK;
  // 瓶型比例：总高 size，瓶身 68%，瓶盖 18%，瓶口 14%
  const bodyH = Math.round(size * 0.68);
  const capH = Math.round(size * 0.18);
  const neckH = Math.round(size * 0.14);
  const bodyW = Math.round(size * 0.58);
  const capW = Math.round(size * 0.32);
  const bodyX = (size - bodyW) / 2;
  const bodyY = capH + neckH;
  const capX = (size - capW) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bottleGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
        <stop offset="40%" stop-color="${color}"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.70"/>
      </linearGradient>
    </defs>
    <!-- 瓶盖 -->
    <rect x="${capX}" y="0" width="${capW}" height="${capH}" rx="${Math.round(capW*0.25)}" fill="${dark}"/>
    <!-- 瓶颈 -->
    <rect x="${(size-capW*0.5)/2}" y="${capH}" width="${Math.round(capW*0.5)}" height="${neckH}" fill="${color}" opacity="0.9"/>
    <!-- 瓶身 -->
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${Math.round(bodyW*0.12)}" fill="url(#bottleGrad)"/>
    <!-- 高光 -->
    <rect x="${bodyX+Math.round(bodyW*0.12)}" y="${bodyY+Math.round(bodyH*0.05)}" width="${Math.round(bodyW*0.12)}" height="${Math.round(bodyH*0.55)}" rx="${Math.round(bodyW*0.06)}" fill="${C.WHITE}" opacity="0.25"/>
  </svg>`;
}

// ── 香调 → 瓶身颜色（方案 A：三香瓶型按香调染色）──
const FAMILY_COLOR: Record<string, string> = {
  木质: "#B98A5E",
  柑橘: "#E0B84A",
  花香: "#D98AA8",
  东方: "#9A7BB5",
  清新: "#7FB0C0",
  美食: "#C98A6A",
};
const BOTTLE_COLOR: Record<string, string> = { ...TIER_COLOR, ...FAMILY_COLOR };

// 由三调关键词推断香调族（用于瓶身染色；无 notes 时回落 tier 色）
// 加权计分：避免单一关键词误命中，玫瑰/茉莉/紫罗兰/橙花等强花香标记权重更高
function inferFamily(notes?: string): string | undefined {
  if (!notes) return undefined;
  const FAMILY_ORDER = ["花香", "木质", "东方", "清新", "柑橘", "美食"];
  const scored: Array<[string[], string, number]> = [
    [["木", "雪松", "檀香", "香根草", "松", "柏", "橡"], "木质", 1],
    [["柑橘", "香柠檬", "柠檬", "橙", "佛手柑", "葡萄柚", "柚"], "柑橘", 1],
    [["玫瑰", "茉莉", "鸢尾", "紫罗兰", "铃兰", "晚香玉", "桂花", "牡丹", "橙花"], "花香", 2],
    [["花"], "花香", 1],
    [["琥珀", "香草", "麝香", "广藿香", "焚香", "没药", "乳香", "胡椒", "辛"], "东方", 1],
    [["海", "盐", "水", "莲", "青", "草", "薄荷", "茶", "无花果", "叶"], "清新", 1],
    [["焦糖", "可可", "咖啡", "坚果", "椰", "奶", "糖", "食"], "美食", 1],
  ];
  const counts: Record<string, number> = {};
  for (const [keys, fam, weight] of scored) {
    for (const k of keys) {
      let pos = notes.indexOf(k);
      while (pos !== -1) {
        counts[fam] = (counts[fam] || 0) + weight;
        pos = notes.indexOf(k, pos + 1);
      }
    }
  }
  if (Object.keys(counts).length === 0) return undefined;
  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return FAMILY_ORDER.indexOf(a[0]) - FAMILY_ORDER.indexOf(b[0]);
  });
  return sorted[0][0];
}

// ── 香气图谱（六维雷达图）──────────────────────────────────────────────────
// 维度顺序：上=木质，顺时针 → 清新 → 东方 → 美食 → 柑橘 → 花香
const RADAR_DIM_LIST = ['木质', '清新', '东方', '美食', '柑橘', '花香'];

interface RadarRenderResult { svg: any; labels: any[]; }

/**
 * 把维度标签渲染成 satori 绝对定位的 <div>，而不是放在内嵌 SVG 的 <text> 里。
 * 原因：satori 不支持嵌套 SVG 里的 <text>，中文字符会报 "convert them to <path>"；
 * 用 satori 自己的文字布局，字体继承 Noto Serif SC，标签清晰可读。
 */
function buildRadarLabels(
  JSX: any,
  values: Record<string, number>,
  size: number,
  vb: number,
  labelRadius: number,
  nameFontSize: number,
  showValue = true
): any[] {
  const CX = vb / 2;
  const CY = vb / 2;
  const scale = size / vb;
  const N = RADAR_DIM_LIST.length;
  const angleOf = (i: number) => -90 + i * (360 / N);
  const nameBox = Math.round(nameFontSize * 2.3);
  const valFontSize = Math.round(nameFontSize * 0.6);
  const boxW = nameBox + 18;
  const boxH = showValue ? nameBox + valFontSize + 8 : nameBox;
  return RADAR_DIM_LIST.map((dim, i) => {
    const angle = angleOf(i);
    const rad = (angle * Math.PI) / 180;
    const x = CX + labelRadius * Math.cos(rad);
    const y = CY + labelRadius * Math.sin(rad);
    const left = x * scale - boxW / 2;
    const top = y * scale - boxH / 2;
    const val = Math.round((values[dim] ?? 0) * 100);
    const children: any[] = [
      JSX('span', {
        style: {
          color: '#5A4632',
          fontSize: nameFontSize,
          fontWeight: 600,
          fontFamily: "'Noto Serif SC', serif",
          textAlign: 'center',
          lineHeight: 1.05,
        },
        children: RADAR_DIM_LABELS[dim] ?? dim,
      }),
    ];
    if (showValue) {
      children.push(JSX('span', {
        style: {
          color: '#A8884E',
          fontSize: valFontSize,
          fontWeight: 500,
          fontFamily: "'Noto Serif SC', serif",
          textAlign: 'center',
          marginTop: '3px',
          lineHeight: 1,
        },
        children: String(val),
      }));
    }
    return JSX('div', {
      key: `lab-${i}`,
      style: {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${boxW}px`,
        height: `${boxH}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
      children,
    });
  });
}

function buildRadarSVG(
  JSX: any,
  values: Record<string, number>,
  size: number,
  labelFontSize = 22
): RadarRenderResult {
  const VB = 460;
  const CX = VB / 2;
  const CY = VB / 2;
  const R = 140;
  const N = RADAR_DIM_LIST.length;
  const RINGS = [0.2, 0.4, 0.6, 0.8, 1];
  const toXY = (radius: number, angleDeg: number): { x: number; y: number } => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  };
  const angleOf = (i: number) => -90 + i * (360 / N);
  const VISUAL_FLOOR = 0.22;
  const visualValue = (v: number) => VISUAL_FLOOR + v * (1 - VISUAL_FLOOR);
  const ringPoints = (radius: number): string =>
    RADAR_DIM_LIST.map((_, i) => {
      const p = toXY(radius, angleOf(i));
      return `${p.x},${p.y}`;
    }).join(' ');
  const dataPoints = RADAR_DIM_LIST.map((dim, i) => {
    const p = toXY(R * visualValue(values[dim] ?? 0), angleOf(i));
    return `${p.x},${p.y}`;
  }).join(' ');

  const rings = RINGS.map((scale, idx) => {
    const isOuter = idx === RINGS.length - 1;
    return JSX('polygon', {
      key: `ring-${idx}`,
      points: ringPoints(R * scale),
      fill: 'none',
      stroke: '#9C7B47',
      strokeOpacity: isOuter ? 0.95 : 0.5,
      strokeWidth: isOuter ? 2.6 : 1.5,
      strokeDasharray: isOuter ? undefined : '5 4',
    });
  });

  const axes = RADAR_DIM_LIST.map((_, i) => {
    const p = toXY(R, angleOf(i));
    return JSX('line', {
      key: `axis-${i}`,
      x1: CX,
      y1: CY,
      x2: p.x,
      y2: p.y,
      stroke: '#9C7B47',
      strokeOpacity: 0.5,
      strokeWidth: 1.3,
    });
  });

  const dots = RADAR_DIM_LIST.map((dim, i) => {
    const p = toXY(R * visualValue(values[dim] ?? 0), angleOf(i));
    return JSX('circle', {
      key: `dot-${i}`,
      cx: p.x,
      cy: p.y,
      r: 3.6,
      fill: '#A8884E',
      stroke: '#F8F2E8',
      strokeWidth: 1.6,
    });
  });

  const svg = JSX('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: `0 0 ${VB} ${VB}`,
    children: [
      JSX('g', { key: 'rings', stroke: '#C2A877', fill: 'none', children: rings }),
      JSX('g', { key: 'axes', children: axes }),
      JSX('polygon', {
        key: 'poly',
        points: dataPoints,
        fill: 'rgba(168,136,78,0.22)',
        stroke: '#A8884E',
        strokeWidth: 2.8,
        strokeLinejoin: 'round',
      }),
      JSX('g', { key: 'dots', children: dots }),
    ],
  });

  const labels = buildRadarLabels(JSX, values, size, VB, R + 34, labelFontSize, true);
  return { svg, labels };
}

// ── 双人对冲雷达（A 金 / B 墨，叠加对比）──────────────────────────────────

function buildDualRadarSVG(JSX: any, valuesA: Record<string, number>, valuesB: Record<string, number>, size: number): RadarRenderResult {
  const VB = 380;
  const CX = VB / 2;
  const CY = VB / 2;
  const R = 128;
  const N = RADAR_DIM_LIST.length;
  const RINGS = [0.2, 0.4, 0.6, 0.8, 1];
  const toXY = (radius: number, angleDeg: number): { x: number; y: number } => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  };
  const angleOf = (i: number) => -90 + i * (360 / N);
  const VISUAL_FLOOR = 0.22;
  const visualValue = (v: number) => VISUAL_FLOOR + v * (1 - VISUAL_FLOOR);
  const ringPoints = (radius: number): string =>
    RADAR_DIM_LIST.map((_, i) => {
      const p = toXY(radius, angleOf(i));
      return `${p.x},${p.y}`;
    }).join(' ');
  const polyPoints = (vals: Record<string, number>): string =>
    RADAR_DIM_LIST.map((dim, i) => {
      const p = toXY(R * visualValue(vals[dim] ?? 0), angleOf(i));
      return `${p.x},${p.y}`;
    }).join(' ');

  const rings = RINGS.map((scale, idx) => {
    const isOuter = idx === RINGS.length - 1;
    return JSX('polygon', {
      key: `ring-${idx}`,
      points: ringPoints(R * scale),
      fill: 'none',
      stroke: '#9C7B47',
      strokeOpacity: isOuter ? 0.95 : 0.5,
      strokeWidth: isOuter ? 2.2 : 1.3,
      strokeDasharray: isOuter ? undefined : '4 3',
    });
  });

  const axes = RADAR_DIM_LIST.map((_, i) => {
    const p = toXY(R, angleOf(i));
    return JSX('line', {
      key: `axis-${i}`,
      x1: CX,
      y1: CY,
      x2: p.x,
      y2: p.y,
      stroke: '#9C7B47',
      strokeOpacity: 0.5,
      strokeWidth: 1.1,
    });
  });

  const dotsA = RADAR_DIM_LIST.map((dim, i) => {
    const p = toXY(R * visualValue(valuesA[dim] ?? 0), angleOf(i));
    return JSX('circle', {
      key: `dotA-${i}`,
      cx: p.x,
      cy: p.y,
      r: 2.8,
      fill: '#A8884E',
      stroke: '#F8F2E8',
      strokeWidth: 1.2,
    });
  });
  const dotsB = RADAR_DIM_LIST.map((dim, i) => {
    const p = toXY(R * visualValue(valuesB[dim] ?? 0), angleOf(i));
    return JSX('circle', {
      key: `dotB-${i}`,
      cx: p.x,
      cy: p.y,
      r: 2.8,
      fill: '#2A211B',
      stroke: '#F8F2E8',
      strokeWidth: 1.2,
    });
  });

  const svg = JSX('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: `0 0 ${VB} ${VB}`,
    children: [
      JSX('g', { key: 'rings', children: rings }),
      JSX('g', { key: 'axes', children: axes }),
      JSX('polygon', {
        key: 'polyA',
        points: polyPoints(valuesA),
        fill: 'rgba(168,136,78,0.20)',
        stroke: '#A8884E',
        strokeWidth: 2.4,
        strokeLinejoin: 'round',
      }),
      JSX('polygon', {
        key: 'polyB',
        points: polyPoints(valuesB),
        fill: 'rgba(42,33,27,0.10)',
        stroke: '#2A211B',
        strokeWidth: 2.4,
        strokeDasharray: '4 3',
        strokeLinejoin: 'round',
      }),
      JSX('g', { key: 'dotsA', children: dotsA }),
      JSX('g', { key: 'dotsB', children: dotsB }),
    ],
  });

  const labels = buildRadarLabels(JSX, valuesA, size, VB, R + 26, 30, false);
  return { svg, labels };
}

// ── 底部品牌行（共用）──────────────────────────────────────────────────────

function brandRow(qrBase64: string, qrSize: number, showBrand = true) {
  return {
    type: "bottom",
    qrBase64,
    qrSize,
    showBrand,
  };
}

// ── 页脚品牌带（大二维码 + 长按识别引导 + 短链兜底）────────────────────────
// 替代原角落小二维码：墨底带 + 大白底二维码 + 「长按识别二维码」文案，
// 让保存后的静态图自带行动召唤，弥补"缺少交互性"。
function buildFooterBand(
  JSX: any, qrBase64: string, qrSize: number,
  ctaMain: string, ctaSub: string, linkText: string
) {
  return JSX("div", {
    style: {
      display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", marginTop: "36px",
      background: C.INK, borderRadius: "20px", padding: "22px 30px", boxSizing: "border-box",
    },
    children: [
      JSX("img", {
        src: qrBase64, width: qrSize, height: qrSize,
        style: { borderRadius: "14px", background: C.WHITE, flexShrink: 0, border: `3px solid ${C.WHITE}` },
      }),
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-end", flexGrow: 1, marginLeft: "26px" },
        children: [
          JSX("span", { style: { color: C.PAPER, fontSize: "32px", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.2, textAlign: "right" }, children: ctaMain }),
          JSX("span", { style: { color: C.GOLD_SOFT, fontSize: "24px", marginTop: "6px", lineHeight: 1.35, textAlign: "right" }, children: ctaSub }),
          JSX("span", { style: { color: C.MUTED, fontSize: "28px", marginTop: "10px", letterSpacing: "0.04em", textAlign: "right" }, children: linkText }),
        ],
      }),
    ],
  });
}

// ── 核心渲染函数（分发三场景）──────────────────────────────────────────────

// 内部：只构建并返回 satori 的 SVG（便于本地布局验证）
async function buildSvg(
  data: ShareCardData,
  format: "3to4" = "3to4"
): Promise<{ svgRaw: string; W: number; H: number }> {
  const fontData = await getFont();
  const W = 1080;
  // 两段式自适应高度（2026-08-25）：
  // 1) 用超高空画布（2200）渲染，footer 紧跟内容自然流动（无 flexGrow 拉伸）
  // 2) renderShareCard 里逐行扫描真实内容底，裁掉底部空白、保留 52px 留白
  // → 各场景高度自动贴合内容，彻底杜绝「内容超高 → footer 被挤出画布被裁」
  const H = 2200;
  // 上下留白 52：顶部由布局使用，底部由裁切逻辑还原
  const pad = "52px 64px";
  // 二维码：240px（屏显≈77px，长按识别稳定可扫；同时避免撑高 footer）
  const qrSize = 240;

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crushxiangjian.com";

  // 动态导入 satori
  // @ts-ignore
  const satoriMod: any = await import("satori");
  const satori = satoriMod.default;
  // @ts-ignore
  const jsxMod: any = await import("satori/jsx/jsx-runtime");
  const JSX = jsxMod.jsx;

  // QR 目标 URL 按场景决定
  let qrUrl = base;
  if (data.scene === "friend" || data.scene === "shared") {
    const code = (data as FriendShareData | SharedShareData).inviteCode;
    if (code) qrUrl = `${base}/friend?inv=${code}`;
  }

  const qrBase64 = await generateQR(qrUrl, qrSize);

  // 分场景渲染
  let root: any;
  if (data.scene === "self") {
    root = buildSelfCard(JSX, data as SelfShareData, W, H, pad, qrBase64, qrSize, base, fontData);
  } else if (data.scene === "friend") {
    root = buildFriendCard(JSX, data as FriendShareData, W, H, pad, qrBase64, qrSize, base, satori, buildRingSVG, fontData);
  } else if (data.scene === "shared") {
    root = buildSharedCard(JSX, data as SharedShareData, W, H, pad, qrBase64, qrSize, base, buildBottleSVG, fontData);
  } else {
    root = buildDailyCard(JSX, data as DailyShareData, W, H, pad, qrBase64, qrSize, base, fontData);
  }

  const svgRaw = await (satori as any)(root, {
    width: W, height: H,
    fonts: fontData.byteLength > 0
      ? [
          { name: "Noto Serif SC", data: fontData, weight: 400 as const, style: "normal" as const },
          { name: "Noto Serif SC", data: fontData, weight: 700 as const, style: "normal" as const },
        ]
      : [],
  });

  return { svgRaw, W, H };
}

export async function renderShareCard(
  data: ShareCardData,
  format: "3to4" = "3to4"
): Promise<Buffer> {
  const { svgRaw } = await buildSvg(data, format);
  // sharp 改为运行时动态 import：避免顶层原生模块 import 在 serverless 运行时
  // 加载失败导致整模块崩溃（/api/share-card 全部 500）。
  const sharp = (await import("sharp")).default;

  // ── 两段式自适应高度 · 第二段：扫描真实内容底，裁掉高空画布的底部空白 ──
  // 高空画布（2200）只是脚手架：footer 已改为 marginTop 紧跟内容自然流动，
  // 内容超高也只会被画布底部留白吸收，绝不会再把 footer 挤出画布被裁。
  // 1) SVG 直接光栅化为 raw 像素（不落中间 PNG，省一次编解码）
  // 2) 自底向上找最后一行含墨色的行 → 内容真实底边 contentBottom
  //    背景 #FAF3EA 的 R≈250；阈值取 210：墨字/墨底(R≈44)与金线(R≈168)都命中，
  //    而浅色底纹的 R 均在 210 以上，不会误判
  // 3) 裁到 contentBottom + 52px（还原设计底部留白）再编码 PNG
  const { data: px, info } = await sharp(Buffer.from(svgRaw))
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const rowStride = info.width * ch;
  let contentBottom = info.height - 1;
  for (let y = info.height - 1; y >= 0; y--) {
    const rowStart = y * rowStride;
    let hasInk = false;
    for (let x = 0; x < info.width; x++) {
      if (px[rowStart + x * ch] < 210) { hasInk = true; break; } // 只看 R 通道即可区分
    }
    if (hasInk) { contentBottom = y; break; }
  }

  const finalH = Math.min(info.height, contentBottom + 1 + 52);
  return await sharp(px, { raw: { width: info.width, height: info.height, channels: ch } })
    .extract({ left: 0, top: 0, width: info.width, height: finalH })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

// 调试/验证用：返回 SVG 字符串（供本地布局溢出检测）
export async function renderShareCardSVG(
  data: ShareCardData,
  format: "3to4" = "3to4"
): Promise<string> {
  const { svgRaw } = await buildSvg(data, format);
  return svgRaw;
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景一：结果页本人（self）
// 布局：人格名大字 → 三香横排 → tagline → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildSelfCard(
  JSX: any, d: SelfShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, fontData: Buffer
) {
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // ── 3:4 单一长图：所有字号按屏显 0.32 倍率、目标 ≥ 11pt 反推升级 ──
  // 屏显 11pt ≈ 14.6px screen，对应画布 PX = 14.6 / 0.32 ≈ 46
  // → 正文 ≥ 28、品牌 ≥ 22、标题 ≥ 50、雷达标签 ≥ 42

  // 报头：品牌小标（无装饰杠，纯文字）
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", marginBottom: "10px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: "30px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
    ],
  });

  // 注：删除 eyebrow「灵魂香气鉴定」——它是 hero 上方的小字提示（hint），
  // 削弱人格名本身的字标感，且与"提示词要删掉"的诉求一致（2026-08-26 版式收敛）

  // 巨型人格名（字标）
  const hero = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "6px" },
    children: [JSX("span", { style: { color: INK, fontSize: "76px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "0.06em" }, children: d.name })],
  });
  // 注：删除 heroRule 装饰金线——多色描边在微信保存后观感杂乱（2026-08-26 版式收敛）

  // tagline 扎心句（斜体）
  const tagline = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "8px", marginBottom: "8px" },
    children: [JSX("span", { style: { color: "#5A4A39", fontSize: "32px", fontStyle: "italic", textAlign: "center", lineHeight: 1.5 }, children: d.tagline })],
  });

  // 记忆点（令人心动的瞬间）—— HERO 区块
  // 行宽 840（padding 56×2）：≈28 字/行，真实文案 max 55 字（p95=54）→ 2 行；
  // 截断 58 字兜底：即使 3 行（49px）也有余量，不会挤爆 1620 画布
  const memoryText = !d.memoryScene ? "" : d.memoryScene.length > 58 ? `${d.memoryScene.slice(0, 56)}…` : d.memoryScene;
  // 注：删除 memoryHead「令人心动的瞬间」金标——它是 HERO 区块的小段标，归入"提示词"
  // 一并清理（2026-08-26 用户反馈："提示词都要删掉"）。memoryText 单独成段，更干净
  const memoryEl = d.memoryScene ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingLeft: "56px", paddingRight: "56px", marginBottom: "4px" },
    children: [
      JSX("span", { style: { color: "#4A3C2E", fontSize: "30px", lineHeight: 1.65, textAlign: "center", letterSpacing: "0.02em" }, children: memoryText }),
    ],
  }) : null;

  // 香气图谱（六维雷达图）—— 3:4 专属深度内容
  // 标签字号走 buildRadarSVG 默认 22（屏显 ≈ 7pt，与数字联动），不再显式传 36
  const radarEl = d.radar ? (() => {
    const radarSize = 280;
    const { svg: radarSVG, labels: radarLabels } = buildRadarSVG(JSX, d.radar, radarSize);
    return JSX("div", {
      style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", marginTop: "6px", marginBottom: "6px" },
      children: [
        JSX("div", {
          style: { position: "relative", width: radarSize, height: radarSize, display: "flex" },
          children: [radarSVG, ...radarLabels],
        }),
      ],
    });
  })() : null;

  // 香气台账（左侧瓶型按香调染色）
  const perfumeNotes = [d.notesA, d.notesB, d.notesC].map((n) => compactNotes(n, 4));
  const perfumeBrands = [d.brandA, d.brandB, d.brandC];
  const ledgerRows = [d.perfumeA, d.perfumeB, d.perfumeC].map((p, i) => {
    const notes = perfumeNotes[i];
    const brand = perfumeBrands[i];
    const family = inferFamily(notes);
    const accent = family ? (BOTTLE_COLOR[family] ?? GOLD) : (TIER_COLOR[p.tier] ?? GOLD);
    const bottleSize = 76;
    const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVG(family ?? p.tier, bottleSize)).toString("base64")}`;
    return JSX("div", {
      style: {
        display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: "4px", paddingBottom: "4px",
      },
      children: [
        JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", flexShrink: 0, marginRight: "22px" } }),
        JSX("div", {
          style: { display: "flex", flexDirection: "column", alignItems: "flex-start", flexGrow: 1, marginRight: "16px" },
          children: [
            JSX("span", { style: { color: accent, fontSize: "22px", letterSpacing: "0.22em", marginBottom: "4px" }, children: p.tier }),
            JSX("span", { style: { color: INK, fontSize: "30px", fontWeight: 600, lineHeight: 1.2, marginBottom: (brand || notes) ? "4px" : "0px" }, children: p.name }),
            brand ? JSX("span", { style: { color: MUTED, fontSize: "24px", letterSpacing: "0.14em", marginBottom: notes ? "3px" : "0px" }, children: brand }) : null,
            notes ? JSX("span", { style: { color: MUTED, fontSize: "22px", letterSpacing: "0.03em", lineHeight: 1.35 }, children: notes }) : null,
          ].filter(Boolean),
        }),
        JSX("span", { style: { color: INK, fontSize: "48px", fontWeight: 500, lineHeight: 1, paddingTop: "2px", flexShrink: 0 }, children: `${p.match}%` }),
      ],
    });
  });
  const ledger = JSX("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: ledgerRows });

  // 用香哲学（编辑式金句）
  const philosophyEl = (d.scentPhilosophy) ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingLeft: "40px", paddingRight: "40px", marginTop: "6px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: "28px", lineHeight: 1.7, textAlign: "center", letterSpacing: "0.02em" }, children: `“${d.scentPhilosophy}”` }),
    ],
  }) : null;

  // 注：「香调偏好 top3」区块已移除——与六维雷达图信息重复，
  // 且 1620 画布下挤占底部品牌带空间（2026-08-25 版式收敛）

  // 分段小标题（无装饰线，纯文字）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: "10px", marginBottom: "6px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: "32px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
    ],
  });

  // 页脚品牌带（大二维码 + 长按识别引导，弥补静态图缺少交互性）
  const linkText = _base.replace(/^https?:\/\//, "");
  const bottomRow = buildFooterBand(JSX, qrBase64, qrSize, "长按识别二维码", "测你的灵魂香气 →", linkText);

  const centerChildren: any[] = [masthead, hero, tagline];
  if (memoryEl) centerChildren.push(memoryEl); // HERO 区：记忆点紧贴 tagline 后
  if (radarEl) centerChildren.push(secHead("香气图谱"), radarEl);
  centerChildren.push(secHead("为你调的三支香"), ledger);
  if (philosophyEl) centerChildren.push(secHead("用香哲学"), philosophyEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`, boxSizing: "border-box",
      background: C.BG, padding: pad, position: "relative",
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" },
        children: centerChildren,
      }),
      bottomRow,
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景二：朋友匹配页（friend）
// 布局：A 60%左 / B 40%右 → 圆环居中契合度 → tier → 关系句 → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildFriendCard(
  JSX: any, d: FriendShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, _satori: any, buildRingSVGFn: (score: number, size: number) => string, fontData: Buffer
) {
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;
  // 圆环 240（原 280）：1620 画布下腾出 40px，90px 分数在环内仍舒展
  const ringSize = 240;
  const ringBase64 = `data:image/svg+xml;base64,${Buffer.from(buildRingSVGFn(d.score, ringSize)).toString("base64")}`;

  // 报头：品牌小标（无左右发丝线装饰）
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", marginBottom: "18px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: "28px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
    ],
  });

  // 注：删除 eyebrow「香气默契鉴定 · COMPATIBILITY」——上方 hint 提示词（2026-08-26 版式收敛）

  // 区块小标题（无装饰线，纯文字）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: "14px", marginBottom: "12px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: "32px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
    ],
  });

  // 双人列（A × B 字标 + 本命香 + 品牌 + 三调）
  const pairCol = (name: string, perfumeName: string, brand: string | undefined, notes: string | undefined, align: "flex-start" | "flex-end") => JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: align, flex: "0 0 40%" },
    children: [
      JSX("span", { style: { color: INK, fontSize: "84px", fontWeight: 600, lineHeight: 1.05, letterSpacing: "0.04em" }, children: name }),
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: align, marginTop: "16px" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: "26px", letterSpacing: "0.04em" }, children: `本命香 · ${perfumeName || ""}` }),
          brand ? JSX("span", { style: { color: MUTED, fontSize: "22px", letterSpacing: "0.14em", marginTop: "10px" }, children: brand }) : null,
          notes ? JSX("span", { style: { color: "#7A6A56", fontSize: "22px", letterSpacing: "0.03em", marginTop: "8px", lineHeight: 1.5 }, children: notes }) : null,
        ].filter(Boolean),
      }),
    ],
  });
  const pair = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "100%", marginBottom: "20px" },
    children: [
      pairCol(d.nameA, d.perfumeNameA, d.brandA, d.notesA, "flex-start"),
      JSX("span", { style: { color: GOLD, fontSize: "60px", alignSelf: "center" }, children: "×" }),
      pairCol(d.nameB, d.perfumeNameB, d.brandB, d.notesB, "flex-end"),
    ],
  });

  // 共鸣度核心视觉：双细线圆环 + 居中数字 + 上方小标
  const ringContainer = JSX("div", {
    style: { position: "relative", display: "flex", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: "16px" },
    children: [
      JSX("img", { src: ringBase64, width: ringSize, height: ringSize, style: { position: "absolute", top: "0px", left: "0px" } }),
      JSX("div", {
        style: { position: "absolute", top: "0px", left: "0px", right: "0px", bottom: "0px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: GOLD, fontSize: "22px", letterSpacing: "0.28em", marginBottom: "12px" }, children: "共鸣度" }),
          JSX("span", { style: { color: INK, fontSize: "90px", fontWeight: 600, lineHeight: 1, letterSpacing: "0.02em" }, children: String(d.score) }),
        ],
      }),
    ],
  });

  // tier 徽章（描边胶囊）
  const tierBadge = JSX("div", {
    style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${GOLD}`, borderRadius: "999px", padding: "12px 40px", marginTop: "10px", marginBottom: "14px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: "32px", letterSpacing: "0.14em" }, children: d.tier })],
  });

  // 关系解读句（安全截断 72 字：最多 3 行，防止挤爆画布）
  const storyText = d.story.length > 72 ? `${d.story.slice(0, 70)}…` : d.story;
  const story = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "16px" },
    children: [JSX("span", { style: { color: "#4A3C2E", fontSize: "32px", textAlign: "center", lineHeight: 1.5 }, children: storyText })],
  });

  // 相处建议句（基于 tier 生成一句克制建议）
  const ADVICE_MAP: Record<string, string> = {
    "气息同频": "你们是同一支香的两种写法，留一点距离，香气会更清楚。",
    "默契成对": "他补上你缺的那一味，别急着调成一样。",
    "互补有趣": "不一样才好玩，先闻闻对方世界里没去过的那块。",
    "各有所爱": "你们合起来，是一整座调香台。",
    "气质迥异": "不必勉强同频，记住这股味道就好。",
    "灵魂伴侣": "你们是同一支香的两种写法，留一点距离，香气会更清楚。",
    "灵魂共振": "你们是同一支香的两种写法，留一点距离，香气会更清楚。",
    "天生一对": "他补上你缺的那一味，别急着调成一样。",
    "互补搭档": "他补上你缺的那一味，别急着调成一样。",
    "有趣的碰撞": "不一样才好玩，先闻闻对方世界里没去过的那块。",
    "气味互补": "你们合起来，是一整座调香台。",
    "不同的香气世界": "不必勉强同频，记住这股味道就好。",
  };
  const adviceText = ADVICE_MAP[d.tier] ?? "香气不同没关系，相遇本身就是一次调香。";
  const advice = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "20px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: "28px", fontStyle: "italic", textAlign: "center", lineHeight: 1.5 }, children: adviceText })],
  });

  // 合香卡（CP 共振核心产物）——分享图统一精简行「合香 {名} · 隔 X 调」
  const cpDiffText = d.cpDiffTones === undefined ? undefined : d.cpDiffTones === 0 ? "同调" : `隔 ${d.cpDiffTones} 调`;
  const cpLine = d.cpBlendName ? JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "16px" },
    children: [
      JSX("span", { style: { color: GOLD, fontSize: "26px" }, children: "合香" }),
      JSX("span", { style: { color: INK, fontSize: "38px", fontWeight: 600, marginLeft: "20px" }, children: d.cpBlendName }),
      cpDiffText ? JSX("span", { style: { color: MUTED, fontSize: "24px", marginLeft: "18px" }, children: cpDiffText }) : null,
    ].filter(Boolean),
  }) : null;

  // 双人香气光谱对比（仅长图，金=A / 墨=B）
  const dualRadarEl = (d.radarA && d.radarB) ? (() => {
    // 双雷达 260（原 280）：为 1620 画布腾空间
    const rSize = 260;
    const { svg: rSvg, labels: rLabels } = buildDualRadarSVG(JSX, d.radarA!, d.radarB!, rSize);
    return JSX("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: "0px" },
      children: [
        secHead("香气光谱对比"),
        JSX("div", {
          style: { position: "relative", width: rSize, height: rSize, display: "flex" },
          children: [rSvg, ...rLabels],
        }),
        JSX("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "14px" },
          children: [
            JSX("span", { style: { display: "flex", width: "16px", height: "16px", borderRadius: "4px", background: "#A8884E", marginRight: "10px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "32px", marginRight: "28px" }, children: d.nameA }),
            JSX("span", { style: { display: "flex", width: "16px", height: "16px", borderRadius: "4px", background: "#2A211B", marginRight: "10px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "32px" }, children: d.nameB }),
          ],
        }),
      ],
    });
  })() : null;

  // 共享香调（发丝线胶囊）
  const sharedEl = d.sharedNotes && d.sharedNotes.length > 0
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: "8px" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: "26px", letterSpacing: "0.2em", marginRight: "18px" }, children: "共享香调" }),
          ...d.sharedNotes.slice(0, 4).map((n, i) =>
            JSX("div", {
              key: i,
              style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${HAIR}`, borderRadius: "999px", padding: "10px 28px", margin: "6px", background: "rgba(255,255,255,0.4)" },
              children: [JSX("span", { style: { color: "#5A4A39", fontSize: "26px" }, children: n })],
            })
          ),
        ],
      })
    : null;

  // 页脚品牌带（大二维码 + 长按识别引导）
  const linkText = _base.replace(/^https?:\/\//, "");
  const bottomRow = buildFooterBand(JSX, qrBase64, qrSize, "长按识别二维码", "邀 TA 测测契合度 →", linkText);

  const centerChildren: any[] = [pair, ringContainer, tierBadge, story, advice];
  if (cpLine) centerChildren.push(cpLine);
  if (dualRadarEl) centerChildren.push(dualRadarEl);
  if (sharedEl) centerChildren.push(sharedEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`, boxSizing: "border-box",
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      masthead,
      JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }, children: centerChildren }),
      bottomRow,
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景三：/shared 分享卡（shared）
// 布局：品牌行 → "这是 XXX 的香气" 副标题 → 人格名大字 → description → 本命香瓶+名 → CTA大字 → 品牌行+QR
// ─────────────────────────────────────────────────────────────────────────────

function buildSharedCard(
  JSX: any, d: SharedShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, buildBottleSVGFn: (tier: string, size: number) => string, fontData: Buffer
) {
  const bottleSize = 220;
  const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVGFn("本命香", bottleSize)).toString("base64")}`;

  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // 注：brandLine 左右两侧 borderTop 发丝线删除——归入"框线/装饰线"清理
  // （用户 2026-08-26 反馈："顶部底部框线都要删"）。仅保留居中的 Crush 香鉴 品牌小标
  const brandLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", marginBottom: "20px" },
    children: [
      JSX("span", {
        style: { color: C.TEXT_MUTED, fontSize: "26px", letterSpacing: "0.2em", whiteSpace: "nowrap" },
        children: "Crush 香鉴",
      }),
    ],
  });

  // 副标题
  const subtitle = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "10px" },
    children: [
      JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "28px" }, children: `这是 ${d.sharerName} 的香气` }),
    ],
  });

  // 人格名大字
  const nameBlock = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_DARK, fontSize: "108px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "0.06em" },
        children: d.name,
      }),
    ],
  });

  // description
  const descEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "16px" },
    children: [
      JSX("span", { style: { color: C.AMBER_MID, fontSize: "30px", textAlign: "center", lineHeight: 1.5 }, children: d.description }),
    ],
  });

  // 用香哲学（编辑式金句）
  const philosophyEl = d.scentPhilosophy
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", paddingLeft: "60px", paddingRight: "60px", marginBottom: "24px" },
        children: [
          JSX("span", {
            style: { color: C.AMBER_DARK, fontSize: "30px", lineHeight: 1.7, textAlign: "center", letterSpacing: "0.02em" },
            children: `“${d.scentPhilosophy}”`,
          }),
        ],
      })
    : null;

  // 本命香瓶 + 名
  const perfumeBlock = JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      background: C.WHITE, borderRadius: "24px",
      padding: "28px 36px",
      marginBottom: "32px",
      boxShadow: `0 4px 20px rgba(92,56,38,0.10)`,
    },
    children: [
      JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", marginBottom: "16px" } }),
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: "32px", fontWeight: 700, textAlign: "center", marginBottom: "12px" }, children: d.perfumeName }),
      JSX("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "center", background: TIER_BG["本命香"], borderRadius: "999px", padding: "6px 22px", border: `1px solid ${TIER_COLOR["本命香"]}40` },
        children: [JSX("span", { style: { color: TIER_COLOR["本命香"], fontSize: "28px", fontWeight: 600 }, children: "本命香" })],
      }),
    ],
  });

  // CTA
  const ctaEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "20px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_ACCENT, fontSize: "36px", fontWeight: 700, letterSpacing: "0.04em" },
        children: "3 分钟测你的香气 >",
      }),
    ],
  });

  // 页脚品牌带（大二维码 + 长按识别引导）
  const linkText = _base.replace(/^https?:\/\//, "");
  const bottomRow = buildFooterBand(JSX, qrBase64, qrSize, "长按识别二维码", "3 分钟测你的香气 →", linkText);

  return JSX("div", {
    style: {
      // 两段式自适应：不钉底，footer 靠自身 marginTop 紧跟内容（高空画布下 space-between 会撑出大空档）
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`, boxSizing: "border-box",
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" },
        children: [brandLine, subtitle, nameBlock, descEl, ...(philosophyEl ? [philosophyEl] : []), perfumeBlock, ctaEl],
      }),
      bottomRow,
    ],
  });
}

// ── 内存缓存（LRU，50 条 / 5 分钟 TTL）────────────────────────────────────

const _cache = new Map<string, { buffer: Buffer; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

function _cacheKey(data: ShareCardData, format: string) {
  const base = `${data.scene}|${format}`;
  if (data.scene === "self") {
    const d = data as SelfShareData;
    return `${base}|${d.name}|${d.perfumeA.match}|${d.perfumeB.match}|${d.perfumeC.match}`;
  } else if (data.scene === "friend") {
    const d = data as FriendShareData;
    return `${base}|${d.nameA}|${d.nameB}|${d.score}|${d.cpBlendName ?? ''}|${d.cpDiffTones ?? ''}`;
  } else {
    const d = data as SharedShareData;
    return `${base}|${d.sharerName}|${d.name}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 场景四：今日香签（daily）
// 布局：报头 → 今日香签标题 → 日期 → 三笺（启示/主香/启示）→ 结语 → 页脚QR
// ─────────────────────────────────────────────────────────────────────────────

function buildDailyCard(
  JSX: any, d: DailyShareData, W: number, H: number, pad: string,
  qrBase64: string, qrSize: number, _base: string, fontData: Buffer
) {
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // 报头：品牌小标（无装饰杠，纯文字）
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", marginBottom: "16px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: "30px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
    ],
  });

  // 标题
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "12px" },
    children: [JSX("span", { style: { color: INK, fontSize: "36px", fontWeight: 700, letterSpacing: "0.18em", fontFamily: "serif" }, children: "· 今日香签 ·" })],
  });

  // 日期 + 星期
  const [y, m, day] = d.date.split("-").map(Number);
  const wd = "日一二三四五六"[new Date(y, m - 1, day).getDay()];
  const dateLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "16px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: "26px", letterSpacing: "0.2em" }, children: `${d.date.replace(/-/g, ".")} 星期${wd}` })],
  });

  // 解析「前 X ｜ 中 Y ｜ 后 Z」为三段
  function parseNotes(s: string): { top: string; heart: string; base: string } {
    const parts = s.split(" ｜ ");
    return {
      top: parts[0]?.replace(/^前\s*/, "") ?? "",
      heart: parts[1]?.replace(/^中\s*/, "") ?? "",
      base: parts[2]?.replace(/^后\s*/, "") ?? "",
    };
  }

  // 单笺
  const strip = (
    label: string, name: string, brand: string, description: string,
    notes: string, rarity: string, isMain: boolean
  ) =>
    JSX("div", {
      style: {
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        background: C.PAPER, borderRadius: "18px",
        padding: "22px 16px",
      },
      children: [
        JSX("span", { style: { color: MUTED, fontSize: "22px", letterSpacing: "0.22em" }, children: label }),
        rarity
          ? JSX("span", { style: { marginTop: "6px", color: GOLD, fontSize: "20px", border: `1px solid ${GOLD}`, borderRadius: "4px", padding: "0px 8px", letterSpacing: "0.1em" }, children: rarity })
          : JSX("span", { style: { marginTop: "6px", height: "22px" }, children: "" }),
        JSX("span", { style: { color: INK, fontFamily: "serif", fontWeight: 700, fontSize: "30px", marginTop: "12px", textAlign: "center", lineHeight: 1.25, letterSpacing: "0.04em" }, children: name }),
        JSX("span", { style: { color: MUTED, fontSize: "20px", marginTop: "6px" }, children: brand }),
        JSX("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", marginTop: "12px" },
          children: [JSX("span", { style: { display: "block", width: "30px", height: "1px", background: "rgba(168,136,78,0.55)" }, children: "" })],
        }),
        JSX("span", {
          style: {
            display: "block", width: "100%", color: "#5A4E3E",
            fontFamily: "serif", fontSize: "18px",
            marginTop: "10px", textAlign: "center", lineHeight: 1.6, letterSpacing: "0.02em",
          },
          children: description,
        }),
        JSX("div", {
          style: {
            display: "flex", flexDirection: "column", alignItems: "center",
            marginTop: "auto", paddingTop: "12px", width: "100%",
          },
          children: [
            JSX("span", { style: { color: GOLD, fontSize: "16px", letterSpacing: "0.3em", marginBottom: "4px" }, children: "香 调" }),
            JSX("span", { style: { color: MUTED, fontSize: "18px", lineHeight: 1.55 }, children: `前 · ${parseNotes(notes).top}` }),
            JSX("span", { style: { color: MUTED, fontSize: "18px", lineHeight: 1.55 }, children: `中 · ${parseNotes(notes).heart}` }),
            JSX("span", { style: { color: MUTED, fontSize: "18px", lineHeight: 1.55 }, children: `后 · ${parseNotes(notes).base}` }),
          ],
        }),
      ],
    });

  const strips = JSX("div", {
    style: { display: "flex", flexDirection: "row", gap: "18px", width: "100%", marginTop: "4px" },
    children: [
      strip("启示", d.inspirationA.name, d.inspirationA.brandCn, d.inspirationA.description, d.inspirationA.notes, d.inspirationA.rarity, false),
      strip("主香", d.main.name, d.main.brandCn, d.main.description, d.main.notes, d.main.rarity, true),
      strip("启示", d.inspirationB.name, d.inspirationB.brandCn, d.inspirationB.description, d.inspirationB.notes, d.inspirationB.rarity, false),
    ],
  });

  // 今日宜忌
  const alm = d.almanac;
  const almanacBlock = alm
    ? JSX("div", {
        style: {
          display: "flex", flexDirection: "column", width: "100%",
          marginTop: "20px",
          padding: "20px 26px",
          background: C.PAPER, borderRadius: "18px",
        },
        children: [
          JSX("div", {
            style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "14px" },
            children: [JSX("span", { style: { color: INK, fontSize: "28px", fontWeight: 700, letterSpacing: "0.18em", fontFamily: "serif" }, children: "今日宜忌" })],
          }),
          JSX("div", {
            style: { display: "flex", flexDirection: "row", gap: "28px", width: "100%" },
            children: [
              JSX("div", {
                style: { flex: 1, display: "flex", flexDirection: "column" },
                children: [
                  JSX("span", { style: { color: GOLD, fontSize: "22px", letterSpacing: "0.1em" }, children: "宜" }),
                  ...alm.yi.map((x, i) =>
                    JSX("span", { key: i, style: { color: INK, fontSize: "22px", lineHeight: 1.7, marginTop: i === 0 ? 8 : 0 }, children: x })),
                ],
              }),
              JSX("div", {
                style: { flex: 1, display: "flex", flexDirection: "column" },
                children: [
                  JSX("span", { style: { color: "#9A8E7C", fontSize: "22px", letterSpacing: "0.1em" }, children: "忌" }),
                  ...alm.ji.map((x, i) =>
                    JSX("span", { key: i, style: { color: "#6B5E4C", fontSize: "22px", lineHeight: 1.7, marginTop: i === 0 ? 8 : 0 }, children: x })),
                ],
              }),
            ],
          }),
          JSX("span", {
            style: { display: "block", textAlign: "center", color: MUTED, fontSize: "20px", fontStyle: "italic", marginTop: "14px", lineHeight: 1.6 },
            children: alm.note,
          }),
        ],
      })
    : null;

  // 注：删除结语 footnote「香签是今日的一缕灵感，不是预言。」——免责式 hint 提示词（2026-08-26 版式收敛）

  // 页脚品牌带
  const linkText = _base.replace(/^https?:\/\//, "");
  const bottomRow = buildFooterBand(JSX, qrBase64, qrSize, "长按识别二维码", "今日香签每日更新 →", linkText);

  const topSection = JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }, children: [masthead, eyebrow, dateLine, strips, almanacBlock] });
  const bottomSection = JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }, children: [bottomRow] });

  return JSX("div", {
    style: {
      // 两段式自适应：不钉底，footer 靠自身 marginTop 紧跟内容（高空画布下 space-between 会撑出大空档）
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`, boxSizing: "border-box",
      background: C.BG, padding: pad, position: "relative",
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [topSection, bottomSection],
  });
}

export async function renderShareCardCached(
  data: ShareCardData,
  format: "3to4" = "3to4"
): Promise<Buffer> {
  const key = _cacheKey(data, format);
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.buffer;

  const buffer = await renderShareCard(data, format);

  if (_cache.size >= CACHE_MAX) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    _cache.delete(oldest[0]);
  }
  _cache.set(key, { buffer, ts: Date.now() });
  return buffer;
}
