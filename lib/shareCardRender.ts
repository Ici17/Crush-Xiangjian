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
 * 输出：1:1 (1080×1080) / 3:4 (1080×1440)
 *
 * ⚠️ satori 布局规则（v0.29）：
 *   1. 所有 <div> 必须显式 display: flex / contents / none
 *   2. inset shorthand 不支持 → 用 top/left/right/bottom
 *   3. gap 不支持 → 用 margin
 *   4. <p>/<ul> 等默认不是 flex → 用 <div>/<span> 代替
 *   5. 分隔线：用 <span> + border-top
 *   6. 绝对定位：父 div 需 display:flex，overlay 子 div 也需 display:flex
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
  format?: "1to1" | "3to4";
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
  format?: "1to1" | "3to4";
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
  format?: "1to1" | "3to4";
}

export interface DailyShareData {
  scene: "daily";
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  main: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  inspirationA: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  inspirationB: { name: string; brandCn: string; description: string; notes: string; rarity: string };
  almanac?: { yi: string[]; ji: string[]; note: string };
  format?: "1to1" | "3to4";
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
  labelFontSize = 34
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

  const labels = buildRadarLabels(JSX, valuesA, size, VB, R + 26, 20, false);
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

// ── 核心渲染函数（分发三场景）──────────────────────────────────────────────

// 内部：只构建并返回 satori 的 SVG（便于本地布局验证）
async function buildSvg(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
): Promise<{ svgRaw: string; W: number; H: number }> {
  const fontData = await getFont();
  const W = 1080;
  const H = format === "1to1" ? 1080 : 1440;
  const pad = format === "3to4" ? "80px 64px" : "52px";
  const qrSize = format === "1to1" ? 108 : 100;

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
  format: "1to1" | "3to4" = "1to1"
): Promise<Buffer> {
  const { svgRaw } = await buildSvg(data, format);
  // sharp 改为运行时动态 import：避免顶层原生模块 import 在 serverless 运行时
  // 加载失败导致整模块崩溃（/api/share-card 全部 500）。
  const sharp = (await import("sharp")).default;
  const pngBuffer = await sharp(Buffer.from(svgRaw)).png({ compressionLevel: 8 }).toBuffer();
  return pngBuffer;
}

// 调试/验证用：返回 SVG 字符串（供本地布局溢出检测）
export async function renderShareCardSVG(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
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
  const is3to4 = H > W;
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // 报头：品牌小标 + 下方短居中灰杠（轻量锚点，与名字处金色短杠呼应）
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginBottom: is3to4 ? "12px" : "22px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
      JSX("span", { style: { width: "120px", height: "1px", background: HAIR, marginTop: is3to4 ? "14px" : "16px" }, children: "" }),
    ],
  });

  // eyebrow
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "10px" : "10px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "25px" : "22px", letterSpacing: "0.26em" }, children: "灵魂香气鉴定" })],
  });

  // 巨型人格名（字标）
  const hero = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center" },
    children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "54px" : "50px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "0.06em" }, children: d.name })],
  });
  const heroRule = JSX("div", {
    style: { display: "flex", width: "120px", height: "2px", background: GOLD, marginTop: is3to4 ? "12px" : "10px", marginBottom: is3to4 ? "10px" : "10px" },
  });

  // tagline 扎心句（斜体）
  const tagline = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "14px" },
    children: [JSX("span", { style: { color: "#5A4A39", fontSize: is3to4 ? "21px" : "21px", fontStyle: "italic", textAlign: "center", lineHeight: 1.85 }, children: d.tagline })],
  });

  // 区块小标题（纯文字标签，去掉右侧灰色细杠）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: is3to4 ? "14px" : "14px", marginBottom: "8px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "23px" : "20px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
    ],
  });

  // 香气图谱（六维雷达图）——1:1 空间有限不展示，仅 3:4 展示
  // 3:4 下放大到 280px，标签字号 42px，确保维度名与香调名清晰可读。
  const radarEl = (is3to4 && d.radar) ? (() => {
    const radarSize = 280;
    const { svg: radarSVG, labels: radarLabels } = buildRadarSVG(JSX, d.radar, radarSize, 20);
    return JSX("div", {
      style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", marginBottom: "12px" },
      children: [
        JSX("div", {
          style: { position: "relative", width: radarSize, height: radarSize, display: "flex" },
          children: [radarSVG, ...radarLabels],
        }),
      ],
    });
  })() : null;

  // 香气台账（左侧瓶型按香调染色，发丝线分隔，无白卡）
  const perfumeNotes = [d.notesA, d.notesB, d.notesC].map((n) => compactNotes(n, 4));
  const perfumeBrands = [d.brandA, d.brandB, d.brandC];
  const ledgerRows = [d.perfumeA, d.perfumeB, d.perfumeC].map((p, i) => {
    const notes = perfumeNotes[i];
    const brand = perfumeBrands[i];
    const family = inferFamily(notes);
    const accent = family ? (BOTTLE_COLOR[family] ?? GOLD) : (TIER_COLOR[p.tier] ?? GOLD);
    const bottleSize = is3to4 ? 60 : 56;
    const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVG(family ?? p.tier, bottleSize)).toString("base64")}`;
    return JSX("div", {
      style: {
        display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingTop: is3to4 ? "4px" : "5px", paddingBottom: is3to4 ? "4px" : "5px",
      },
      children: [
        JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", flexShrink: 0, marginRight: is3to4 ? "18px" : "16px" } }),
        JSX("div", {
          style: { display: "flex", flexDirection: "column", alignItems: "flex-start", flexGrow: 1, marginRight: "12px" },
          children: [
            JSX("span", { style: { color: accent, fontSize: is3to4 ? "14px" : "13px", letterSpacing: "0.22em", marginBottom: "4px" }, children: p.tier }),
            JSX("span", { style: { color: INK, fontSize: is3to4 ? "21px" : "20px", fontWeight: 600, marginBottom: (brand || notes) ? "3px" : "0px" }, children: p.name }),
            brand ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "13px" : "12px", letterSpacing: "0.14em", marginBottom: notes ? "3px" : "0px" }, children: brand }) : null,
            notes ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "12px" : "12px", letterSpacing: "0.03em", lineHeight: 1.35 }, children: notes }) : null,
          ].filter(Boolean),
        }),
        JSX("span", { style: { color: INK, fontSize: is3to4 ? "34px" : "30px", fontWeight: 500, lineHeight: 1, paddingTop: "2px", flexShrink: 0 }, children: `${p.match}%` }),
      ],
    });
  });
  const ledger = JSX("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: ledgerRows });

  // 记忆点（令人心动的瞬间）——HERO 区块，1:1 与 3:4 均完整展示、不截断（标题去两侧灰杠）
  const memoryHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", marginBottom: "6px" },
    children: [
      JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "21px" : "19px", letterSpacing: "0.24em", whiteSpace: "nowrap" }, children: t }),
    ],
  });
  const memoryEl = d.memoryScene ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: is3to4 ? "0px" : "6px", marginBottom: "0px", paddingLeft: is3to4 ? "90px" : "70px", paddingRight: is3to4 ? "90px" : "70px" },
    children: [
      memoryHead("令人心动的瞬间"),
      JSX("span", { style: { color: "#4A3C2E", fontSize: is3to4 ? "18px" : "16px", lineHeight: 1.95, textAlign: "center", letterSpacing: "0.02em" }, children: d.memoryScene }),
    ],
  }) : null;

  // 页脚
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginTop: "auto", paddingTop: "16px", borderTop: `1px solid ${HAIR}` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        children: [
          JSX("span", { style: { color: INK, fontSize: "24px", fontWeight: 600, letterSpacing: "0.06em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: MUTED, fontSize: "15px", fontStyle: "italic", marginTop: "8px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", { src: qrBase64, width: qrSize, height: qrSize, style: { borderRadius: "8px", border: `1px solid ${HAIR}`, background: C.WHITE } }),
    ],
  });

  // 用香哲学（编辑式金句）：1:1 / 3:4 均展示，替换原「气味底稿 / 人物小传」深度块
  // 引号内联成对包裹正文，避免单独浮置的前引号显得像多余字符
  const philosophyEl = (d.scentPhilosophy) ? JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingLeft: is3to4 ? "24px" : "16px", paddingRight: is3to4 ? "24px" : "16px", marginTop: "0px", marginBottom: is3to4 ? "0px" : "8px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "18px" : "16px", lineHeight: 1.9, textAlign: "center", letterSpacing: "0.02em" }, children: `“${d.scentPhilosophy}”` }),
    ],
  }) : null;

  // 3:4 专属：香调偏好 top 3
  const radarTop3El = (is3to4 && d.radarTop3 && d.radarTop3.length > 0) ? JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "0px" },
    children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "21px" : "22px", letterSpacing: "0.12em" }, children: d.radarTop3.join(" · ") })],
  }) : null;

  const centerChildren: any[] = [eyebrow, hero, heroRule];
  // 1:1 空间有限，把用香哲学放在顶部人物小传的原位置；3:4 保持「三支香 → 用香哲学 → 香调偏好」深度流
  if (philosophyEl && !is3to4) centerChildren.push(secHead("用香哲学"), philosophyEl);
  centerChildren.push(tagline);
  if (memoryEl) centerChildren.push(memoryEl); // 记忆点 HERO：置于三香之前
  if (radarEl) { centerChildren.push(secHead("香气图谱"), radarEl); }
  centerChildren.push(secHead("为你调的三支香"), ledger);
  if (philosophyEl && is3to4) centerChildren.push(secHead("用香哲学"), philosophyEl);
  if (radarTop3El) centerChildren.push(secHead("香调偏好"), radarTop3El);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad, position: "relative",
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      masthead,
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, minHeight: "0", overflow: "hidden", justifyContent: "center", width: "100%" },
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
  const is3to4 = H > W;
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;
  const ringSize = is3to4 ? 240 : 220;
  const ringBase64 = `data:image/svg+xml;base64,${Buffer.from(buildRingSVGFn(d.score, ringSize)).toString("base64")}`;

  // 报头：发丝线 + 品牌小标
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: is3to4 ? "26px" : "30px" },
    children: [
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR }, children: "" }),
      JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.4em", paddingLeft: "22px", paddingRight: "22px", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR }, children: "" }),
    ],
  });

  // eyebrow
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "22px" : "26px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.28em" }, children: "香气默契鉴定 · COMPATIBILITY" })],
  });

  // 区块小标题（带发丝线）
  const secHead = (t: string) => JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginTop: "0px", marginBottom: "10px" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.16em", fontWeight: 500, whiteSpace: "nowrap" }, children: t }),
      JSX("span", { style: { flexGrow: 1, height: "1px", background: HAIR, marginLeft: "16px" }, children: "" }),
    ],
  });

  // 双人列（A × B 字标 + 本命香 + 品牌 + 三调）
  const pairCol = (name: string, perfumeName: string, brand: string | undefined, notes: string | undefined, align: "flex-start" | "flex-end") => JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: align, flex: "0 0 40%" },
    children: [
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "74px" : "60px", fontWeight: 600, lineHeight: 1, letterSpacing: "0.04em" }, children: name }),
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: align, marginTop: "14px" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "21px" : "18px", letterSpacing: "0.04em" }, children: `本命香 · ${perfumeName || ""}` }),
          brand ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "14px", letterSpacing: "0.14em", marginTop: "6px" }, children: brand }) : null,
          notes ? JSX("span", { style: { color: "#7A6A56", fontSize: is3to4 ? "15px" : "13px", letterSpacing: "0.03em", marginTop: "6px" }, children: notes }) : null,
        ].filter(Boolean),
      }),
    ],
  });
  const pair = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "100%", marginBottom: is3to4 ? "18px" : "20px" },
    children: [
      pairCol(d.nameA, d.perfumeNameA, d.brandA, d.notesA, "flex-start"),
      JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "52px" : "42px", alignSelf: "center" }, children: "×" }),
      pairCol(d.nameB, d.perfumeNameB, d.brandB, d.notesB, "flex-end"),
    ],
  });

  // 共鸣度核心视觉：双细线圆环 + 居中数字 + 上方小标
  const ringContainer = JSX("div", {
    style: { position: "relative", display: "flex", width: `${ringSize}px`, height: `${ringSize}px`, marginBottom: is3to4 ? "14px" : "18px" },
    children: [
      JSX("img", { src: ringBase64, width: ringSize, height: ringSize, style: { position: "absolute", top: "0px", left: "0px" } }),
      JSX("div", {
        style: { position: "absolute", top: "0px", left: "0px", right: "0px", bottom: "0px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "17px" : "15px", letterSpacing: "0.28em", marginBottom: is3to4 ? "10px" : "8px" }, children: "共鸣度" }),
          JSX("span", { style: { color: INK, fontSize: is3to4 ? "76px" : "66px", fontWeight: 600, lineHeight: 1, letterSpacing: "0.02em" }, children: String(d.score) }),
        ],
      }),
    ],
  });

  // tier 徽章（描边胶囊）
  const tierBadge = JSX("div", {
    style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${GOLD}`, borderRadius: "999px", padding: is3to4 ? "10px 36px" : "10px 30px", marginTop: is3to4 ? "8px" : "10px", marginBottom: is3to4 ? "18px" : "22px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "28px" : "25px", letterSpacing: "0.14em" }, children: d.tier })],
  });

  // 关系解读句
  const story = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "14px" },
    children: [JSX("span", { style: { color: "#4A3C2E", fontSize: is3to4 ? "28px" : "24px", textAlign: "center", lineHeight: 1.7 }, children: d.story })],
  });

  // 相处建议句（基于 tier 生成一句克制建议）
  // 键同时覆盖「新档名（气息同频/默契成对）」与「旧档名/旧副标题（灵魂伴侣/灵魂共振/天生一对/互补搭档…）」以兼容旧分享参数
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
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "16px" : "20px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "23px" : "21px", fontStyle: "italic", textAlign: "center", lineHeight: 1.6 }, children: adviceText })],
  });

  // 合香卡（CP 共振核心产物）——分享图统一精简行「合香 {名} · 隔 X 调」
  // 完整三调+解读留给页面 CpBlendCard（避免分享图 3:4 内容溢出被裁）
  // 当 diffTones 为 0 时显示「同调」而非「隔 0 调」，避免文案生硬。
  const cpDiffText = d.cpDiffTones === undefined ? undefined : d.cpDiffTones === 0 ? "同调" : `隔 ${d.cpDiffTones} 调`;
  const cpLine = d.cpBlendName ? JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "14px" : "18px" },
    children: [
      JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "20px" : "15px" }, children: "合香" }),
      JSX("span", { style: { color: INK, fontSize: is3to4 ? "32px" : "24px", fontWeight: 600, marginLeft: is3to4 ? "18px" : "14px" }, children: d.cpBlendName }),
      cpDiffText ? JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "18px" : "15px", marginLeft: is3to4 ? "14px" : "12px" }, children: cpDiffText }) : null,
    ].filter(Boolean),
  }) : null;

  // 双人香气光谱对比（仅 3:4，金=A / 墨=B）
  const dualRadarEl = (is3to4 && d.radarA && d.radarB) ? (() => {
    const rSize = 230;
    // SVG 几何体 + satori 绝对定位标签：避免嵌套 SVG <text> 字体丢失。
    const { svg: rSvg, labels: rLabels } = buildDualRadarSVG(JSX, d.radarA!, d.radarB!, rSize);
    return JSX("div", {
      style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: "12px" },
      children: [
        secHead("香气光谱对比"),
        JSX("div", {
          style: { position: "relative", width: rSize, height: rSize, display: "flex" },
          children: [rSvg, ...rLabels],
        }),
        JSX("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "10px" },
          children: [
            JSX("span", { style: { display: "flex", width: "12px", height: "12px", borderRadius: "3px", background: "#A8884E", marginRight: "8px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "18px", marginRight: "22px" }, children: d.nameA }),
            JSX("span", { style: { display: "flex", width: "12px", height: "12px", borderRadius: "3px", background: "#2A211B", marginRight: "8px" }, children: "" }),
            JSX("span", { style: { color: INK, fontSize: "18px" }, children: d.nameB }),
          ],
        }),
      ],
    });
  })() : null;

  // 共享香调（发丝线胶囊，1:1 与 3:4 均显示，最多 4 个）
  const sharedEl = d.sharedNotes && d.sharedNotes.length > 0
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
        children: [
          JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "22px" : "19px", letterSpacing: "0.2em", marginRight: "14px" }, children: "共享香调" }),
          ...d.sharedNotes.slice(0, 4).map((n, i) =>
            JSX("div", {
              key: i,
              style: { display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${HAIR}`, borderRadius: "999px", padding: is3to4 ? "9px 26px" : "7px 20px", margin: "4px", background: "rgba(255,255,255,0.4)" },
              children: [JSX("span", { style: { color: "#5A4A39", fontSize: is3to4 ? "22px" : "19px" }, children: n })],
            })
          ),
        ],
      })
    : null;

  // 页脚
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", marginTop: "auto", paddingTop: "18px", borderTop: `1px solid ${HAIR}` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        children: [
          JSX("span", { style: { color: INK, fontSize: "22px", fontWeight: 600, letterSpacing: "0.06em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: MUTED, fontSize: "14px", fontStyle: "italic", marginTop: "6px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", { src: qrBase64, width: qrSize, height: qrSize, style: { borderRadius: "8px", border: `1px solid ${HAIR}`, background: C.WHITE } }),
    ],
  });

  const centerChildren: any[] = [eyebrow, pair, ringContainer, tierBadge, story, advice];
  if (cpLine) centerChildren.push(cpLine);
  if (dualRadarEl) centerChildren.push(dualRadarEl);
  if (sharedEl) centerChildren.push(sharedEl);

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      masthead,
      JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, minHeight: "0", overflow: "hidden", justifyContent: "center", width: "100%" }, children: centerChildren }),
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
  const is3to4 = H > W;
  const bottleSize = is3to4 ? 200 : 170;
  const bottleSVG = `data:image/svg+xml;base64,${Buffer.from(buildBottleSVGFn("本命香", bottleSize)).toString("base64")}`;

  // 品牌行
  const brandLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "100%", marginBottom: is3to4 ? "24px" : "20px" },
    children: [
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
      JSX("span", {
        style: { color: C.TEXT_MUTED, fontSize: "22px", letterSpacing: "0.2em", whiteSpace: "nowrap", marginLeft: "8px", marginRight: "8px" },
        children: "Crush 香鉴",
      }),
      JSX("span", { style: { flexGrow: 1, borderTop: `1px solid ${C.AMBER_LIGHT}` }, children: "" }),
    ],
  });

  // 副标题
  const subtitle = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: "12px" },
    children: [
      JSX("span", { style: { color: C.TEXT_MUTED, fontSize: "22px" }, children: `这是 ${d.sharerName} 的香气` }),
    ],
  });

  // 人格名大字
  const nameBlock = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: is3to4 ? "20px" : "16px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_DARK, fontSize: is3to4 ? "96px" : "80px", fontWeight: 700, lineHeight: 1, letterSpacing: "0.06em" },
        children: d.name,
      }),
    ],
  });

  // description
  const descEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "16px" : "14px" },
    children: [
      JSX("span", { style: { color: C.AMBER_MID, fontSize: is3to4 ? "24px" : "22px", textAlign: "center", lineHeight: 1.5 }, children: d.description }),
    ],
  });

  // 用香哲学（编辑式金句）：与 self 卡统一口径
  const philosophyEl = d.scentPhilosophy
    ? JSX("div", {
        style: { display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", paddingLeft: is3to4 ? "48px" : "36px", paddingRight: is3to4 ? "48px" : "36px", marginBottom: is3to4 ? "24px" : "20px" },
        children: [
          JSX("span", {
            style: { color: C.AMBER_DARK, fontSize: is3to4 ? "23px" : "20px", lineHeight: 1.95, textAlign: "center", letterSpacing: "0.02em" },
            children: `“${d.scentPhilosophy}”`,
          }),
        ],
      })
    : null;

  // 本命香瓶 + 名
  const perfumeBlock = JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      background: C.WHITE, borderRadius: "20px",
      border: `1px solid ${C.AMBER_LIGHT}50`,
      padding: is3to4 ? "24px 32px" : "20px 28px",
      marginBottom: is3to4 ? "28px" : "24px",
      boxShadow: `0 4px 20px rgba(92,56,38,0.10)`,
    },
    children: [
      JSX("img", { src: bottleSVG, width: bottleSize, height: bottleSize, style: { display: "block", marginBottom: "12px" } }),
      JSX("span", { style: { color: C.AMBER_DARK, fontSize: is3to4 ? "24px" : "22px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }, children: d.perfumeName }),
      JSX("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "center", background: TIER_BG["本命香"], borderRadius: "999px", padding: "5px 18px", border: `1px solid ${TIER_COLOR["本命香"]}40` },
        children: [JSX("span", { style: { color: TIER_COLOR["本命香"], fontSize: "18px", fontWeight: 600 }, children: "本命香" })],
      }),
    ],
  });

  // CTA
  const ctaEl = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: is3to4 ? "20px" : "16px" },
    children: [
      JSX("span", {
        style: { color: C.AMBER_ACCENT, fontSize: is3to4 ? "30px" : "26px", fontWeight: 700, letterSpacing: "0.04em" },
        children: "3 分钟测你的香气 >",
      }),
    ],
  });

  // 品牌行 + QR
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "16px", borderTop: `1px solid ${C.AMBER_LIGHT}40` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" },
        children: [
          JSX("span", { style: { color: C.AMBER_DARK, fontSize: "20px", fontWeight: 600, letterSpacing: "0.04em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: C.AMBER_MID, fontSize: "14px", fontStyle: "italic", lineHeight: 1.4, marginTop: "4px" }, children: "你身上，藏着哪种香气？" }),
        ],
      }),
      JSX("img", {
        src: qrBase64, width: qrSize, height: qrSize,
        style: { borderRadius: "10px", border: `1px solid ${C.AMBER_LIGHT}60`, background: C.WHITE },
      }),
    ],
  });

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad,
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, minHeight: "0", overflow: "hidden", justifyContent: "center" },
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
  const is3to4 = H > W;
  const INK = C.INK, GOLD = C.GOLD, MUTED = C.MUTED, HAIR = C.HAIR;

  // 报头
  const masthead = JSX("div", {
    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginBottom: is3to4 ? "16px" : "22px" },
    children: [
      JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "24px" : "22px", letterSpacing: "0.4em", whiteSpace: "nowrap" }, children: "CRUSH XIANGJIAN" }),
      JSX("span", { style: { width: "120px", height: "1px", background: HAIR, marginTop: is3to4 ? "14px" : "16px" }, children: "" }),
    ],
  });

  // 标题
  const eyebrow = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "14px" },
    children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "30px" : "26px", fontWeight: 700, letterSpacing: "0.18em", fontFamily: "serif" }, children: "· 今日香签 ·" })],
  });

  // 日期 + 星期
  const [y, m, day] = d.date.split("-").map(Number);
  const wd = "日一二三四五六"[new Date(y, m - 1, day).getDay()];
  const dateLine = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "14px" : "18px" },
    children: [JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "20px" : "18px", letterSpacing: "0.2em" }, children: `${d.date.replace(/-/g, ".")} 星期${wd}` })],
  });

  // 解析「前 X ｜ 中 Y ｜ 后 Z」为三段（用于三行香调展示）
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
        background: C.PAPER, border: `1px solid ${isMain ? GOLD : HAIR}`, borderRadius: "16px",
        padding: is3to4 ? "20px 14px" : "16px 10px",
      },
      children: [
        JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "17px" : "15px", letterSpacing: "0.22em" }, children: label }),
        rarity
          ? JSX("span", { style: { marginTop: "6px", color: GOLD, fontSize: is3to4 ? "16px" : "14px", border: `1px solid ${GOLD}`, borderRadius: "4px", padding: "0px 7px", letterSpacing: "0.1em" }, children: rarity })
          : JSX("span", { style: { marginTop: "6px", height: "20px" }, children: "" }),
        JSX("span", { style: { color: INK, fontFamily: "serif", fontWeight: 700, fontSize: is3to4 ? "26px" : "22px", marginTop: "10px", textAlign: "center", lineHeight: 1.25, letterSpacing: "0.04em" }, children: name }),
        JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "14px", marginTop: "4px" }, children: brand }),
        // 金线分隔（与页面 UI 同步，区分信息与诗意）
        JSX("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", marginTop: is3to4 ? "10px" : "8px" },
          children: [JSX("span", { style: { display: "block", width: is3to4 ? "26px" : "22px", height: "1px", background: "rgba(168,136,78,0.55)" }, children: "" })],
        }),
        // 诗意短评（填满中部留白的核心内容）
        JSX("span", {
          style: {
            display: "block", width: "100%", color: "#5A4E3E",
            fontFamily: "serif", fontSize: is3to4 ? "15px" : "13px",
            marginTop: is3to4 ? "8px" : "6px", textAlign: "center", lineHeight: 1.6, letterSpacing: "0.02em",
          },
          children: description,
        }),
        // 香调（与页面同步：前/中/后 三行小字）
        JSX("div", {
          style: {
            display: "flex", flexDirection: "column", alignItems: "center",
            marginTop: "auto", paddingTop: is3to4 ? "10px" : "8px", width: "100%",
            borderTop: `1px dashed rgba(168,136,78,${is3to4 ? 0.3 : 0.35})`,
          },
          children: [
            JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "13px" : "11px", letterSpacing: "0.3em", marginBottom: "4px" }, children: "香 调" }),
            JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "14px" : "12px", lineHeight: 1.55 }, children: `前 · ${parseNotes(notes).top}` }),
            JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "14px" : "12px", lineHeight: 1.55 }, children: `中 · ${parseNotes(notes).heart}` }),
            JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "14px" : "12px", lineHeight: 1.55 }, children: `后 · ${parseNotes(notes).base}` }),
          ],
        }),
      ],
    });

  const strips = JSX("div", {
    style: { display: "flex", flexDirection: "row", gap: is3to4 ? "16px" : "14px", width: "100%", marginTop: "4px" },
    children: [
      strip("启示", d.inspirationA.name, d.inspirationA.brandCn, d.inspirationA.description, d.inspirationA.notes, d.inspirationA.rarity, false),
      strip("主香", d.main.name, d.main.brandCn, d.main.description, d.main.notes, d.main.rarity, true),
      strip("启示", d.inspirationB.name, d.inspirationB.brandCn, d.inspirationB.description, d.inspirationB.notes, d.inspirationB.rarity, false),
    ],
  });

  // 今日宜忌（两列块：1:1 与 3:4 均完整展示，填满中下部留白）
  const alm = d.almanac;
  const almanacBlock = alm
    ? JSX("div", {
        style: {
          display: "flex", flexDirection: "column", width: "100%",
          marginTop: is3to4 ? "22px" : "18px",
          padding: is3to4 ? "18px 22px" : "14px 16px",
          background: C.PAPER, border: `1px solid ${HAIR}`, borderRadius: "16px",
        },
        children: [
          JSX("div", {
            style: { display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: is3to4 ? "12px" : "8px" },
            children: [JSX("span", { style: { color: INK, fontSize: is3to4 ? "22px" : "18px", fontWeight: 700, letterSpacing: "0.18em", fontFamily: "serif" }, children: "今日宜忌" })],
          }),
          JSX("div", {
            style: { display: "flex", flexDirection: "row", gap: is3to4 ? "24px" : "16px", width: "100%" },
            children: [
              JSX("div", {
                style: { flex: 1, display: "flex", flexDirection: "column" },
                children: [
                  JSX("span", { style: { color: GOLD, fontSize: is3to4 ? "17px" : "14px", letterSpacing: "0.1em" }, children: "宜" }),
                  ...alm.yi.map((x, i) =>
                    JSX("span", { key: i, style: { color: INK, fontSize: is3to4 ? "18px" : "14px", lineHeight: 1.7, marginTop: i === 0 ? (is3to4 ? 6 : 4) : 0 }, children: x })),
                ],
              }),
              JSX("div", {
                style: { flex: 1, display: "flex", flexDirection: "column" },
                children: [
                  JSX("span", { style: { color: "#9A8E7C", fontSize: is3to4 ? "17px" : "14px", letterSpacing: "0.1em" }, children: "忌" }),
                  ...alm.ji.map((x, i) =>
                    JSX("span", { key: i, style: { color: "#6B5E4C", fontSize: is3to4 ? "18px" : "14px", lineHeight: 1.7, marginTop: i === 0 ? (is3to4 ? 6 : 4) : 0 }, children: x })),
                ],
              }),
            ],
          }),
          JSX("span", {
            style: { display: "block", textAlign: "center", color: MUTED, fontSize: is3to4 ? "16px" : "13px", fontStyle: "italic", marginTop: is3to4 ? "12px" : "8px", lineHeight: 1.6 },
            children: alm.note,
          }),
        ],
      })
    : null;

  // 结语
  const footnote = JSX("div", {
    style: { display: "flex", flexDirection: "row", justifyContent: "center", marginTop: is3to4 ? "16px" : "12px" },
    children: [JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "14px", fontStyle: "italic", textAlign: "center", lineHeight: 1.7 }, children: "香签是今日的一缕灵感，不是预言。" })],
  });

  // 页脚（品牌 + 二维码，整体放在底部，避免中部大段留白）
  const bottomRow = JSX("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "100%", paddingTop: is3to4 ? "18px" : "14px", borderTop: `1px solid ${HAIR}` },
    children: [
      JSX("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
        children: [
          JSX("span", { style: { color: INK, fontSize: is3to4 ? "26px" : "24px", fontWeight: 600, letterSpacing: "0.06em" }, children: "Crush 香鉴" }),
          JSX("span", { style: { color: MUTED, fontSize: is3to4 ? "16px" : "14px", fontStyle: "italic", marginTop: "8px" }, children: "今日，被某种气息接住。" }),
        ],
      }),
      JSX("img", { src: qrBase64, width: qrSize, height: qrSize, style: { borderRadius: "8px", border: `1px solid ${HAIR}`, background: C.WHITE } }),
    ],
  });

  // 将上部内容与底部落款分组，用 justifyContent: space-between 让内容自然顶满画布
  const topSection = JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }, children: [masthead, eyebrow, dateLine, strips, almanacBlock] });
  const bottomSection = JSX("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }, children: [footnote, bottomRow] });

  return JSX("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      width: `${W}px`, height: `${H}px`,
      background: C.BG, padding: pad, position: "relative",
      fontFamily: fontData.byteLength > 0 ? '"Noto Serif SC"' : "serif",
    },
    children: [topSection, bottomSection],
  });
}

export async function renderShareCardCached(
  data: ShareCardData,
  format: "1to1" | "3to4" = "1to1"
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
